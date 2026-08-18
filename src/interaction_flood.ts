import { getAdminRole } from "./admin";
import type { Language } from "./faq";

export type FloodDecision =
  | { allowed: true }
  | { allowed: false; notify: boolean; retryMinutes: number };

type FloodRow = {
  telegram_user_id: number;
  window_started_at: string;
  window_count: number;
  blocked_until: string | null;
  last_notice_at: string | null;
};

type InquiryState = {
  permanently_banned: number;
  cooldown_until: string | null;
  temporary_restricted_until: string | null;
};

const NORMAL_LIMIT_PER_MINUTE = 20;
const LIMITED_LIMIT_PER_MINUTE = 6;
const BLOCK_MINUTES = 5;
const NOTICE_THROTTLE_MINUTES = 5;

function asUtc(value: string | null): number | null {
  if (!value) return null;
  const ms = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? ms : null;
}

function active(value: string | null): boolean {
  const ms = asUtc(value);
  return ms !== null && ms > Date.now();
}

function minutesRemaining(value: string | null): number {
  const ms = asUtc(value);
  if (ms === null) return 1;
  return Math.max(1, Math.ceil((ms - Date.now()) / 60000));
}

async function isTightlyLimited(db: D1Database, userId: number): Promise<boolean> {
  try {
    const row = await db.prepare(
      `SELECT permanently_banned, cooldown_until, temporary_restricted_until
       FROM user_rate_limits WHERE telegram_user_id=?1`,
    ).bind(userId).first<InquiryState>();
    if (!row) return false;
    return row.permanently_banned === 1
      || active(row.cooldown_until)
      || active(row.temporary_restricted_until);
  } catch {
    return false;
  }
}

async function notifyAllowed(db: D1Database, row: FloodRow): Promise<boolean> {
  const previous = asUtc(row.last_notice_at);
  const notify = previous === null || Date.now() - previous >= NOTICE_THROTTLE_MINUTES * 60 * 1000;
  if (notify) {
    await db.prepare(
      `UPDATE user_interaction_limits
       SET last_notice_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE telegram_user_id=?1`,
    ).bind(row.telegram_user_id).run();
  }
  return notify;
}

export async function checkInteractionFlood(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue?: string,
): Promise<FloodDecision> {
  if (!db) return { allowed: true };

  const role = await getAdminRole(db, userId, ownerIdValue);
  if (role === "owner" || role === "sudo_admin") return { allowed: true };

  const existing = await db.prepare(
    `SELECT telegram_user_id, window_started_at, window_count, blocked_until, last_notice_at
     FROM user_interaction_limits WHERE telegram_user_id=?1`,
  ).bind(userId).first<FloodRow>();

  if (existing && active(existing.blocked_until)) {
    return {
      allowed: false,
      notify: await notifyAllowed(db, existing),
      retryMinutes: minutesRemaining(existing.blocked_until),
    };
  }

  const tight = await isTightlyLimited(db, userId);
  const threshold = tight ? LIMITED_LIMIT_PER_MINUTE : NORMAL_LIMIT_PER_MINUTE;

  const counter = await db.prepare(
    `INSERT INTO user_interaction_limits
       (telegram_user_id, window_started_at, window_count, blocked_until, updated_at)
     VALUES (?1, CURRENT_TIMESTAMP, 1, NULL, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       window_count = CASE
         WHEN datetime(user_interaction_limits.window_started_at, '+60 seconds') <= CURRENT_TIMESTAMP THEN 1
         ELSE user_interaction_limits.window_count + 1
       END,
       window_started_at = CASE
         WHEN datetime(user_interaction_limits.window_started_at, '+60 seconds') <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP
         ELSE user_interaction_limits.window_started_at
       END,
       blocked_until = CASE
         WHEN datetime(user_interaction_limits.blocked_until) <= CURRENT_TIMESTAMP THEN NULL
         ELSE user_interaction_limits.blocked_until
       END,
       updated_at = CURRENT_TIMESTAMP
     RETURNING telegram_user_id, window_started_at, window_count, blocked_until, last_notice_at`,
  ).bind(userId).first<FloodRow>();

  const count = Number(counter?.window_count ?? 1);
  if (count <= threshold) return { allowed: true };

  await db.prepare(
    `UPDATE user_interaction_limits
     SET blocked_until=datetime('now','+5 minutes'),
         last_notice_at=CURRENT_TIMESTAMP,
         updated_at=CURRENT_TIMESTAMP
     WHERE telegram_user_id=?1`,
  ).bind(userId).run();

  return { allowed: false, notify: true, retryMinutes: BLOCK_MINUTES };
}

export function interactionFloodMessage(language: Language, retryMinutes: number): string {
  if (language === "my") {
    return `အချိန်တိုအတွင်း command၊ button သို့မဟုတ် message များစွာ ပေးပို့ထားသဖြင့် bot အသုံးပြုမှုကို ခေတ္တရပ်ထားပါသည်။ ${retryMinutes} မိနစ်ခန့်ကြာပြီးနောက် ပြန်လည်အသုံးပြုပါ။`;
  }
  if (language === "zh") {
    return `由于短时间内发送了过多命令、按钮操作或消息，机器人交互已暂时暂停。请约 ${retryMinutes} 分钟后再试。`;
  }
  return `Bot interaction is temporarily paused because too many commands, button actions, or messages were sent in a short period. Please try again in about ${retryMinutes} minutes.`;
}
