export type MonitoringMode = "all_alerts" | "silent_all" | "alerts_only" | "off";

export type ConversationControl = {
  mode: "ai" | "human";
  claimedBy: number | null;
};

async function upsertSetting(db: D1Database, key: string, value: string, actorId: number) {
  await db.prepare(
    `INSERT INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value=excluded.setting_value,
       updated_by=excluded.updated_by,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(key, value, actorId).run();
}

export async function getMonitoringMode(db?: D1Database): Promise<MonitoringMode> {
  if (!db) return "all_alerts";
  const row = await db.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key='monitoring_mode'`,
  ).first<{ setting_value: string }>();
  const value = row?.setting_value;
  return value === "silent_all" || value === "alerts_only" || value === "off" || value === "all_alerts"
    ? value
    : "all_alerts";
}

export async function setMonitoringMode(
  db: D1Database | undefined,
  ownerId: number,
  mode: MonitoringMode,
): Promise<string> {
  if (!db) return "D1 is not bound.";
  await upsertSetting(db, "monitoring_mode", mode, ownerId);
  return `Monitoring mode saved: ${mode}`;
}

export async function monitoringStatus(db?: D1Database): Promise<string> {
  const mode = await getMonitoringMode(db);
  return [
    "Shadow Monitoring",
    `Mode: ${mode}`,
    "all_alerts = mirror all silently; alert risky/handoff events",
    "silent_all = mirror all silently; no routine alerts",
    "alerts_only = no routine mirror; alert risky/handoff events only",
    "off = no routine mirror; critical human handoff still remains enabled",
  ].join("\n");
}

export async function getConversationControl(
  db: D1Database | undefined,
  telegramUserId: number,
): Promise<ConversationControl> {
  if (!db) return { mode: "ai", claimedBy: null };
  const row = await db.prepare(
    `SELECT mode, claimed_by FROM conversation_control WHERE telegram_user_id=?1`,
  ).bind(telegramUserId).first<{ mode: "ai" | "human"; claimed_by: number | null }>();
  return row ? { mode: row.mode, claimedBy: row.claimed_by } : { mode: "ai", claimedBy: null };
}

export async function takeOverConversation(
  db: D1Database | undefined,
  telegramUserId: number,
  staffId: number,
): Promise<{ ok: boolean; message: string }> {
  if (!db) return { ok: false, message: "D1 is not bound." };

  await db.prepare(
    `INSERT OR IGNORE INTO conversation_control (telegram_user_id, mode, updated_at)
     VALUES (?1, 'ai', CURRENT_TIMESTAMP)`,
  ).bind(telegramUserId).run();

  const result = await db.prepare(
    `UPDATE conversation_control
     SET mode='human', claimed_by=?2, claimed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
     WHERE telegram_user_id=?1 AND mode='ai'`,
  ).bind(telegramUserId, staffId).run();

  if ((result.meta.changes ?? 0) === 1) {
    return { ok: true, message: `Conversation with user ${telegramUserId} is now under human control.` };
  }

  const current = await getConversationControl(db, telegramUserId);
  if (current.claimedBy === staffId && current.mode === "human") {
    return { ok: true, message: `You already control user ${telegramUserId}.` };
  }
  return { ok: false, message: `Conversation is already controlled by another staff member.` };
}

export async function returnConversationToAi(
  db: D1Database | undefined,
  telegramUserId: number,
  actorId: number,
  ownerId: number | null,
): Promise<{ ok: boolean; message: string }> {
  if (!db) return { ok: false, message: "D1 is not bound." };
  const current = await getConversationControl(db, telegramUserId);
  if (current.mode !== "human") return { ok: true, message: `User ${telegramUserId} is already in AI mode.` };
  if (current.claimedBy !== actorId && ownerId !== actorId) {
    return { ok: false, message: "Only the current claimant or Bot Owner can return this conversation to AI." };
  }

  await db.prepare(
    `UPDATE conversation_control
     SET mode='ai', claimed_by=NULL, claimed_at=NULL, updated_at=CURRENT_TIMESTAMP
     WHERE telegram_user_id=?1`,
  ).bind(telegramUserId).run();
  return { ok: true, message: `Conversation with user ${telegramUserId} returned to AI.` };
}

export async function getMonitoringTopic(
  db: D1Database | undefined,
  telegramUserId: number,
  staffChatId: number,
): Promise<number | null> {
  if (!db) return null;
  const row = await db.prepare(
    `SELECT message_thread_id FROM monitoring_topics
     WHERE telegram_user_id=?1 AND staff_chat_id=?2`,
  ).bind(telegramUserId, staffChatId).first<{ message_thread_id: number }>();
  return row?.message_thread_id ?? null;
}

export async function getUserForMonitoringTopic(
  db: D1Database | undefined,
  staffChatId: number,
  messageThreadId: number,
): Promise<number | null> {
  if (!db) return null;
  const row = await db.prepare(
    `SELECT telegram_user_id FROM monitoring_topics
     WHERE staff_chat_id=?1 AND message_thread_id=?2`,
  ).bind(staffChatId, messageThreadId).first<{ telegram_user_id: number }>();
  return row?.telegram_user_id ?? null;
}

export async function saveMonitoringTopic(
  db: D1Database | undefined,
  telegramUserId: number,
  staffChatId: number,
  messageThreadId: number,
): Promise<void> {
  if (!db) return;
  await db.prepare(
    `INSERT INTO monitoring_topics
      (telegram_user_id, staff_chat_id, message_thread_id, created_at, updated_at)
     VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id, staff_chat_id) DO UPDATE SET
       message_thread_id=excluded.message_thread_id,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(telegramUserId, staffChatId, messageThreadId).run();
}

export function shouldMirrorRoutine(mode: MonitoringMode): boolean {
  return mode === "all_alerts" || mode === "silent_all";
}

export function shouldAlertRisk(mode: MonitoringMode): boolean {
  return mode === "all_alerts" || mode === "alerts_only";
}
