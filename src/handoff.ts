export type HandoffEnv = {
  DB?: D1Database;
};

export async function setStaffInbox(
  db: D1Database | undefined,
  ownerId: number,
  chatId: number,
): Promise<string> {
  if (!db) return "D1 is not bound.";
  await db.prepare(
    `INSERT INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES ('staff_inbox_chat_id', ?1, ?2, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value=excluded.setting_value,
       updated_by=excluded.updated_by,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(String(chatId), ownerId).run();
  return `Staff Inbox bound to chat ${chatId}.`;
}

export async function getStaffInboxChatId(db?: D1Database): Promise<number | null> {
  if (!db) return null;
  const row = await db.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key='staff_inbox_chat_id'`,
  ).first<{ setting_value: string }>();
  if (!row) return null;
  const value = Number(row.setting_value);
  return Number.isSafeInteger(value) ? value : null;
}

export async function addStaffMember(
  db: D1Database | undefined,
  actorId: number,
  staffId: number,
): Promise<string> {
  if (!db) return "D1 is not bound.";
  await db.prepare(
    `INSERT INTO staff_members (telegram_user_id, active, added_by, added_at)
     VALUES (?1, 1, ?2, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET active=1, added_by=excluded.added_by, added_at=CURRENT_TIMESTAMP`,
  ).bind(staffId, actorId).run();
  return `Staff member enabled: ${staffId}`;
}

export async function removeStaffMember(
  db: D1Database | undefined,
  staffId: number,
): Promise<string> {
  if (!db) return "D1 is not bound.";
  await db.prepare(`UPDATE staff_members SET active=0 WHERE telegram_user_id=?1`).bind(staffId).run();
  return `Staff member disabled: ${staffId}`;
}

export async function isStaffMember(db: D1Database | undefined, userId: number): Promise<boolean> {
  if (!db) return false;
  const row = await db.prepare(
    `SELECT active FROM staff_members WHERE telegram_user_id=?1`,
  ).bind(userId).first<{ active: number }>();
  return row?.active === 1;
}

export async function createEscalationCase(
  db: D1Database | undefined,
  input: {
    telegramUserId: number;
    sourceQuestionId?: number | null;
    language?: string | null;
    question: string;
    staffChatId?: number | null;
  },
): Promise<number | null> {
  if (!db) return null;
  const result = await db.prepare(
    `INSERT INTO escalation_cases
      (telegram_user_id, source_question_id, language, user_question, staff_chat_id, status)
     VALUES (?1, ?2, ?3, ?4, ?5, 'open')`,
  ).bind(
    input.telegramUserId,
    input.sourceQuestionId ?? null,
    input.language ?? null,
    input.question,
    input.staffChatId ?? null,
  ).run();
  const caseId = Number(result.meta.last_row_id);
  if (!Number.isSafeInteger(caseId)) return null;
  await db.prepare(
    `INSERT INTO escalation_messages (case_id, direction, telegram_user_id, body)
     VALUES (?1, 'user_to_staff', ?2, ?3)`,
  ).bind(caseId, input.telegramUserId, input.question).run();
  return caseId;
}

export async function attachStaffMessage(
  db: D1Database | undefined,
  caseId: number,
  chatId: number,
  messageId: number,
): Promise<void> {
  if (!db) return;
  await db.prepare(
    `UPDATE escalation_cases SET staff_chat_id=?2, staff_message_id=?3 WHERE id=?1`,
  ).bind(caseId, chatId, messageId).run();
}

export async function claimCase(
  db: D1Database | undefined,
  caseId: number,
  staffId: number,
): Promise<{ ok: boolean; message: string }> {
  if (!db) return { ok: false, message: "D1 is not bound." };
  if (!(await isStaffMember(db, staffId))) return { ok: false, message: "Not authorized for Staff Inbox." };

  const result = await db.prepare(
    `UPDATE escalation_cases
     SET status='claimed', claimed_by=?1, claimed_at=CURRENT_TIMESTAMP
     WHERE id=?2 AND status='open' AND claimed_by IS NULL`,
  ).bind(staffId, caseId).run();

  if ((result.meta.changes ?? 0) === 1) return { ok: true, message: `Case #${caseId} claimed.` };

  const current = await db.prepare(
    `SELECT status, claimed_by FROM escalation_cases WHERE id=?1`,
  ).bind(caseId).first<{ status: string; claimed_by: number | null }>();
  if (!current) return { ok: false, message: `Case #${caseId} not found.` };
  if (current.claimed_by === staffId) return { ok: true, message: `You already own Case #${caseId}.` };
  return { ok: false, message: `Case #${caseId} is already claimed.` };
}

export async function resolveCase(
  db: D1Database | undefined,
  caseId: number,
  staffId: number,
): Promise<{ ok: boolean; message: string }> {
  if (!db) return { ok: false, message: "D1 is not bound." };
  const result = await db.prepare(
    `UPDATE escalation_cases
     SET status='resolved', resolved_at=CURRENT_TIMESTAMP
     WHERE id=?1 AND status='claimed' AND claimed_by=?2`,
  ).bind(caseId, staffId).run();
  return (result.meta.changes ?? 0) === 1
    ? { ok: true, message: `Case #${caseId} resolved.` }
    : { ok: false, message: `Only the current claimant can resolve Case #${caseId}.` };
}

export async function caseForStaffReply(
  db: D1Database | undefined,
  staffChatId: number,
  replyToMessageId: number,
  staffId: number,
): Promise<{ caseId: number; telegramUserId: number } | null> {
  if (!db) return null;
  const row = await db.prepare(
    `SELECT id, telegram_user_id, claimed_by, status
     FROM escalation_cases
     WHERE staff_chat_id=?1 AND staff_message_id=?2`,
  ).bind(staffChatId, replyToMessageId).first<{
    id: number;
    telegram_user_id: number;
    claimed_by: number | null;
    status: string;
  }>();
  if (!row || row.status !== "claimed" || row.claimed_by !== staffId) return null;
  return { caseId: row.id, telegramUserId: row.telegram_user_id };
}

export async function logStaffReply(
  db: D1Database | undefined,
  caseId: number,
  staffId: number,
  body: string,
): Promise<void> {
  if (!db) return;
  await db.prepare(
    `INSERT INTO escalation_messages (case_id, direction, telegram_user_id, body)
     VALUES (?1, 'staff_to_user', ?2, ?3)`,
  ).bind(caseId, staffId, body).run();
}
