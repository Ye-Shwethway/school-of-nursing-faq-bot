import { getAdminRole } from "./admin";
import {
  COMMAND_SCHEMA_VERSION,
  commandScopeForPrivateChat,
  commandsForRole,
  defaultPrivateScope,
  publicCommands,
} from "./command_menu";

export type TelegramCommandApi = (
  method: string,
  body: unknown,
) => Promise<any | null>;

async function setCommands(
  telegramApi: TelegramCommandApi,
  commands: Array<{ command: string; description: string }>,
  scope: unknown,
): Promise<boolean> {
  try {
    const result = await telegramApi("setMyCommands", { commands, scope });
    return result === true;
  } catch {
    return false;
  }
}

async function deleteCommands(
  telegramApi: TelegramCommandApi,
  scope: unknown,
): Promise<boolean> {
  try {
    const result = await telegramApi("deleteMyCommands", { scope });
    return result === true;
  } catch {
    return false;
  }
}

export async function syncUserCommandScope(
  db: D1Database | undefined,
  telegramApi: TelegramCommandApi,
  telegramUserId: number,
  ownerIdValue?: string,
): Promise<boolean> {
  try {
    const role = await getAdminRole(db, telegramUserId, ownerIdValue);
    const scope = commandScopeForPrivateChat(telegramUserId);

    // Normal users inherit the global all-private-chats command list. Clearing any
    // stale per-chat override prevents an old command menu from shadowing new
    // public commands such as /faq.
    if (role === "user") return await deleteCommands(telegramApi, scope);

    return await setCommands(
      telegramApi,
      commandsForRole(role),
      scope,
    );
  } catch {
    // Command-menu sync must never break the bot's primary reply path.
    return false;
  }
}

export async function syncCommandRegistryIfNeeded(
  db: D1Database | undefined,
  telegramApi: TelegramCommandApi,
  ownerIdValue?: string,
): Promise<void> {
  if (!db) return;

  try {
    const current = await db.prepare(
      `SELECT setting_value FROM bot_settings WHERE setting_key='command_schema_version'`,
    ).first<{ setting_value: string }>();

    if (current?.setting_value === COMMAND_SCHEMA_VERSION) return;

    const defaultOk = await setCommands(
      telegramApi,
      publicCommands(),
      defaultPrivateScope(),
    );
    if (!defaultOk) return;

    const ownerId = ownerIdValue && /^\d+$/.test(ownerIdValue.trim())
      ? Number(ownerIdValue.trim())
      : null;

    if (ownerId && Number.isSafeInteger(ownerId)) {
      const ownerOk = await syncUserCommandScope(db, telegramApi, ownerId, ownerIdValue);
      if (!ownerOk) return;
    }

    const admins = await db.prepare(
      `SELECT telegram_user_id FROM admin_roles
       WHERE role='sudo_admin' ORDER BY telegram_user_id`,
    ).all<{ telegram_user_id: number }>();
    const adminIds = new Set<number>();

    for (const row of admins.results ?? []) {
      adminIds.add(row.telegram_user_id);
      const adminOk = await syncUserCommandScope(db, telegramApi, row.telegram_user_id, ownerIdValue);
      if (!adminOk) return;
    }

    // Existing normal users may still have a chat-specific scope created by an
    // older runtime. Remove those overrides so the updated public command list
    // becomes visible immediately after deployment/health sync.
    const users = await db.prepare(
      `SELECT telegram_user_id FROM users ORDER BY telegram_user_id`,
    ).all<{ telegram_user_id: number }>();

    for (const row of users.results ?? []) {
      const userId = row.telegram_user_id;
      if (!Number.isSafeInteger(userId)) continue;
      if (ownerId !== null && userId === ownerId) continue;
      if (adminIds.has(userId)) continue;
      const cleared = await deleteCommands(telegramApi, commandScopeForPrivateChat(userId));
      if (!cleared) return;
    }

    await db.prepare(
      `INSERT INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
       VALUES ('command_schema_version', ?1, ?2, CURRENT_TIMESTAMP)
       ON CONFLICT(setting_key) DO UPDATE SET
         setting_value=excluded.setting_value,
         updated_by=excluded.updated_by,
         updated_at=CURRENT_TIMESTAMP`,
    ).bind(COMMAND_SCHEMA_VERSION, ownerId ?? 0).run();
  } catch {
    // Missing pre-migration tables or a Telegram API outage must remain non-fatal.
  }
}
