import { getAdminRole } from "./admin";
import { findFaqDynamic } from "./faq_store";
import type { Language } from "./faq";

export type CasesUiResponse = {
  handled: boolean;
  text?: string;
  keyboard?: unknown;
};

type CaseFilter = "open" | "claimed" | "resolved" | "all";

type CaseRow = {
  id: number;
  telegram_user_id: number;
  language: string | null;
  user_question: string;
  reason: string | null;
  status: string;
  claimed_by: number | null;
  created_at: string;
  resolved_at: string | null;
  linked_faq_key: string | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
};

const PAGE_SIZE = 6;

function isAdminRole(role: string): boolean {
  return role === "owner" || role === "sudo_admin";
}

function normalizeLanguage(value: string | null): Language {
  return value === "my" || value === "zh" ? value : "en";
}

function compact(value: string, max = 42): string {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

function userLabel(row: CaseRow): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  const username = row.username ? ` (@${row.username})` : "";
  return `${name || "Unknown user"}${username} · ID ${row.telegram_user_id}`;
}

function statusWhere(filter: CaseFilter): { clause: string; value?: string } {
  if (filter === "all") return { clause: "" };
  return { clause: "WHERE ec.status=?1", value: filter };
}

async function roleAllowed(db: D1Database | undefined, userId: number, ownerIdValue?: string): Promise<boolean> {
  return isAdminRole(await getAdminRole(db, userId, ownerIdValue));
}

async function counts(db: D1Database): Promise<Record<string, number>> {
  const rows = await db.prepare(
    `SELECT status, COUNT(*) AS count FROM escalation_cases GROUP BY status`,
  ).all<{ status: string; count: number }>();
  const result: Record<string, number> = { open: 0, claimed: 0, resolved: 0, closed: 0 };
  for (const row of rows.results ?? []) result[row.status] = Number(row.count ?? 0);
  return result;
}

function menuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Open", callback_data: "cases:list:open:0" },
        { text: "Claimed", callback_data: "cases:list:claimed:0" },
      ],
      [
        { text: "Resolved", callback_data: "cases:list:resolved:0" },
        { text: "All", callback_data: "cases:list:all:0" },
      ],
      [{ text: "✕ Close", callback_data: "ui:close" }],
    ],
  };
}

async function menu(db: D1Database): Promise<CasesUiResponse> {
  const c = await counts(db);
  const total = c.open + c.claimed + c.resolved + c.closed;
  return {
    handled: true,
    text: [
      "FAQ Escalation Inbox",
      "",
      `Open: ${c.open} · Claimed: ${c.claimed} · Resolved: ${c.resolved}`,
      `All cases: ${total}`,
      "",
      "Review unanswered questions and turn recurring knowledge gaps into approved FAQs.",
    ].join("\n"),
    keyboard: menuKeyboard(),
  };
}

async function listCases(db: D1Database, filter: CaseFilter, requestedPage: number): Promise<CasesUiResponse> {
  const where = statusWhere(filter);
  const countRow = where.value
    ? await db.prepare(`SELECT COUNT(*) AS count FROM escalation_cases ec ${where.clause}`).bind(where.value).first<{ count: number }>()
    : await db.prepare(`SELECT COUNT(*) AS count FROM escalation_cases ec`).first<{ count: number }>();
  const total = Number(countRow?.count ?? 0);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.max(0, Math.min(requestedPage, pages - 1));
  const offset = page * PAGE_SIZE;

  const sql = `SELECT ec.id, ec.telegram_user_id, ec.language, ec.user_question, ec.reason, ec.status,
      ec.claimed_by, ec.created_at, ec.resolved_at, ec.linked_faq_key,
      u.username, u.first_name, u.last_name
    FROM escalation_cases ec
    LEFT JOIN users u ON u.telegram_user_id=ec.telegram_user_id
    ${where.clause}
    ORDER BY ec.created_at DESC, ec.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}`;
  const rows = where.value
    ? await db.prepare(sql).bind(where.value).all<CaseRow>()
    : await db.prepare(sql).all<CaseRow>();

  const buttons: Array<Array<{ text: string; callback_data: string }>> = (rows.results ?? []).map((row) => [{
    text: `#${row.id} · ${compact(row.user_question)}`,
    callback_data: `cases:view:${row.id}:${filter}:${page}`,
  }]);

  if (pages > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (page > 0) nav.push({ text: "← Previous", callback_data: `cases:list:${filter}:${page - 1}` });
    nav.push({ text: `${page + 1} / ${pages}`, callback_data: `cases:list:${filter}:${page}` });
    if (page < pages - 1) nav.push({ text: "Next →", callback_data: `cases:list:${filter}:${page + 1}` });
    buttons.push(nav);
  }
  buttons.push([{ text: "← Inbox", callback_data: "cases:menu" }]);
  buttons.push([{ text: "✕ Close", callback_data: "ui:close" }]);

  return {
    handled: true,
    text: total
      ? `${filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)} escalation cases · ${total}\nChoose a case to review.`
      : `No ${filter === "all" ? "" : `${filter} `}escalation cases found.`,
    keyboard: { inline_keyboard: buttons },
  };
}

