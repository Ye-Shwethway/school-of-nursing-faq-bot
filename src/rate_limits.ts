import { getAdminRole, type AdminRole } from "./admin";
import type { Language } from "./faq";

export type RateDecision =
  | { allowed: true }
  | { allowed: false; kind: "cooldown" | "restricted" | "banned"; retryMinutes?: number };

export type LimitsUiResponse = { handled: boolean; text?: string; keyboard?: unknown };

type LimitRow = {
  telegram_user_id: number;
  window_started_at: string;
  window_count: number;
  cooldown_until: string | null;
  strike_count: number;
  last_limit_hit_at: string | null;
  exempt_until: string | null;
  temporary_restricted_until: string | null;
  permanently_banned: number;
  banned_at: string | null;
  banned_by: number | null;
  ban_reason: string | null;
  updated_at: string;
};

type UserRow = LimitRow & {
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

const WINDOW_LIMIT = 10;
const WINDOW_MINUTES = 10;
const PAGE_SIZE = 6;

function isPrivileged(role: AdminRole): boolean {
  return role === "owner" || role === "sudo_admin";
}

function asUtc(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? ms : null;
}

function activeUntil(value: string | null): boolean {
  const ms = asUtc(value);
  return ms !== null && ms > Date.now();
}

function minutesRemaining(value: string | null): number {
  const ms = asUtc(value);
  if (ms === null) return 1;
  return Math.max(1, Math.ceil((ms - Date.now()) / 60000));
}

function sqliteTimestamp(date: Date): string {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function cooldownMinutesForStrike(strike: number): number {
  if (strike <= 1) return 30;
  if (strike === 2) return 120;
  return 720;
}

async function getState(db: D1Database, userId: number): Promise<LimitRow | null> {
  return db.prepare(`SELECT * FROM user_rate_limits WHERE telegram_user_id=?1`)
    .bind(userId).first<LimitRow>();
}

async function audit(db: D1Database, actorId: number, action: string, targetId: number, details?: unknown): Promise<void> {
  await db.prepare(
    `INSERT INTO admin_audit (actor_telegram_user_id, action, target_telegram_user_id, details)
     VALUES (?1, ?2, ?3, ?4)`,
  ).bind(actorId, action, targetId, details == null ? null : JSON.stringify(details)).run();
}

export async function checkAndConsumeInquiry(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue?: string,
): Promise<RateDecision> {
  if (!db) return { allowed: true };
  const role = await getAdminRole(db, userId, ownerIdValue);
  if (isPrivileged(role)) return { allowed: true };

  const existing = await getState(db, userId);
  if (existing?.permanently_banned === 1) return { allowed: false, kind: "banned" };
  if (existing && activeUntil(existing.exempt_until)) return { allowed: true };
  if (existing && activeUntil(existing.temporary_restricted_until)) {
    return { allowed: false, kind: "restricted", retryMinutes: minutesRemaining(existing.temporary_restricted_until) };
  }
  if (existing && activeUntil(existing.cooldown_until)) {
    return { allowed: false, kind: "cooldown", retryMinutes: minutesRemaining(existing.cooldown_until) };
  }

  const counter = await db.prepare(
    `INSERT INTO user_rate_limits
       (telegram_user_id, window_started_at, window_count, updated_at)
     VALUES (?1, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       window_count = CASE
         WHEN datetime(user_rate_limits.window_started_at, '+${WINDOW_MINUTES} minutes') <= CURRENT_TIMESTAMP THEN 1
         ELSE user_rate_limits.window_count + 1
       END,
       window_started_at = CASE
         WHEN datetime(user_rate_limits.window_started_at, '+${WINDOW_MINUTES} minutes') <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
         ELSE user_rate_limits.window_started_at
       END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING window_count`,
  ).bind(userId).first<{ window_count: number }>();

  const count = Number(counter?.window_count ?? 1);
  if (count <= WINDOW_LIMIT) return { allowed: true };

  const refreshed = await getState(db, userId);
  const previousHit = asUtc(refreshed?.last_limit_hit_at ?? null);
  const within24h = previousHit !== null && Date.now() - previousHit < 24 * 60 * 60 * 1000;
  const strike = within24h ? Math.max(1, Number(refreshed?.strike_count ?? 0) + 1) : 1;
  const cooldownMinutes = cooldownMinutesForStrike(strike);
  const until = new Date(Date.now() + cooldownMinutes * 60000);

  await db.prepare(
    `UPDATE user_rate_limits SET
       cooldown_until=?2,
       strike_count=?3,
       last_limit_hit_at=CURRENT_TIMESTAMP,
       updated_at=CURRENT_TIMESTAMP
     WHERE telegram_user_id=?1`,
  ).bind(userId, sqliteTimestamp(until), strike).run();

  return { allowed: false, kind: "cooldown", retryMinutes: cooldownMinutes };
}

export function rateLimitMessage(language: Language, decision: Exclude<RateDecision, { allowed: true }>): string {
  if (decision.kind === "banned") {
    if (language === "my") return "ဒီအကောင့်မှ မေးခွန်းအသစ်ပေးပို့ခြင်းကို စီမံခန့်ခွဲသူက ပိတ်ထားပါသည်။ အတည်ပြုထားသော အချက်အလက်များကို /faq မှ ဆက်လက်ကြည့်ရှုနိုင်ပါသည်။";
    if (language === "zh") return "此账号已被管理员禁止提交新问题。您仍可通过 /faq 查看已批准的信息。";
    return "New questions from this account have been disabled by an administrator. You can still browse approved information with /faq.";
  }
  const minutes = decision.retryMinutes ?? 1;
  if (language === "my") return `အချိန်တိုအတွင်း မေးခွန်းများစွာ ပေးပို့ထားသဖြင့် မေးခွန်းအသစ်များကို ခေတ္တရပ်ထားပါသည်။ ယခင်လက်ခံပြီးသော မေးခွန်းများကို မှတ်တမ်းတင်ထားပြီးဖြစ်ပါသည်။ ${minutes} မိနစ်ခန့်ကြာပြီးနောက် ပြန်လည်မေးမြန်းနိုင်ပါသည်။ အဲဒီအချိန်အတွင်း /faq မှ အတည်ပြုထားသော မေးခွန်းများကို ကြည့်ရှုနိုင်ပါသည်။`;
  if (language === "zh") return `由于短时间内提交了较多问题，新问题已暂时暂停。此前已接受的问题仍保留记录。请约 ${minutes} 分钟后再试；期间可通过 /faq 查看已批准的信息。`;
  return `New questions are temporarily paused because many were submitted in a short period. Previously accepted questions remain recorded. Please try again in about ${minutes} minutes. You can browse approved information with /faq meanwhile.`;
}

async function roleAllowed(db: D1Database | undefined, userId: number, ownerIdValue?: string): Promise<AdminRole | null> {
  const role = await getAdminRole(db, userId, ownerIdValue);
  return isPrivileged(role) ? role : null;
}

function label(row: UserRow): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  return `${name || row.username || `User ${row.telegram_user_id}`}${row.username ? ` (@${row.username})` : ""}`;
}

function activeStatus(row: UserRow): string {
  if (row.permanently_banned === 1) return "Permanently banned";
  if (activeUntil(row.temporary_restricted_until)) return `Restricted · ${minutesRemaining(row.temporary_restricted_until)} min remaining`;
  if (activeUntil(row.cooldown_until)) return `Cooldown · ${minutesRemaining(row.cooldown_until)} min remaining`;
  if (activeUntil(row.exempt_until)) return `Exempt · ${minutesRemaining(row.exempt_until)} min remaining`;
  return "Normal";
}

async function listLimits(db: D1Database, pageRaw: number): Promise<LimitsUiResponse> {
  const count = await db.prepare(
    `SELECT COUNT(*) AS count FROM user_rate_limits
     WHERE permanently_banned=1
        OR datetime(cooldown_until) > CURRENT_TIMESTAMP
        OR datetime(temporary_restricted_until) > CURRENT_TIMESTAMP
        OR datetime(exempt_until) > CURRENT_TIMESTAMP
        OR strike_count > 0`,
  ).first<{ count: number }>();
  const total = Number(count?.count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.max(0, Math.min(pageRaw, pages - 1));
  const rows = await db.prepare(
    `SELECT rl.*, u.username, u.first_name, u.last_name
     FROM user_rate_limits rl
     LEFT JOIN users u ON u.telegram_user_id=rl.telegram_user_id
     WHERE rl.permanently_banned=1
        OR datetime(rl.cooldown_until) > CURRENT_TIMESTAMP
        OR datetime(rl.temporary_restricted_until) > CURRENT_TIMESTAMP
        OR datetime(rl.exempt_until) > CURRENT_TIMESTAMP
        OR rl.strike_count > 0
     ORDER BY rl.permanently_banned DESC, rl.updated_at DESC
     LIMIT ${PAGE_SIZE} OFFSET ${page * PAGE_SIZE}`,
  ).all<UserRow>();

  const buttons: Array<Array<{ text: string; callback_data: string }>> = (rows.results ?? []).map((row) => [{
    text: `${row.permanently_banned ? "🚫 " : ""}${label(row).slice(0, 42)}`,
    callback_data: `limits:view:${row.telegram_user_id}:${page}`,
  }]);
  if (pages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (page > 0) nav.push({ text: "← Previous", callback_data: `limits:list:${page - 1}` });
    nav.push({ text: `${page + 1} / ${pages}`, callback_data: `limits:list:${page}` });
    if (page < pages - 1) nav.push({ text: "Next →", callback_data: `limits:list:${page + 1}` });
    buttons.push(nav);
  }
  buttons.push([{ text: "✕ Close", callback_data: "ui:close" }]);
  return {
    handled: true,
    text: total ? `User Limits · ${total}\nChoose a user to review or override.` : "User Limits\nNo users currently have rate-limit history, active restrictions, exemptions, or bans.",
    keyboard: { inline_keyboard: buttons },
  };
}

async function detail(db: D1Database, targetId: number, page: number, role: AdminRole): Promise<LimitsUiResponse> {
  let row = await db.prepare(
    `SELECT rl.*, u.username, u.first_name, u.last_name
     FROM user_rate_limits rl LEFT JOIN users u ON u.telegram_user_id=rl.telegram_user_id
     WHERE rl.telegram_user_id=?1`,
  ).bind(targetId).first<UserRow>();
  if (!row) {
    await db.prepare(`INSERT INTO user_rate_limits (telegram_user_id) VALUES (?1)`).bind(targetId).run();
    row = await db.prepare(
      `SELECT rl.*, u.username, u.first_name, u.last_name
       FROM user_rate_limits rl LEFT JOIN users u ON u.telegram_user_id=rl.telegram_user_id
       WHERE rl.telegram_user_id=?1`,
    ).bind(targetId).first<UserRow>();
  }
  if (!row) return { handled: true, text: "User limit state is unavailable." };
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: "🔓 Unlock Now", callback_data: `limits:unlock:${targetId}:${page}` }],
    [
      { text: "🧪 Exempt 1h", callback_data: `limits:exempt:${targetId}:${page}` },
      { text: "⏳ Restrict 2h", callback_data: `limits:restrict:${targetId}:${page}` },
    ],
    [{ text: "Reset Strikes", callback_data: `limits:reset:${targetId}:${page}` }],
  ];
  if (role === "owner") {
    rows.push([row.permanently_banned === 1
      ? { text: "✅ Unban User", callback_data: `limits:unban:${targetId}:${page}` }
      : { text: "🚫 Permanently Ban", callback_data: `limits:banask:${targetId}:${page}` }]);
  }
  rows.push([{ text: "← Users", callback_data: `limits:list:${page}` }]);
  rows.push([{ text: "✕ Close", callback_data: "ui:close" }]);
  return {
    handled: true,
    text: [
      "User Rate Limit",
      `User: ${label(row)} · ID ${row.telegram_user_id}`,
      `Status: ${activeStatus(row)}`,
      `Window: ${row.window_count}/${WINDOW_LIMIT} in ${WINDOW_MINUTES} min`,
      `Strikes: ${row.strike_count}`,
      row.last_limit_hit_at ? `Last limit hit: ${row.last_limit_hit_at} UTC` : null,
      row.banned_at ? `Banned at: ${row.banned_at} UTC` : null,
    ].filter(Boolean).join("\n"),
    keyboard: { inline_keyboard: rows },
  };
}

