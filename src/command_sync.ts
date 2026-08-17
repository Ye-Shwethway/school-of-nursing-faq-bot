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
  const result = await telegramApi("setMyCommands", { commands, scope });
  return result === true;
}

export async function syncUserCommandScope(
  db: D1Database | undefined,
  telegramApi: TelegramCommandApi,
  telegramUserId: number,
  ownerIdValue?: string,
): Promise<void> {
  const role = await getAdminRole(db, telegramUserId, ownerIdValue);
  await setCommands(
    telegramApi,
    commandsForRole(role),
    commandScopeForPrivateChat(telegramUserId),
  );
}

export async function syncCommandRegistryIfNeeded(
  db: D1Database | undefined,
  telegramApi: TelegramCommandApi,
  ownerIdValue?: string,
): Promise<void> {
  if (!db) return;

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
    await syncUserCommandScope(db, telegramApi, ownerId, ownerIdValue);
  }

  const admins = await db.prepare(
    `SELECT telegram_user_id FROM admin_roles
     WHERE role='sudo_admin' ORDER BY telegram_user_id`,
  ).all<{ telegram_user_id: number }>();

  for (const row of admins.results ?? []) {
    await syncUserCommandScope(db, telegramApi, row.telegram_user_id, ownerIdValue);
  }

  await db.prepare(
    `INSERT INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES ('command_schema_version', ?1, ?2, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value=excluded.setting_value,
       updated_by=excluded.updated_by,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(COMMAND_SCHEMA_VERSION, ownerId ?? 0).run();
}