async function getCase(db: D1Database, id: number): Promise<CaseRow | null> {
  return db.prepare(
    `SELECT ec.id, ec.telegram_user_id, ec.language, ec.user_question, ec.reason, ec.status,
       ec.claimed_by, ec.created_at, ec.resolved_at, ec.linked_faq_key,
       u.username, u.first_name, u.last_name
     FROM escalation_cases ec
     LEFT JOIN users u ON u.telegram_user_id=ec.telegram_user_id
     WHERE ec.id=?1`,
  ).bind(id).first<CaseRow>();
}

function caseKeyboard(row: CaseRow, filter: CaseFilter, page: number) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  rows.push([
    { text: "＋ Add as FAQ", callback_data: `faq:addcase:${row.id}` },
    { text: "Find Related FAQ", callback_data: `cases:related:${row.id}:${filter}:${page}` },
  ]);
  if (row.linked_faq_key) {
    rows.push([{ text: `Open linked FAQ · ${row.linked_faq_key}`, callback_data: `faq:view:${row.linked_faq_key}:active:0` }]);
  }
  rows.push([{ text: "🗑 Delete Case", callback_data: `cases:delete:${row.id}:${filter}:${page}` }]);
  rows.push([{ text: "← Cases", callback_data: `cases:list:${filter}:${page}` }]);
  rows.push([{ text: "✕ Close", callback_data: "ui:close" }]);
  return { inline_keyboard: rows };
}

function deleteConfirmKeyboard(id: number, filter: CaseFilter, page: number) {
  return {
    inline_keyboard: [
      [{ text: "🗑 Yes, Delete Permanently", callback_data: `cases:deleteconfirm:${id}:${filter}:${page}` }],
      [{ text: "← Cancel", callback_data: `cases:view:${id}:${filter}:${page}` }],
      [{ text: "✕ Close", callback_data: "ui:close" }],
    ],
  };
}

async function caseDetail(db: D1Database, id: number, filter: CaseFilter, page: number): Promise<CasesUiResponse> {
  const row = await getCase(db, id);
  if (!row) return { handled: true, text: `Escalation #${id} was not found.`, keyboard: menuKeyboard() };
  const reason = row.reason?.trim() || "Approved FAQ/AI could not answer this safely; detailed reason was not stored for this older case.";
  return {
    handled: true,
    text: [
      `Escalation #${row.id}`,
      `Status: ${row.status}`,
      `Language: ${normalizeLanguage(row.language)}`,
      `User: ${userLabel(row)}`,
      `Created: ${row.created_at}`,
      row.claimed_by ? `Claimed by Telegram ID: ${row.claimed_by}` : null,
      row.linked_faq_key ? `Linked FAQ: ${row.linked_faq_key}` : null,
      "",
      `Reason: ${reason}`,
      "",
      "Question",
      row.user_question,
      "",
      row.status === "open" ? "To take over the live conversation, use the Take Over button on the original Staff Inbox escalation message." : null,
    ].filter((line) => line !== null).join("\n"),
    keyboard: caseKeyboard(row, filter, page),
  };
}

async function deleteConfirm(db: D1Database, id: number, filter: CaseFilter, page: number): Promise<CasesUiResponse> {
  const row = await getCase(db, id);
  if (!row) return { handled: true, text: `Escalation #${id} was not found.`, keyboard: menuKeyboard() };
  return {
    handled: true,
    text: [
      `Delete Escalation #${row.id}?`,
      "",
      compact(row.user_question, 180),
      "",
      "This permanently removes this case and its escalation-message history from the Escalation Inbox.",
      "The user record, source question log, and any FAQ already created from this case are not deleted.",
      "",
      "This action cannot be undone.",
    ].join("\n"),
    keyboard: deleteConfirmKeyboard(id, filter, page),
  };
}

