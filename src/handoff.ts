import { describeTelegramUser } from "./identity";

export type HandoffEnv = {
  DB?: D1Database;
};

export type HandoffRoute = "auto" | "group" | "dedicated";

async function setBotSetting(
  db: D1Database,
  key: string,
  value: string,
  ownerId: number,
): Promise<void> {
  await db.prepare(
    `INSERT INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value=excluded.setting_value,
       updated_by=excluded.updated_by,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(key, value, ownerId).run();
}

async function getBotSetting(db: D1Database | undefined, key: string): Promise<string | null> {
  if (!db) return null;
  const row = await db.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key=?1`,
  ).bind(key).first<{ setting_value: string }>();
  return row?.setting_value ?? null;
}

export async function setStaffInbox(
  db: D1Database | undefined,
  ownerId: number,
  chatId: number,
): Promise<string> {
  if (!db) return "D1 is not bound.";
  await setBotSetting(db, "staff_inbox_chat_id", String(chatId), ownerId);
  await addStaffMember(db, ownerId, ownerId);
  return `Staff Inbox bound to chat ${chatId}. Owner enabled as staff: ${await describeTelegramUser(db, ownerId)}`;
}

export async function getStaffInboxChatId(db?: D1Database): Promise<number | null> {
  const raw = await getBotSetting(db, "staff_inbox_chat_id");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export async function setHandoffRoute(
  db: D1Database | undefined,
  ownerId: number,
  route: HandoffRoute,
): Promise<string> {
  if (!db) return "D1 is not bound.";
  await setBotSetting(db, "handoff_route", route, ownerId);
  return `Human handoff route set to: ${route}`;
}

export async function getHandoffRoute(db?: D1Database): Promise<HandoffRoute> {
  const raw = await getBotSetting(db, "handoff_route");
  return raw === "group" || raw === "dedicated" ? raw : "auto";
}

export async function setDedicatedStaff(
  db: D1Database | undefined,
  ownerId: number,
  staffId: number,
): Promise<string> {
  if (!db) return "D1 is not bound.";
  await addStaffMember(db, ownerId, staffId);
  await setBotSetting(db, "dedicated_staff_id", String(staffId), ownerId);
  return `Dedicated staff assigned: ${await describeTelegramUser(db, staffId)}`;
}

export async function getDedicatedStaffId(db?: D1Database): Promise<number | null> {
  const raw = await getBotSetting(db, "dedicated_staff_id");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

export async function getHandoffDestination(
  db?: D1Database,
): Promise<{ route: "group" | "dedicated"; chatId: number } | null> {
  if (!db) return null;
  const mode = await getHandoffRoute(db);
  const groupChatId = await getStaffInboxChatId(db);
  const dedicatedStaffId = await getDedicatedStaffId(db);

  if (mode === "group") return groupChatId ? { route: "group", chatId: groupChatId } : null;
  if (mode === "dedicated") return dedicatedStaffId ? { route: "dedicated", chatId: dedicatedStaffId } : null;
  if (groupChatId) return { route: "group", chatId: groupChatId };
  if (dedicatedStaffId) return { route: "dedicated", chatId: dedicatedStaffId };
  return null;
}

export async function listStaffMembers(db: D1Database | undefined): Promise<string> {
  if (!db) return "D1 is not bound.";
  const rows = await db.prepare(
    `SELECT telegram_user_id FROM staff_members WHERE active=1 ORDER BY added_at ASC`,
  ).all<{ telegram_user_id: number }>();
  if (!(rows.results ?? []).length) return "Active staff: none";
  const lines = ["Active staff:"];
  for (const row of rows.results ?? []) lines.push(`- ${await describeTelegramUser(db, row.telegram_user_id)}`);
  return lines.join("\n");
}

export async function handoffStatus(db?: D1Database): Promise<string> {
  if (!db) return "D1 is not bound.";
  const route = await getHandoffRoute(db);
  const group = await getStaffInboxChatId(db);
  const dedicated = await getDedicatedStaffId(db);
  return [
    "Human Handoff Settings",
    `Route: ${route}`,
    `Staff Inbox chat ID: ${group ?? "not configured"}`,
    `Dedicated staff: ${dedicated ? await describeTelegramUser(db, dedicated) : "not configured"}`,
    "",
    await listStaffMembers(db),
  ].join("\n");
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
  return `Staff member enabled: ${await describeTelegramUser(db, staffId)}`;
}

export async function removeStaffMember(
  db: D1Database | undefined,
  staffId: number,
): Promise<string> {
  if (!db) return "D1 is not bound.";
  const label = await describeTelegramUser(db, staffId);
  await db.prepare(`UPDATE staff_members SET active=0 WHERE telegram_user_id=?1`).bind(staffId).run();
  return `Staff member disabled: ${label}`;
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
    reason?: string | null;
    staffChatId?: number | null;
  },
): Promise<number | null> {
  if (!db) return null;
  const result = await db.prepare(
    `INSERT INTO escalation_cases
      (telegram_user_id, source_question_id, language, user_question, reason, staff_chat_id, status)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'open')`,
  ).bind(
    input.telegramUserId,
    input.sourceQuestionId ?? null,
    input.language ?? null,
    input.question,
    input.reason ?? null,
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
  if (!(await isStaffMember(db, staffId))) return { ok: false, message: "Not authorized for human handoff." };

  const result = await db.prepare(
    `UPDATE escalation_cases
     SET status='claimed', claimed_by=?1, claimed_at=CURRENT_TIMESTAMP
     WHERE id=?2 AND status='open' AND claimed_by IS NULL`,
  ).bind(staffId, caseId).run();

  if ((result.meta.changes ?? 0) === 1) return { ok: true, message: `Case #${caseId} claimed by ${await describeTelegramUser(db, staffId)}` };

  const current = await db.prepare(
    `SELECT status, claimed_by FROM escalation_cases WHERE id=?1`,
  ).bind(caseId).first<{ status: string; claimed_by: number | null }>();
  if (!current) return { ok: false, message: `Case #${caseId} not found.` };
  if (current.claimed_by === staffId) return { ok: true, message: `You already own Case #${caseId}.` };
  return {
    ok: false,
    message: current.claimed_by
      ? `Case #${caseId} is already claimed by ${await describeTelegramUser(db, current.claimed_by)}`
      : `Case #${caseId} is already claimed.`,
  };
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
    ? { ok: true, message: `Case #${caseId} resolved by ${await describeTelegramUser(db, staffId)}` }
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
