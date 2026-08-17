export type AdminRole = "owner" | "sudo_admin" | "user";

export type AdminCommandResult = {
  handled: boolean;
  response?: string;
};

function parseOwnerId(value?: string): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function isOwner(telegramUserId: number, ownerIdValue?: string) {
  const ownerId = parseOwnerId(ownerIdValue);
  return ownerId !== null && telegramUserId === ownerId;
}

async function isSudoAdmin(db: D1Database, telegramUserId: number) {
  const row = await db.prepare(
    `SELECT telegram_user_id
     FROM admin_roles
     WHERE telegram_user_id = ?1 AND role = 'sudo_admin'`,
  ).bind(telegramUserId).first<{ telegram_user_id: number }>();

  return Boolean(row);
}

export async function getAdminRole(
  db: D1Database | undefined,
  telegramUserId: number,
  ownerIdValue?: string,
): Promise<AdminRole> {
  if (isOwner(telegramUserId, ownerIdValue)) return "owner";
  if (db && await isSudoAdmin(db, telegramUserId)) return "sudo_admin";
  return "user";
}

async function writeAudit(
  db: D1Database,
  actorId: number,
  action: string,
  targetId: number | null,
  details: string | null = null,
) {
  await db.prepare(
    `INSERT INTO admin_audit
      (actor_telegram_user_id, action, target_telegram_user_id, details)
     VALUES (?1, ?2, ?3, ?4)`,
  ).bind(actorId, action, targetId, details).run();
}

async function listAdmins(db: D1Database, ownerIdValue?: string) {
  const ownerId = parseOwnerId(ownerIdValue);
  const rows = await db.prepare(
    `SELECT telegram_user_id, granted_by, granted_at
     FROM admin_roles
     WHERE role = 'sudo_admin'
     ORDER BY granted_at ASC`,
  ).all<{ telegram_user_id: number; granted_by: number; granted_at: string }>();

  const lines = ["Authorized administrators:"];
  if (ownerId !== null) lines.push(`Owner: ${ownerId}`);

  if (rows.results.length === 0) {
    lines.push("Sudo Admins: none");
  } else {
    lines.push("Sudo Admins:");
    for (const row of rows.results) {
      lines.push(`- ${row.telegram_user_id} (granted by ${row.granted_by}, ${row.granted_at})`);
    }
  }

  return lines.join("\n");
}

async function grantSudo(
  db: D1Database,
  actorId: number,
  targetId: number,
  ownerIdValue?: string,
) {
  if (!isOwner(actorId, ownerIdValue)) {
    return "Denied. Only the Bot Owner can grant Sudo Admin access.";
  }

  if (isOwner(targetId, ownerIdValue)) {
    return "No change. The Bot Owner already has the highest authority.";
  }

  await db.prepare(
    `INSERT INTO admin_roles (telegram_user_id, role, granted_by, granted_at)
     VALUES (?1, 'sudo_admin', ?2, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       role = 'sudo_admin',
       granted_by = excluded.granted_by,
       granted_at = CURRENT_TIMESTAMP`,
  ).bind(targetId, actorId).run();

  await writeAudit(db, actorId, "sudo_admin_granted", targetId);
  return `Sudo Admin granted to Telegram user ID ${targetId}.`;
}

async function revokeSudo(
  db: D1Database,
  actorId: number,
  targetId: number,
  ownerIdValue?: string,
) {
  if (!isOwner(actorId, ownerIdValue)) {
    return "Denied. Only the Bot Owner can revoke Sudo Admin access.";
  }

  if (isOwner(targetId, ownerIdValue)) {
    return "Denied. The Bot Owner role cannot be revoked through Sudo Admin management.";
  }

  const result = await db.prepare(
    `DELETE FROM admin_roles
     WHERE telegram_user_id = ?1 AND role = 'sudo_admin'`,
  ).bind(targetId).run();

  await writeAudit(db, actorId, "sudo_admin_revoked", targetId, JSON.stringify({ changed: result.meta.changes }));

  return result.meta.changes > 0
    ? `Sudo Admin revoked from Telegram user ID ${targetId}.`
    : `No Sudo Admin role was found for Telegram user ID ${targetId}.`;
}

function parseTargetId(raw?: string) {
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

export async function handleAdminCommand(
  db: D1Database | undefined,
  telegramUserId: number,
  ownerIdValue: string | undefined,
  text: string,
): Promise<AdminCommandResult> {
  const parts = text.trim().split(/\s+/);
  const command = parts[0].toLowerCase();

  const isAdminCommand = command === "/admin" || command === "/admins" || command === "/sudo";
  if (!isAdminCommand) return { handled: false };

  const role = await getAdminRole(db, telegramUserId, ownerIdValue);

  if (command === "/admin") {
    if (parts[1]?.toLowerCase() === "status" || parts.length === 1) {
      return {
        handled: true,
        response: `Admin status: ${role}\nTelegram user ID: ${telegramUserId}`,
      };
    }

    if (parts[1]?.toLowerCase() === "help") {
      return {
        handled: true,
        response: role === "owner"
          ? "Owner commands:\n/admin status\n/admin help\n/admins\n/sudo grant <telegram_user_id>\n/sudo revoke <telegram_user_id>"
          : role === "sudo_admin"
            ? "Sudo Admin commands:\n/admin status\n/admin help\n/admins"
            : "You do not have administrative access.",
      };
    }

    return { handled: true, response: "Unknown admin command. Use /admin help." };
  }

  if (!db) {
    return { handled: true, response: "Administrative storage is not available." };
  }

  if (command === "/admins") {
    if (role === "user") {
      return { handled: true, response: "You do not have administrative access." };
    }
    return { handled: true, response: await listAdmins(db, ownerIdValue) };
  }

  if (role !== "owner") {
    return { handled: true, response: "Denied. Only the Bot Owner can modify Sudo Admin roles." };
  }

  const action = parts[1]?.toLowerCase();
  const targetId = parseTargetId(parts[2]);

  if ((action !== "grant" && action !== "revoke") || targetId === null) {
    return {
      handled: true,
      response: "Usage:\n/sudo grant <telegram_user_id>\n/sudo revoke <telegram_user_id>",
    };
  }

  if (action === "grant") {
    return { handled: true, response: await grantSudo(db, telegramUserId, targetId, ownerIdValue) };
  }

  return { handled: true, response: await revokeSudo(db, telegramUserId, targetId, ownerIdValue) };
}
