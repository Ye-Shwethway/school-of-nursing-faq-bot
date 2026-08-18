import { isStaffMember } from "./handoff";
import { getAdminRole } from "./admin";

const YANGON_OFFSET_MINUTES = 6 * 60 + 30;

type PresenceRow = {
  telegram_user_id: number;
  available: number;
  unavailable_until: string | null;
  schedule_start_minute: number | null;
  schedule_end_minute: number | null;
  schedule_enabled: number;
};

function sqliteUtc(value: Date): string {
  return value.toISOString().replace("T", " ").slice(0, 19);
}

function parseSqliteUtc(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value.replace(" ", "T") + "Z");
  return Number.isFinite(parsed) ? parsed : null;
}

function yangonMinute(now = new Date()): number {
  const shifted = new Date(now.getTime() + YANGON_OFFSET_MINUTES * 60_000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function insideDailyWindow(minute: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end
    ? minute >= start && minute < end
    : minute >= start || minute < end;
}

function effectiveFromRow(row: PresenceRow | null, now = new Date()): boolean {
  if (!row) return true;
  const unavailableUntil = parseSqliteUtc(row.unavailable_until);
  if (unavailableUntil !== null && unavailableUntil > now.getTime()) return false;
  if (row.schedule_enabled === 1 && row.schedule_start_minute !== null && row.schedule_end_minute !== null) {
    return insideDailyWindow(yangonMinute(now), row.schedule_start_minute, row.schedule_end_minute);
  }
  return row.available === 1;
}

async function presenceRow(db: D1Database, userId: number): Promise<PresenceRow | null> {
  return db.prepare(
    `SELECT telegram_user_id, available, unavailable_until,
            schedule_start_minute, schedule_end_minute, schedule_enabled
     FROM staff_presence WHERE telegram_user_id=?1`,
  ).bind(userId).first<PresenceRow>();
}

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
    `INSERT INTO staff_presence
       (telegram_user_id, available, unavailable_until, schedule_start_minute, schedule_end_minute, schedule_enabled, updated_at)
     VALUES (?1, ?2, NULL, NULL, NULL, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       available=excluded.available,
       unavailable_until=NULL,
       schedule_start_minute=NULL,
       schedule_end_minute=NULL,
       schedule_enabled=0,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(userId, available ? 1 : 0).run();
}

export async function setTemporaryUnavailable(
  db: D1Database | undefined,
  userId: number,
  hours: number,
): Promise<string | null> {
  if (!db) return null;
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
  const expiresAt = sqliteUtc(expires);
  await db.prepare(
    `INSERT INTO staff_presence
       (telegram_user_id, available, unavailable_until, schedule_enabled, updated_at)
     VALUES (?1, 0, ?2, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       available=0,
       unavailable_until=excluded.unavailable_until,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(userId, expiresAt).run();
  return expiresAt;
}

export async function setDailyAvailabilitySchedule(
  db: D1Database | undefined,
  userId: number,
  startMinute: number,
  endMinute: number,
): Promise<boolean> {
  if (!db) return false;
  const now = new Date();
  const available = insideDailyWindow(yangonMinute(now), startMinute, endMinute);
  await db.prepare(
    `INSERT INTO staff_presence
       (telegram_user_id, available, unavailable_until, schedule_start_minute, schedule_end_minute, schedule_enabled, updated_at)
     VALUES (?1, ?2, NULL, ?3, ?4, 1, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       available=excluded.available,
       unavailable_until=NULL,
       schedule_start_minute=excluded.schedule_start_minute,
       schedule_end_minute=excluded.schedule_end_minute,
       schedule_enabled=1,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(userId, available ? 1 : 0, startMinute, endMinute).run();
  return available;
}

export async function hasDailyAvailabilitySchedule(
  db: D1Database | undefined,
  userId: number,
): Promise<boolean> {
  if (!db) return false;
  return (await presenceRow(db, userId))?.schedule_enabled === 1;
}

export async function markStaffActiveNow(
  db: D1Database | undefined,
  userId: number,
): Promise<void> {
  if (!db) return;
  const row = await presenceRow(db, userId);
  if (row?.schedule_enabled === 1) {
    await db.prepare(
      `UPDATE staff_presence SET unavailable_until=NULL, updated_at=CURRENT_TIMESTAMP
       WHERE telegram_user_id=?1`,
    ).bind(userId).run();
    return;
  }
  await db.prepare(
    `INSERT INTO staff_presence (telegram_user_id, available, unavailable_until, updated_at)
     VALUES (?1, 1, NULL, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       available=1, unavailable_until=NULL, updated_at=CURRENT_TIMESTAMP`,
  ).bind(userId).run();
}

export async function isStaffAvailable(
  db: D1Database | undefined,
  userId: number,
): Promise<boolean> {
  if (!db) return false;
  const member = await isStaffMember(db, userId);
  if (!member) return false;
  return effectiveFromRow(await presenceRow(db, userId));
}

export async function countAvailableStaff(db: D1Database | undefined): Promise<number> {
  if (!db) return 0;
  const rows = await db.prepare(
    `SELECT s.telegram_user_id,
            COALESCE(p.available, 1) AS available,
            p.unavailable_until,
            p.schedule_start_minute,
            p.schedule_end_minute,
            COALESCE(p.schedule_enabled, 0) AS schedule_enabled
     FROM staff_members s
     LEFT JOIN staff_presence p ON p.telegram_user_id=s.telegram_user_id
     WHERE s.active=1`,
  ).all<PresenceRow>();
  const now = new Date();
  return (rows.results ?? []).reduce((count, row) => count + (effectiveFromRow(row, now) ? 1 : 0), 0);
}

export async function sweepStaffAvailability(db: D1Database | undefined): Promise<void> {
  if (!db) return;
  const rows = await db.prepare(
    `SELECT telegram_user_id, available, unavailable_until,
            schedule_start_minute, schedule_end_minute, schedule_enabled
     FROM staff_presence`,
  ).all<PresenceRow>();
  const now = new Date();
  for (const row of rows.results ?? []) {
    const expiresAt = parseSqliteUtc(row.unavailable_until);
    const expired = expiresAt !== null && expiresAt <= now.getTime();
    const effective = effectiveFromRow({ ...row, unavailable_until: expired ? null : row.unavailable_until }, now);
    if (expired || row.available !== (effective ? 1 : 0)) {
      await db.prepare(
        `UPDATE staff_presence
         SET available=?2,
             unavailable_until=CASE WHEN unavailable_until IS NOT NULL AND unavailable_until<=CURRENT_TIMESTAMP THEN NULL ELSE unavailable_until END,
             updated_at=CURRENT_TIMESTAMP
         WHERE telegram_user_id=?1`,
      ).bind(row.telegram_user_id, effective ? 1 : 0).run();
    }
  }
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