export async function handleLimitsCommand(db: D1Database | undefined, actorId: number, ownerIdValue: string | undefined, text: string): Promise<LimitsUiResponse> {
  if (!text.trim().toLowerCase().startsWith("/limits")) return { handled: false };
  if (!db) return { handled: true, text: "Rate-limit storage is unavailable." };
  if (!await roleAllowed(db, actorId, ownerIdValue)) return { handled: true, text: "User limits are available to Owner/Sudo only." };
  return listLimits(db, 0);
}

export async function handleLimitsCallback(db: D1Database | undefined, actorId: number, ownerIdValue: string | undefined, data: string): Promise<LimitsUiResponse> {
  if (!data.startsWith("limits:")) return { handled: false };
  if (!db) return { handled: true, text: "Rate-limit storage is unavailable." };
  const role = await roleAllowed(db, actorId, ownerIdValue);
  if (!role) return { handled: true, text: "User limits are available to Owner/Sudo only." };

  const list = data.match(/^limits:list:(\d+)$/);
  if (list) return listLimits(db, Number(list[1]));
  const view = data.match(/^limits:view:(\d+):(\d+)$/);
  if (view) return detail(db, Number(view[1]), Number(view[2]), role);

  const action = data.match(/^limits:(unlock|exempt|restrict|reset|unban):(\d+):(\d+)$/);
  if (action) {
    const kind = action[1];
    const target = Number(action[2]);
    const page = Number(action[3]);
    if (!Number.isSafeInteger(target)) return { handled: true, text: "Invalid user ID." };
    if (kind === "unlock") {
      await db.prepare(`INSERT INTO user_rate_limits (telegram_user_id) VALUES (?1) ON CONFLICT DO NOTHING`).bind(target).run();
      await db.prepare(`UPDATE user_rate_limits SET cooldown_until=NULL, temporary_restricted_until=NULL, window_count=0, window_started_at=CURRENT_TIMESTAMP, updated_by=?2, updated_at=CURRENT_TIMESTAMP WHERE telegram_user_id=?1`).bind(target, actorId).run();
    } else if (kind === "exempt") {
      await db.prepare(`INSERT INTO user_rate_limits (telegram_user_id, exempt_until, updated_by) VALUES (?1, datetime('now','+1 hour'), ?2) ON CONFLICT(telegram_user_id) DO UPDATE SET exempt_until=datetime('now','+1 hour'), cooldown_until=NULL, temporary_restricted_until=NULL, updated_by=?2, updated_at=CURRENT_TIMESTAMP`).bind(target, actorId).run();
    } else if (kind === "restrict") {
      await db.prepare(`INSERT INTO user_rate_limits (telegram_user_id, temporary_restricted_until, updated_by) VALUES (?1, datetime('now','+2 hours'), ?2) ON CONFLICT(telegram_user_id) DO UPDATE SET temporary_restricted_until=datetime('now','+2 hours'), exempt_until=NULL, updated_by=?2, updated_at=CURRENT_TIMESTAMP`).bind(target, actorId).run();
    } else if (kind === "reset") {
      await db.prepare(`INSERT INTO user_rate_limits (telegram_user_id) VALUES (?1) ON CONFLICT DO NOTHING`).bind(target).run();
      await db.prepare(`UPDATE user_rate_limits SET strike_count=0, last_limit_hit_at=NULL, window_count=0, window_started_at=CURRENT_TIMESTAMP, updated_by=?2, updated_at=CURRENT_TIMESTAMP WHERE telegram_user_id=?1`).bind(target, actorId).run();
    } else if (kind === "unban") {
      if (role !== "owner") return { handled: true, text: "Permanent unban is Owner-only." };
      await db.prepare(`UPDATE user_rate_limits SET permanently_banned=0, banned_at=NULL, banned_by=NULL, ban_reason=NULL, cooldown_until=NULL, temporary_restricted_until=NULL, window_count=0, window_started_at=CURRENT_TIMESTAMP, updated_by=?2, updated_at=CURRENT_TIMESTAMP WHERE telegram_user_id=?1`).bind(target, actorId).run();
    }
    await audit(db, actorId, `rate_limit_${kind}`, target);
    return detail(db, target, page, role);
  }

  const ask = data.match(/^limits:banask:(\d+):(\d+)$/);
  if (ask) {
    if (role !== "owner") return { handled: true, text: "Permanent ban is Owner-only." };
    const target = Number(ask[1]);
    const page = Number(ask[2]);
    return {
      handled: true,
      text: `Permanently ban Telegram user ${target}?\n\nThey will no longer be able to submit free-text questions. AI and escalation will not run for them. /faq and other safe read-only commands remain available.`,
      keyboard: { inline_keyboard: [
        [{ text: "🚫 Yes, Permanently Ban", callback_data: `limits:ban:${target}:${page}` }],
        [{ text: "← Cancel", callback_data: `limits:view:${target}:${page}` }],
        [{ text: "✕ Close", callback_data: "ui:close" }],
      ] },
    };
  }

  const ban = data.match(/^limits:ban:(\d+):(\d+)$/);
  if (ban) {
    if (role !== "owner") return { handled: true, text: "Permanent ban is Owner-only." };
    const target = Number(ban[1]);
    const page = Number(ban[2]);
    await db.prepare(`INSERT INTO user_rate_limits (telegram_user_id, permanently_banned, banned_at, banned_by, updated_by) VALUES (?1,1,CURRENT_TIMESTAMP,?2,?2) ON CONFLICT(telegram_user_id) DO UPDATE SET permanently_banned=1, banned_at=CURRENT_TIMESTAMP, banned_by=?2, exempt_until=NULL, updated_by=?2, updated_at=CURRENT_TIMESTAMP`).bind(target, actorId).run();
    await audit(db, actorId, "rate_limit_permanent_ban", target);
    return detail(db, target, page, role);
  }

  return { handled: true, text: "Unknown user-limit action." };
}
