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

export type FaqRepairResult = {
  key: string;
  corruptVersion: number;
  restoredFromVersion: number;
  newVersion: number;
};

const normalize = (value: string) =>
  value
    .toLocaleLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[.,!?;:()\[\]{}'\"“”‘’၊။—–_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const ADMIN_CARD_MARKERS = [
  "FAQ ·",
  "Key:",
  "Version:",
  "MY Q:",
  "MY A:",
  "EN Q:",
  "EN A:",
  "ZH Q:",
  "ZH A:",
];

function suspiciousFaqValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "FAQ question/answer cannot be empty";
  if (/^\/[a-z0-9_]+(?:@[a-z0-9_]+)?$/i.test(trimmed)) {
    return "Telegram command text cannot be saved as FAQ content";
  }
  const markerCount = ADMIN_CARD_MARKERS.filter((marker) => trimmed.includes(marker)).length;
  if (markerCount >= 3 || trimmed.includes("Nothing becomes canonical until Approve & Save is pressed.")) {
    return "Rendered FAQ management text cannot be saved as FAQ content";
  }
  return null;
}

export function faqContentValidationError(entry: Pick<FaqEntry, "question" | "answer">): string | null {
  for (const language of ["my", "en", "zh"] as Language[]) {
    const questionError = suspiciousFaqValue(entry.question[language]);
    if (questionError) return `${language.toUpperCase()} question: ${questionError}`;
    const answerError = suspiciousFaqValue(entry.answer[language]);
    if (answerError) return `${language.toUpperCase()} answer: ${answerError}`;
  }
  return null;
}

function assertValidFaqContent(entry: Pick<FaqEntry, "question" | "answer">): void {
  const error = faqContentValidationError(entry);
  if (error) throw new Error(`FAQ content rejected: ${error}`);
}

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

function parseRevisionSnapshot(raw: string | null, key: string): StoredFaqEntry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredFaqEntry;
    if (!parsed || parsed.key !== key || !parsed.question || !parsed.answer || !parsed.keywords) return null;
    return faqContentValidationError(parsed) ? null : parsed;
  } catch {
    return null;
  }
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
    if (faqContentValidationError(entry)) continue;
    const score = scoreEntry(entry, input, language);
    if (!best || score > best.score) best = { entry, score };
  }
  return best && best.score >= 4 ? best.entry : null;
}

export async function buildApprovedFaqContext(db: D1Database): Promise<string> {
  const entries = (await listFaqs(db, false)).filter((entry) => !faqContentValidationError(entry));
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
  assertValidFaqContent(entry);
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
  assertValidFaqContent(next);

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

export async function repairCorruptedFaqs(
  db: D1Database,
  actorId: number,
): Promise<{ repaired: FaqRepairResult[]; unrecoverable: string[] }> {
  const currentEntries = await listFaqs(db, true);
  const repaired: FaqRepairResult[] = [];
  const unrecoverable: string[] = [];

  for (const current of currentEntries) {
    if (!faqContentValidationError(current)) continue;

    const revisions = await db.prepare(
      `SELECT before_json, after_json FROM faq_revisions
       WHERE faq_key=?1 ORDER BY id DESC`,
    ).bind(current.key).all<{ before_json: string | null; after_json: string | null }>();

    let snapshot: StoredFaqEntry | null = null;
    for (const revision of revisions.results ?? []) {
      snapshot = parseRevisionSnapshot(revision.after_json, current.key)
        ?? parseRevisionSnapshot(revision.before_json, current.key);
      if (snapshot) break;
    }

    if (!snapshot) {
      const seed = FAQS.find((entry) => entry.key === current.key);
      if (seed && !faqContentValidationError(seed)) {
        snapshot = {
          ...seed,
          active: true,
          version: 1,
          createdBy: null,
          updatedBy: null,
          createdAt: current.createdAt,
          updatedAt: current.updatedAt,
        };
      }
    }

    if (!snapshot) {
      unrecoverable.push(current.key);
      continue;
    }

    await db.prepare(
      `UPDATE faq_entries SET
         question_my=?2, answer_my=?3, question_en=?4, answer_en=?5, question_zh=?6, answer_zh=?7,
         keywords_my=?8, keywords_en=?9, keywords_zh=?10, active=?11,
         version=version+1, updated_by=?12, updated_at=CURRENT_TIMESTAMP
       WHERE faq_key=?1`,
    ).bind(
      current.key,
      snapshot.question.my,
      snapshot.answer.my,
      snapshot.question.en,
      snapshot.answer.en,
      snapshot.question.zh,
      snapshot.answer.zh,
      JSON.stringify(snapshot.keywords.my),
      JSON.stringify(snapshot.keywords.en),
      JSON.stringify(snapshot.keywords.zh),
      snapshot.active ? 1 : 0,
      actorId,
    ).run();

    const after = await getFaq(db, current.key);
    if (!after) {
      unrecoverable.push(current.key);
      continue;
    }
    await writeRevision(db, current.key, "update", current, after, actorId);
    repaired.push({
      key: current.key,
      corruptVersion: current.version,
      restoredFromVersion: snapshot.version,
      newVersion: after.version,
    });
  }

  return { repaired, unrecoverable };
}
