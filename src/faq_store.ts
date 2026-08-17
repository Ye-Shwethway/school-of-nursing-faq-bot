import { FAQS, type FaqEntry, type Language } from "./faq";

export type StoredFaqEntry = FaqEntry & {
  active: boolean;
  version: number;
  createdBy: number | null;
  updatedBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type FaqMutationAction = "create" | "update" | "disable" | "restore";

export type FaqMutationResult = {
  action: FaqMutationAction;
  entry: StoredFaqEntry;
  before: StoredFaqEntry | null;
};

const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[.,!?;:()\[\]{}'\"“”‘’၊။—–_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function parseKeywords(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function rowToFaq(row: {
  faq_key: string;
  question_my: string;
  answer_my: string;
  question_en: string;
  answer_en: string;
  question_zh: string;
  answer_zh: string;
  keywords_my: string;
  keywords_en: string;
  keywords_zh: string;
  active: number;
  version: number;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}): StoredFaqEntry {
  return {
    key: row.faq_key,
    question: { my: row.question_my, en: row.question_en, zh: row.question_zh },
    answer: { my: row.answer_my, en: row.answer_en, zh: row.answer_zh },
    keywords: {
      my: parseKeywords(row.keywords_my),
      en: parseKeywords(row.keywords_en),
      zh: parseKeywords(row.keywords_zh),
    },
    active: row.active === 1,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_FIELDS = `faq_key, question_my, answer_my, question_en, answer_en, question_zh, answer_zh,
  keywords_my, keywords_en, keywords_zh, active, version, created_by, updated_by, created_at, updated_at`;

export async function ensureFaqSeeded(db: D1Database): Promise<void> {
  const count = await db.prepare(`SELECT COUNT(*) AS count FROM faq_entries`).first<{ count: number }>();
  if ((count?.count ?? 0) > 0) return;

  for (const entry of FAQS) {
    await db.prepare(
      `INSERT OR IGNORE INTO faq_entries
        (faq_key, question_my, answer_my, question_en, answer_en, question_zh, answer_zh,
         keywords_my, keywords_en, keywords_zh, active, version)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, 1)`,
    ).bind(
      entry.key,
      entry.question.my,
      entry.answer.my,
      entry.question.en,
      entry.answer.en,
      entry.question.zh,
      entry.answer.zh,
      JSON.stringify(entry.keywords.my),
      JSON.stringify(entry.keywords.en),
      JSON.stringify(entry.keywords.zh),
    ).run();
  }
}

export async function listFaqs(db: D1Database, includeInactive = false): Promise<StoredFaqEntry[]> {
  await ensureFaqSeeded(db);
  const rows = await db.prepare(
    `SELECT ${SELECT_FIELDS} FROM faq_entries ${includeInactive ? "" : "WHERE active=1"} ORDER BY faq_key`,
  ).all<any>();
  return (rows.results ?? []).map(rowToFaq);
}

export async function getFaq(db: D1Database, key: string): Promise<StoredFaqEntry | null> {
  await ensureFaqSeeded(db);
  const row = await db.prepare(
    `SELECT ${SELECT_FIELDS} FROM faq_entries WHERE faq_key=?1`,
  ).bind(key).first<any>();
  return row ? rowToFaq(row) : null;
}

function scoreEntry(entry: StoredFaqEntry, input: string, language: Language): number {
  const normalized = normalize(input);
  const question = normalize(entry.question[language]);
  if (normalized === question) return 100;
  if (normalized.includes(question) || question.includes(normalized)) return 30;

  let score = 0;
  for (const keyword of entry.keywords[language]) {
    const k = normalize(keyword);
    if (k && normalized.includes(k)) score += k.length >= 5 ? 4 : 2;
  }
  return score;
}

export async function findFaqDynamic(
  db: D1Database,
  input: string,
  language: Language,
): Promise<StoredFaqEntry | null> {
  const entries = await listFaqs(db, false);
  let best: { entry: StoredFaqEntry; score: number } | null = null;
  for (const entry of entries) {
    const score = scoreEntry(entry, input, language);
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= 4 ? best.entry : null;
}

export async function buildApprovedFaqContext(db: D1Database): Promise<string> {
  const entries = await listFaqs(db, false);
  return entries.map((entry) => [
    `[FAQ:${entry.key}; version:${entry.version}]`,
    `MY Q: ${entry.question.my}`,
    `MY A: ${entry.answer.my}`,
    `EN Q: ${entry.question.en}`,
    `EN A: ${entry.answer.en}`,
    `ZH Q: ${entry.question.zh}`,
    `ZH A: ${entry.answer.zh}`,
  ].join("\n")).join("\n\n");
}

async function writeRevision(
  db: D1Database,
  key: string,
  action: FaqMutationAction,
  before: StoredFaqEntry | null,
  after: StoredFaqEntry | null,
  actorId: number,
): Promise<void> {
  await db.prepare(
    `INSERT INTO faq_revisions (faq_key, action, before_json, after_json, actor_telegram_user_id)
     VALUES (?1, ?2, ?3, ?4, ?5)`,
  ).bind(
    key,
    action,
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
    actorId,
  ).run();
}

export async function createFaq(
  db: D1Database,
  actorId: number,
  entry: FaqEntry,
): Promise<FaqMutationResult> {
  await ensureFaqSeeded(db);
  const existing = await getFaq(db, entry.key);
  if (existing) throw new Error("FAQ key already exists");

  await db.prepare(
    `INSERT INTO faq_entries
      (faq_key, question_my, answer_my, question_en, answer_en, question_zh, answer_zh,
       keywords_my, keywords_en, keywords_zh, active, version, created_by, updated_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 1, 1, ?11, ?11)`,
  ).bind(
    entry.key,
    entry.question.my,
    entry.answer.my,
    entry.question.en,
    entry.answer.en,
    entry.question.zh,
    entry.answer.zh,
    JSON.stringify(entry.keywords.my),
    JSON.stringify(entry.keywords.en),
    JSON.stringify(entry.keywords.zh),
    actorId,
  ).run();

  const created = await getFaq(db, entry.key);
  if (!created) throw new Error("FAQ create verification failed");
  await writeRevision(db, entry.key, "create", null, created, actorId);
  return { action: "create", entry: created, before: null };
}

export async function updateFaq(
  db: D1Database,
  actorId: number,
  key: string,
  patch: Partial<Pick<FaqEntry, "question" | "answer" | "keywords">>,
): Promise<FaqMutationResult> {
  const before = await getFaq(db, key);
  if (!before) throw new Error("FAQ not found");

  const next: FaqEntry = {
    key,
    question: patch.question ?? before.question,
    answer: patch.answer ?? before.answer,
    keywords: patch.keywords ?? before.keywords,
  };

  await db.prepare(
    `UPDATE faq_entries SET
       question_my=?2, answer_my=?3, question_en=?4, answer_en=?5, question_zh=?6, answer_zh=?7,
       keywords_my=?8, keywords_en=?9, keywords_zh=?10,
       version=version+1, updated_by=?11, updated_at=CURRENT_TIMESTAMP
     WHERE faq_key=?1`,
  ).bind(
    key,
    next.question.my,
    next.answer.my,
    next.question.en,
    next.answer.en,
    next.question.zh,
    next.answer.zh,
    JSON.stringify(next.keywords.my),
    JSON.stringify(next.keywords.en),
    JSON.stringify(next.keywords.zh),
    actorId,
  ).run();

  const updated = await getFaq(db, key);
  if (!updated) throw new Error("FAQ update verification failed");
  await writeRevision(db, key, "update", before, updated, actorId);
  return { action: "update", entry: updated, before };
}

export async function setFaqActive(
  db: D1Database,
  actorId: number,
  key: string,
  active: boolean,
): Promise<FaqMutationResult> {
  const before = await getFaq(db, key);
  if (!before) throw new Error("FAQ not found");
  const action: FaqMutationAction = active ? "restore" : "disable";

  await db.prepare(
    `UPDATE faq_entries SET active=?2, version=version+1, updated_by=?3, updated_at=CURRENT_TIMESTAMP
     WHERE faq_key=?1`,
  ).bind(key, active ? 1 : 0, actorId).run();

  const updated = await getFaq(db, key);
  if (!updated) throw new Error("FAQ state verification failed");
  await writeRevision(db, key, action, before, updated, actorId);
  return { action, entry: updated, before };
}
