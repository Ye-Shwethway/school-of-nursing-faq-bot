import { isStaffMember } from "./handoff";
import { getAdminRole } from "./admin";

export async function canManageStaffState(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue?: string,
): Promise<boolean> {
  const role = await getAdminRole(db, userId, ownerIdValue);
  if (role === "owner" || role === "sudo_admin") return true;
  return isStaffMember(db, userId);
}

export async function setStaffAvailability(
  db: D1Database | undefined,
  userId: number,
  available: boolean,
): Promise<void> {
  if (!db) return;
  await db.prepare(
    `INSERT INTO staff_presence (telegram_user_id, available, updated_at)
     VALUES (?1, ?2, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       available=excluded.available,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(userId, available ? 1 : 0).run();
}

export async function isStaffAvailable(
  db: D1Database | undefined,
  userId: number,
): Promise<boolean> {
  if (!db) return false;
  const member = await isStaffMember(db, userId);
  if (!member) return false;
  const row = await db.prepare(
    `SELECT available FROM staff_presence WHERE telegram_user_id=?1`,
  ).bind(userId).first<{ available: number }>();
  return row ? row.available === 1 : true;
}

export async function countAvailableStaff(db: D1Database | undefined): Promise<number> {
  if (!db) return 0;
  const row = await db.prepare(
    `SELECT COUNT(*) AS count
     FROM staff_members s
     LEFT JOIN staff_presence p ON p.telegram_user_id=s.telegram_user_id
     WHERE s.active=1 AND COALESCE(p.available, 1)=1`,
  ).first<{ count: number }>();
  return Number(row?.count ?? 0);
}

export async function setStaffNotificationsEnabled(
  db: D1Database | undefined,
  actorId: number,
  enabled: boolean,
): Promise<void> {
  if (!db) return;
  await db.prepare(
    `INSERT INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES ('staff_notifications_enabled', ?1, ?2, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value=excluded.setting_value,
       updated_by=excluded.updated_by,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(enabled ? "1" : "0", actorId).run();
}

export async function staffNotificationsEnabled(db: D1Database | undefined): Promise<boolean> {
  if (!db) return true;
  const row = await db.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key='staff_notifications_enabled'`,
  ).first<{ setting_value: string }>();
  return row?.setting_value !== "0";
}