async function deleteCase(db: D1Database, id: number, filter: CaseFilter, page: number): Promise<CasesUiResponse> {
  const row = await getCase(db, id);
  if (!row) return listCases(db, filter, page);

  await db.batch([
    db.prepare(`DELETE FROM escalation_messages WHERE case_id=?1`).bind(id),
    db.prepare(`DELETE FROM escalation_cases WHERE id=?1`).bind(id),
  ]);

  const result = await listCases(db, filter, page);
  return {
    ...result,
    text: `Escalation #${id} deleted permanently.\n\n${result.text ?? ""}`.trim(),
  };
}

async function relatedFaq(db: D1Database, id: number, filter: CaseFilter, page: number): Promise<CasesUiResponse> {
  const row = await getCase(db, id);
  if (!row) return { handled: true, text: `Escalation #${id} was not found.`, keyboard: menuKeyboard() };
  const language = normalizeLanguage(row.language);
  let match = null;
  try { match = await findFaqDynamic(db, row.user_question, language); } catch { match = null; }
  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  if (match) buttons.push([{ text: `Review/Edit · ${match.key}`, callback_data: `faq:view:${match.key}:active:0` }]);
  buttons.push([{ text: "Browse all FAQs", callback_data: "faq:list:0" }]);
  buttons.push([{ text: "＋ Add as new FAQ", callback_data: `faq:addcase:${id}` }]);
  buttons.push([{ text: "← Case", callback_data: `cases:view:${id}:${filter}:${page}` }]);
  buttons.push([{ text: "✕ Close", callback_data: "ui:close" }]);
  return {
    handled: true,
    text: match
      ? `Related FAQ candidate for Case #${id}\n\n${match.question[language]}\n\nReview it before editing; deterministic matching found this as the closest current FAQ.`
      : `No current FAQ matched Case #${id} closely enough.\n\nYou can browse existing FAQs or start a new FAQ draft from this case.`,
    keyboard: { inline_keyboard: buttons },
  };
}

export async function handleCasesCommand(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue: string | undefined,
  text: string,
): Promise<CasesUiResponse> {
  if (!text.trim().toLowerCase().startsWith("/cases")) return { handled: false };
  if (!db) return { handled: true, text: "Escalation storage is temporarily unavailable." };
  if (!await roleAllowed(db, userId, ownerIdValue)) {
    return { handled: true, text: "Escalation Inbox is available to the Bot Owner and Sudo Admins only." };
  }
  return menu(db);
}

export async function handleCasesCallback(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue: string | undefined,
  data: string,
): Promise<CasesUiResponse> {
  if (!data.startsWith("cases:")) return { handled: false };
  if (!db) return { handled: true, text: "Escalation storage is temporarily unavailable." };
  if (!await roleAllowed(db, userId, ownerIdValue)) {
    return { handled: true, text: "Escalation Inbox is available to Owner/Sudo only." };
  }
  if (data === "cases:menu") return menu(db);
  const list = data.match(/^cases:list:(open|claimed|resolved|all):(\d+)$/);
  if (list) return listCases(db, list[1] as CaseFilter, Number(list[2]));
  const view = data.match(/^cases:view:(\d+):(open|claimed|resolved|all):(\d+)$/);
  if (view) return caseDetail(db, Number(view[1]), view[2] as CaseFilter, Number(view[3]));
  const related = data.match(/^cases:related:(\d+):(open|claimed|resolved|all):(\d+)$/);
  if (related) return relatedFaq(db, Number(related[1]), related[2] as CaseFilter, Number(related[3]));
  const deletePrompt = data.match(/^cases:delete:(\d+):(open|claimed|resolved|all):(\d+)$/);
  if (deletePrompt) return deleteConfirm(db, Number(deletePrompt[1]), deletePrompt[2] as CaseFilter, Number(deletePrompt[3]));
  const deleteConfirmed = data.match(/^cases:deleteconfirm:(\d+):(open|claimed|resolved|all):(\d+)$/);
  if (deleteConfirmed) return deleteCase(db, Number(deleteConfirmed[1]), deleteConfirmed[2] as CaseFilter, Number(deleteConfirmed[3]));
  return { handled: true, text: "Unknown Escalation Inbox action.", keyboard: menuKeyboard() };
}
