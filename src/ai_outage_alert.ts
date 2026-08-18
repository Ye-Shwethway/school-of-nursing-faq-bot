import { getHandoffDestination } from "./handoff";

type Env = {
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
};

const OUTAGE_KEY = "ai_outage_alert";

function ownerId(env: Env): number | null {
  const raw = env.BOT_OWNER_TELEGRAM_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

async function telegramApi(env: Env, method: string, body: unknown): Promise<any | null> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const payload = await response.json<any>();
    return payload?.result ?? null;
  } catch {
    return null;
  }
}

export function isAiInfrastructureFailure(reason: string): boolean {
  return reason.startsWith("ai_unavailable:") ||
    reason === "primary_and_fallback_failed" ||
    reason === "ai_runtime_failure";
}

async function claimOutageTransition(db: D1Database, reason: string): Promise<boolean> {
  const current = await db.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key=?1`,
  ).bind(OUTAGE_KEY).first<{ setting_value: string }>();

  // An active outage is one operational state. Do not repeat alerts while it remains active,
  // even if the underlying provider/config error changes. Recovery clears this marker.
  if (current?.setting_value) return false;

  const result = await db.prepare(
    `INSERT OR IGNORE INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES (?1, ?2, 0, CURRENT_TIMESTAMP)`,
  ).bind(OUTAGE_KEY, reason).run();
  return (result.meta.changes ?? 0) === 1;
}

async function activeOutageReason(db: D1Database): Promise<string | null> {
  const row = await db.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key=?1`,
  ).bind(OUTAGE_KEY).first<{ setting_value: string }>();
  return row?.setting_value ?? null;
}

async function clearOutage(db: D1Database): Promise<void> {
  await db.prepare(`DELETE FROM bot_settings WHERE setting_key=?1`).bind(OUTAGE_KEY).run();
}

async function operationalTargets(env: Env): Promise<{ owner: number | null; staffChat: number | null }> {
  const owner = ownerId(env);
  if (!env.DB) return { owner, staffChat: null };
  try {
    const destination = await getHandoffDestination(env.DB);
    return { owner, staffChat: destination?.chatId ?? null };
  } catch {
    return { owner, staffChat: null };
  }
}

async function sendOperationalNotice(env: Env, text: string): Promise<void> {
  const targets = await operationalTargets(env);
  const sends: Promise<any | null>[] = [];
  if (targets.owner !== null) {
    sends.push(telegramApi(env, "sendMessage", { chat_id: targets.owner, text }));
  }
  if (targets.staffChat !== null && targets.staffChat !== targets.owner) {
    sends.push(telegramApi(env, "sendMessage", { chat_id: targets.staffChat, text }));
  }
  await Promise.allSettled(sends);
}

export async function notifyAiOutage(env: Env, reason: string): Promise<void> {
  if (!env.DB || !isAiInfrastructureFailure(reason)) return;
  try {
    if (!await claimOutageTransition(env.DB, reason)) return;
    const destination = await getHandoffDestination(env.DB);
    const fallback = destination
      ? "Human fallback: ACTIVE — unresolved questions continue to be logged and routed to staff."
      : "Human fallback: QUEUED ONLY — questions are logged, but no staff destination is configured.";
    const text = [
      "🚨 AI service unavailable",
      `Reason: ${reason}`,
      fallback,
      "FAQ matching remains available.",
      "This outage alert is sent once and will not repeat until AI recovers.",
    ].join("\n");
    await sendOperationalNotice(env, text);
  } catch {
    // Operational alerting must never interrupt the user handoff path.
  }
}

export async function notifyAiRecovered(env: Env): Promise<void> {
  if (!env.DB) return;
  try {
    const previousReason = await activeOutageReason(env.DB);
    if (!previousReason) return;
    await clearOutage(env.DB);
    await sendOperationalNotice(
      env,
      [
        "🟢 AI service recovered",
        `Previous outage: ${previousReason}`,
        "Grounded AI answering is active again. FAQ and human fallback remain the primary continuity paths.",
      ].join("\n"),
    );
  } catch {
    // Recovery visibility is best-effort and must not affect user answers.
  }
}
