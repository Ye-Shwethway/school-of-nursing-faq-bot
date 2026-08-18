import { getAdminRole, type AdminRole } from "./admin";
import type { FaqEntry, Language } from "./faq";
import { generateFaqTranslations, type FaqAuthoringEnv } from "./faq_authoring_ai";
import {
  createFaq,
  getFaq,
  listFaqs,
  setFaqActive,
  updateFaq,
  type FaqMutationResult,
} from "./faq_store";

export type FaqUiResponse = {
  handled: boolean;
  text?: string;
  keyboard?: unknown;
  mutation?: FaqMutationResult;
};

type EditField =
  | "question_my" | "answer_my"
  | "question_en" | "answer_en"
  | "question_zh" | "answer_zh"
  | "keywords_my" | "keywords_en" | "keywords_zh";

type FaqListMode = "active" | "inactive";
type DraftMode = "create" | "edit";

type DraftPayload = {
  mode: DraftMode;
  key?: string;
  caseId?: number;
  sourceLanguage: Language;
  question?: Partial<Record<Language, string>>;
  answer?: Partial<Record<Language, string>>;
  manualLanguages?: Language[];
  manualIndex?: number;
  aiSource?: "primary" | "fallback";
};

const FAQ_PAGE_SIZE = 8;
const COMPACT_LABEL_LENGTH = 26;
const LANGUAGES: Language[] = ["my", "en", "zh"];
const LANGUAGE_LABEL: Record<Language, string> = {
  my: "မြန်မာ",
  en: "English",
  zh: "简体中文",
};

const EDIT_FIELDS: Array<{ id: EditField; label: string }> = [
  { id: "question_my", label: "MY Question" },
  { id: "answer_my", label: "MY Answer" },
  { id: "question_en", label: "EN Question" },
  { id: "answer_en", label: "EN Answer" },
  { id: "question_zh", label: "ZH Question" },
  { id: "answer_zh", label: "ZH Answer" },
  { id: "keywords_my", label: "MY Keywords" },
  { id: "keywords_en", label: "EN Keywords" },
  { id: "keywords_zh", label: "ZH Keywords" },
];

const PUBLIC_COPY: Record<Language, {
  title: string;
  intro: string;
  available: (count: number) => string;
  empty: string;
  back: string;
}> = {
  my: {
    title: "School of Nursing FAQ များ",
    intro: "ဖတ်ရှုလိုသော မေးခွန်းကို အောက်တွင် ရွေးချယ်ပါ။",
    available: (count) => `အတည်ပြုထားသော FAQ ${count} ခု ရှိပါသည်။`,
    empty: "လက်ရှိ ဖတ်ရှုနိုင်သော FAQ မရှိသေးပါ။",
    back: "← FAQ စာရင်း",
  },
  en: {
    title: "School of Nursing FAQs",
    intro: "Choose a question below to read the approved answer.",
    available: (count) => `${count} approved FAQs available.`,
    empty: "No FAQs are currently available.",
    back: "← FAQ List",
  },
  zh: {
    title: "护理学院常见问题",
    intro: "请选择下方问题以查看已批准的答案。",
    available: (count) => `共有 ${count} 条已批准的常见问题。`,
    empty: "目前没有可查看的常见问题。",
    back: "← 常见问题列表",
  },
};

function adminMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "Browse FAQs", callback_data: "faq:list:0" }],
      [
        { text: "＋ Add FAQ", callback_data: "faq:add" },
        { text: "Inactive FAQs", callback_data: "faq:inactive:0" },
      ],
      [{ text: "Help", callback_data: "faq:help" }],
    ],
  };
}

function faqKeyboard(key: string, active: boolean, page = 0, mode: FaqListMode = "active") {
  return {
    inline_keyboard: [
      [{ text: "✨ Edit from one language", callback_data: `faq:editai:${key}` }],
      [{ text: "Edit individual fields", callback_data: `faq:edit:${key}` }],
      [active
        ? { text: "Disable", callback_data: `faq:disable:${key}` }
        : { text: "Restore", callback_data: `faq:restore:${key}` }],
      [{ text: "← Back", callback_data: `faq:${mode === "inactive" ? "inactive" : "list"}:${page}` }],
    ],
  };
}

function editKeyboard(key: string) {
  return {
    inline_keyboard: [
      ...EDIT_FIELDS.map((field) => [{ text: field.label, callback_data: `faq:field:${key}:${field.id}` }]),
      [{ text: "← Back", callback_data: `faq:view:${key}:active:0` }],
    ],
  };
}

function sourceLanguageKeyboard(prefix: "add" | "edit", key?: string) {
  return {
    inline_keyboard: [
      LANGUAGES.map((language) => ({
        text: LANGUAGE_LABEL[language],
        callback_data: prefix === "add"
          ? `faq:addlang:${language}`
          : `faq:editlang:${key}:${language}`,
      })),
      [{ text: "← FAQ Management", callback_data: "faq:menu" }],
    ],
  };
}

function draftActionKeyboard(canApprove: boolean) {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [
    [{ text: "✨ Generate other 2 languages", callback_data: "faq:draft:generate" }],
    [{ text: "✍ Fill/Edit translations manually", callback_data: "faq:draft:manual" }],
  ];
  if (canApprove) rows.unshift([{ text: "✅ Approve & Save", callback_data: "faq:draft:approve" }]);
  rows.push([{ text: "✕ Discard Draft", callback_data: "faq:draft:discard" }]);
  return { inline_keyboard: rows };
}

function slugify(value: string): string {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function deriveKeywords(question: string): string[] {
  const words = question
    .toLocaleLowerCase()
    .replace(/[.,!?;:()\[\]{}'\"“”‘’၊။—–_-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3);
  return [...new Set(words)].slice(0, 12);
}

function cleanButtonLabel(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 48) return normalized;
  return `${normalized.slice(0, 47).trimEnd()}…`;
}

function adminEntryText(entry: Awaited<ReturnType<typeof getFaq>> extends infer T ? Exclude<T, null> : never): string {
  return [
    `FAQ · ${entry.question.en}`,
    `Key: ${entry.key}`,
    `Version: ${entry.version} · ${entry.active ? "Active" : "Inactive"}`,
    "",
    `MY Q: ${entry.question.my}`,
    `MY A: ${entry.answer.my}`,
    "",
    `EN Q: ${entry.question.en}`,
    `EN A: ${entry.answer.en}`,
    "",
    `ZH Q: ${entry.question.zh}`,
    `ZH A: ${entry.answer.zh}`,
  ].join("\n");
}

function publicEntryText(
  entry: Awaited<ReturnType<typeof getFaq>> extends infer T ? Exclude<T, null> : never,
  language: Language,
): string {
  return `${entry.question[language]}\n\n${entry.answer[language]}`;
}

function draftPreview(payload: DraftPayload): string {
  const question = payload.question ?? {};
  const answer = payload.answer ?? {};
  return [
    payload.mode === "create" ? "FAQ Draft — Review before publishing" : `FAQ Edit Draft — ${payload.key}`,
    payload.caseId ? `Source escalation: #${payload.caseId}` : null,
    `Authoritative source language: ${LANGUAGE_LABEL[payload.sourceLanguage]}`,
    payload.aiSource ? `Translation draft: AI ${payload.aiSource}` : null,
    "",
    `MY Q: ${question.my ?? "—"}`,
    `MY A: ${answer.my ?? "—"}`,
    "",
    `EN Q: ${question.en ?? "—"}`,
    `EN A: ${answer.en ?? "—"}`,
    "",
    `ZH Q: ${question.zh ?? "—"}`,
    `ZH A: ${answer.zh ?? "—"}`,
    "",
    "Nothing becomes canonical until Approve & Save is pressed.",
  ].filter((line) => line !== null).join("\n");
}

function draftComplete(payload: DraftPayload): boolean {
  return LANGUAGES.every((language) => Boolean(payload.question?.[language]?.trim() && payload.answer?.[language]?.trim()));
}

async function roleFor(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue?: string,
): Promise<AdminRole> {
  return getAdminRole(db, userId, ownerIdValue);
}

function isAdminRole(role: AdminRole): boolean {
  return role === "owner" || role === "sudo_admin";
}

async function authorized(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue?: string,
): Promise<boolean> {
  return isAdminRole(await roleFor(db, userId, ownerIdValue));
}

async function uiLanguage(db: D1Database, userId: number): Promise<Language> {
  const row = await db.prepare(
    `SELECT language FROM users WHERE telegram_user_id=?1`,
  ).bind(userId).first<{ language: string | null }>();
  return row?.language === "my" || row?.language === "zh" ? row.language : "en";
}

async function buildFaqListUi(
  db: D1Database,
  userId: number,
  role: AdminRole,
  mode: FaqListMode,
  requestedPage: number,
): Promise<FaqUiResponse> {
  const language = await uiLanguage(db, userId);
  const includeInactive = mode === "inactive";
  const entries = await listFaqs(db, includeInactive);
  const visible = includeInactive
    ? entries.filter((entry) => !entry.active)
    : entries.filter((entry) => entry.active);
  const admin = isAdminRole(role);

  if (includeInactive && !admin) return buildFaqListUi(db, userId, role, "active", 0);

  const pageCount = Math.max(1, Math.ceil(visible.length / FAQ_PAGE_SIZE));
  const page = Math.max(0, Math.min(requestedPage, pageCount - 1));
  const start = page * FAQ_PAGE_SIZE;
  const pageEntries = visible.slice(start, start + FAQ_PAGE_SIZE);
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];

  for (let index = 0; index < pageEntries.length;) {
    const current = pageEntries[index];
    const currentLabel = cleanButtonLabel(current.question[language] || current.question.en || current.key);
    const next = pageEntries[index + 1];
    const nextLabel = next ? cleanButtonLabel(next.question[language] || next.question.en || next.key) : "";
    if (next && currentLabel.length <= COMPACT_LABEL_LENGTH && nextLabel.length <= COMPACT_LABEL_LENGTH) {
      rows.push([
        { text: currentLabel, callback_data: `faq:view:${current.key}:${mode}:${page}` },
        { text: nextLabel, callback_data: `faq:view:${next.key}:${mode}:${page}` },
      ]);
      index += 2;
    } else {
      rows.push([{ text: currentLabel, callback_data: `faq:view:${current.key}:${mode}:${page}` }]);
      index += 1;
    }
  }

  if (pageCount > 1) {
    const nav: Array<{ text: string; callback_data: string }> = [];
    if (page > 0) nav.push({ text: "← Previous", callback_data: `faq:${mode === "inactive" ? "inactive" : "list"}:${page - 1}` });
    nav.push({ text: `${page + 1} / ${pageCount}`, callback_data: `faq:${mode === "inactive" ? "inactive" : "list"}:${page}` });
    if (page < pageCount - 1) nav.push({ text: "Next →", callback_data: `faq:${mode === "inactive" ? "inactive" : "list"}:${page + 1}` });
    rows.push(nav);
  }

  if (admin) rows.push([{ text: "← Management", callback_data: "faq:menu" }]);

  if (admin) {
    return {
      handled: true,
      text: visible.length
        ? `${includeInactive ? "Inactive" : "Active"} FAQs · ${visible.length}\nChoose an FAQ to review${includeInactive ? "." : " or manage."}`
        : `No ${includeInactive ? "inactive" : "active"} FAQs in this view.`,
      keyboard: { inline_keyboard: rows },
    };
  }

  const copy = PUBLIC_COPY[language];
  return {
    handled: true,
    text: visible.length
      ? `${copy.title}\n${copy.available(visible.length)}\n\n${copy.intro}`
      : `${copy.title}\n${copy.empty}`,
    keyboard: { inline_keyboard: rows },
  };
}

async function saveSession(
  db: D1Database,
  userId: number,
  state: string,
  provider: string | null,
  payload: unknown,
) {
  await db.prepare(
    `INSERT INTO admin_sessions (telegram_user_id, state, provider, payload, updated_at)
     VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       state=excluded.state, provider=excluded.provider, payload=excluded.payload, updated_at=CURRENT_TIMESTAMP`,
  ).bind(userId, state, provider, payload == null ? null : JSON.stringify(payload)).run();
}

async function clearSession(db: D1Database, userId: number) {
  await db.prepare(`DELETE FROM admin_sessions WHERE telegram_user_id=?1`).bind(userId).run();
}

async function loadDraftSession(db: D1Database, userId: number): Promise<{ state: string; payload: DraftPayload } | null> {
  const row = await db.prepare(
    `SELECT state, payload FROM admin_sessions WHERE telegram_user_id=?1`,
  ).bind(userId).first<{ state: string; payload: string | null }>();
  if (!row?.payload) return null;
  try { return { state: row.state, payload: JSON.parse(row.payload) as DraftPayload }; } catch { return null; }
}

async function uniqueCaseKey(db: D1Database, caseId: number): Promise<string> {
  for (let i = 0; i < 20; i += 1) {
    const key = i === 0 ? `case-${caseId}` : `case-${caseId}-${i + 1}`;
    if (!await getFaq(db, key)) return key;
  }
  return `case-${caseId}-${Date.now()}`.slice(0, 64);
}

function promptForManualLanguage(language: Language, kind: "question" | "answer"): string {
  return `Manual FAQ translation\nSend the ${LANGUAGE_LABEL[language]} ${kind}.\nThe source-language meaning must not be changed.`;
}

export async function handleFaqCommand(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue: string | undefined,
  text: string,
): Promise<FaqUiResponse> {
  if (!text.trim().toLowerCase().startsWith("/faq")) return { handled: false };
  if (!db) return { handled: true, text: "FAQ storage is temporarily unavailable." };
  const role = await roleFor(db, userId, ownerIdValue);
  if (!isAdminRole(role)) return buildFaqListUi(db, userId, role, "active", 0);
  return {
    handled: true,
    text: "FAQ Knowledge Management\nBrowse approved knowledge or create/edit multilingual FAQs. AI translation is optional; approval is always manual.",
    keyboard: adminMenuKeyboard(),
  };
}

export async function handleFaqCallback(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue: string | undefined,
  data: string,
  aiEnv?: FaqAuthoringEnv,
): Promise<FaqUiResponse> {
  if (!data.startsWith("faq:")) return { handled: false };
  if (!db) return { handled: true, text: "FAQ storage is temporarily unavailable." };

  const role = await roleFor(db, userId, ownerIdValue);
  const admin = isAdminRole(role);

  if (data === "faq:menu") {
    if (!admin) return buildFaqListUi(db, userId, role, "active", 0);
    return { handled: true, text: "FAQ Knowledge Management", keyboard: adminMenuKeyboard() };
  }

  if (data === "faq:help") {
    if (!admin) return buildFaqListUi(db, userId, role, "active", 0);
    return {
      handled: true,
      text: [
        "FAQ Management",
        "• Browse reviews the live public FAQ library.",
        "• Add/Edit from one language creates a draft first; nothing is canonical until Approve & Save.",
        "• AI can translate the authoritative source question/answer into the other two languages.",
        "• AI translation is optional. If unavailable, keep the draft and fill the other languages manually.",
        "• Individual-field editing remains available for precise corrections.",
        "• Disable is a soft delete; Restore reactivates it.",
        "• Every saved mutation creates a revision and notifies Owner/Admins plus Staff Inbox when configured.",
      ].join("\n"),
      keyboard: adminMenuKeyboard(),
    };
  }

  const listMatch = data.match(/^faq:list(?::(\d+))?$/);
  if (listMatch) return buildFaqListUi(db, userId, role, "active", Number(listMatch[1] ?? "0"));

  const inactiveMatch = data.match(/^faq:inactive(?::(\d+))?$/);
  if (inactiveMatch) {
    if (!admin) return buildFaqListUi(db, userId, role, "active", 0);
    return buildFaqListUi(db, userId, role, "inactive", Number(inactiveMatch[1] ?? "0"));
  }

  const view = data.match(/^faq:view:([a-z0-9-]+)(?::(active|inactive):(\d+))?$/);
  if (view) {
    const entry = await getFaq(db, view[1]);
    const mode = (view[2] ?? "active") as FaqListMode;
    const page = Number(view[3] ?? "0");
    if (!entry || (!admin && !entry.active)) return buildFaqListUi(db, userId, role, "active", page);
    if (!admin) {
      const language = await uiLanguage(db, userId);
      return {
        handled: true,
        text: publicEntryText(entry, language),
        keyboard: { inline_keyboard: [[{ text: PUBLIC_COPY[language].back, callback_data: `faq:list:${page}` }]] },
      };
    }
    return { handled: true, text: adminEntryText(entry), keyboard: faqKeyboard(entry.key, entry.active, page, mode) };
  }

  if (!admin) return buildFaqListUi(db, userId, role, "active", 0);

  if (data === "faq:add") {
    await clearSession(db, userId);
    return {
      handled: true,
      text: "Add FAQ\nChoose the language you can author confidently. You only need to write the authoritative question and answer in that language.",
      keyboard: sourceLanguageKeyboard("add"),
    };
  }

  const addLang = data.match(/^faq:addlang:(my|en|zh)$/);
  if (addLang) {
    const sourceLanguage = addLang[1] as Language;
    await saveSession(db, userId, "awaiting_faq_draft_key", null, { mode: "create", sourceLanguage } satisfies DraftPayload);
    return {
      handled: true,
      text: `Add FAQ · Source: ${LANGUAGE_LABEL[sourceLanguage]}\nStep 1/3 — Send a short stable English key, for example: student-medical-costs.`,
    };
  }

  const addCase = data.match(/^faq:addcase:(\d+)$/);
  if (addCase) {
    const caseId = Number(addCase[1]);
    const row = await db.prepare(
      `SELECT id, language, user_question, linked_faq_key FROM escalation_cases WHERE id=?1`,
    ).bind(caseId).first<{ id: number; language: string | null; user_question: string; linked_faq_key: string | null }>();
    if (!row) return { handled: true, text: `Escalation #${caseId} was not found.` };
    if (row.linked_faq_key) {
      const linked = await getFaq(db, row.linked_faq_key);
      if (linked) return { handled: true, text: `Case #${caseId} is already linked to FAQ ${linked.key}.`, keyboard: faqKeyboard(linked.key, linked.active) };
    }
    const sourceLanguage: Language = row.language === "my" || row.language === "zh" ? row.language : "en";
    const key = await uniqueCaseKey(db, caseId);
    const payload: DraftPayload = {
      mode: "create",
      key,
      caseId,
      sourceLanguage,
      question: { [sourceLanguage]: row.user_question },
      answer: {},
    };
    await saveSession(db, userId, "awaiting_faq_draft_answer", null, payload);
    return {
      handled: true,
      text: [
        `Add FAQ from Escalation #${caseId}`,
        `Source: ${LANGUAGE_LABEL[sourceLanguage]}`,
        `Draft key: ${key}`,
        "",
        `Question prefilled: ${row.user_question}`,
        "",
        `Send the approved ${LANGUAGE_LABEL[sourceLanguage]} answer. Nothing will be published yet.`,
      ].join("\n"),
    };
  }

  const editAi = data.match(/^faq:editai:([a-z0-9-]+)$/);
  if (editAi) {
    const entry = await getFaq(db, editAi[1]);
    if (!entry) return { handled: true, text: "FAQ not found." };
    await clearSession(db, userId);
    return {
      handled: true,
      text: `AI-assisted multilingual edit\n${entry.key}\n\nChoose the language you will rewrite as the authoritative source. The current FAQ stays live until you approve the finished draft.`,
      keyboard: sourceLanguageKeyboard("edit", entry.key),
    };
  }

  const editLang = data.match(/^faq:editlang:([a-z0-9-]+):(my|en|zh)$/);
  if (editLang) {
    const entry = await getFaq(db, editLang[1]);
    if (!entry) return { handled: true, text: "FAQ not found." };
    const sourceLanguage = editLang[2] as Language;
    const payload: DraftPayload = { mode: "edit", key: entry.key, sourceLanguage, question: {}, answer: {} };
    await saveSession(db, userId, "awaiting_faq_editdraft_question", null, payload);
    return {
      handled: true,
      text: `Edit ${entry.key} · Source: ${LANGUAGE_LABEL[sourceLanguage]}\nStep 1/2 — Send the complete new ${LANGUAGE_LABEL[sourceLanguage]} question.`,
    };
  }

  if (data === "faq:draft:discard") {
    await clearSession(db, userId);
    return { handled: true, text: "FAQ draft discarded. No canonical FAQ data was changed.", keyboard: adminMenuKeyboard() };
  }

  if (data === "faq:draft:generate") {
    const session = await loadDraftSession(db, userId);
    if (!session || (session.state !== "faq_draft_ready" && session.state !== "faq_draft_complete")) {
      return { handled: true, text: "FAQ draft session expired. Open /faq and start again.", keyboard: adminMenuKeyboard() };
    }
    const payload = session.payload;
    const sourceQuestion = payload.question?.[payload.sourceLanguage]?.trim();
    const sourceAnswer = payload.answer?.[payload.sourceLanguage]?.trim();
    if (!sourceQuestion || !sourceAnswer) {
      return { handled: true, text: "The source question/answer is incomplete. Restart the draft from /faq." };
    }
    const result = await generateFaqTranslations(aiEnv ?? { DB: db }, {
      sourceLanguage: payload.sourceLanguage,
      question: sourceQuestion,
      answer: sourceAnswer,
    });
    if (!result.ok) {
      await saveSession(db, userId, "faq_draft_ready", null, payload);
      return {
        handled: true,
        text: [
          "AI translation is unavailable right now.",
          result.reason,
          "",
          "Your source-language draft is still safe. Retry AI or fill the other two languages manually.",
        ].join("\n"),
        keyboard: draftActionKeyboard(false),
      };
    }
    const completed: DraftPayload = {
      ...payload,
      question: result.draft.question,
      answer: result.draft.answer,
      aiSource: result.source,
    };
    await saveSession(db, userId, "faq_draft_complete", null, completed);
    return { handled: true, text: draftPreview(completed), keyboard: draftActionKeyboard(true) };
  }

  if (data === "faq:draft:manual") {
    const session = await loadDraftSession(db, userId);
    if (!session || (session.state !== "faq_draft_ready" && session.state !== "faq_draft_complete")) {
      return { handled: true, text: "FAQ draft session expired. Open /faq and start again." };
    }
    const payload = session.payload;
    const manualLanguages = LANGUAGES.filter((language) => language !== payload.sourceLanguage);
    const next: DraftPayload = { ...payload, manualLanguages, manualIndex: 0, aiSource: undefined };
    await saveSession(db, userId, "awaiting_faq_draft_manual_question", null, next);
    return { handled: true, text: promptForManualLanguage(manualLanguages[0], "question") };
  }

  if (data === "faq:draft:approve") {
    const session = await loadDraftSession(db, userId);
    if (!session || session.state !== "faq_draft_complete" || !draftComplete(session.payload)) {
      return { handled: true, text: "The multilingual draft is incomplete or expired. Complete all three languages before saving." };
    }
    const payload = session.payload;
    const question = payload.question as Record<Language, string>;
    const answer = payload.answer as Record<Language, string>;
    const key = String(payload.key ?? "").trim();
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(key)) {
      return { handled: true, text: "FAQ key is invalid. Discard this draft and restart with a short English key." };
    }
    const entry: FaqEntry = {
      key,
      question,
      answer,
      keywords: {
        my: deriveKeywords(question.my),
        en: deriveKeywords(question.en),
        zh: deriveKeywords(question.zh),
      },
    };
    const mutation = payload.mode === "edit"
      ? await updateFaq(db, userId, key, { question: entry.question, answer: entry.answer, keywords: entry.keywords })
      : await createFaq(db, userId, entry);
    if (payload.caseId) {
      await db.prepare(`UPDATE escalation_cases SET linked_faq_key=?2 WHERE id=?1`).bind(payload.caseId, key).run();
    }
    await clearSession(db, userId);
    return {
      handled: true,
      text: payload.mode === "edit"
        ? `FAQ updated and approved: ${key}\nVersion ${mutation.entry.version}\nAll three languages are now canonical.`
        : `FAQ approved and published: ${key}\nVersion ${mutation.entry.version}\nAll three languages are now canonical.${payload.caseId ? `\nLinked to Escalation #${payload.caseId}.` : ""}`,
      keyboard: faqKeyboard(key, mutation.entry.active),
      mutation,
    };
  }

  const edit = data.match(/^faq:edit:([a-z0-9-]+)$/);
  if (edit) {
    const entry = await getFaq(db, edit[1]);
    if (!entry) return { handled: true, text: "FAQ not found." };
    return { handled: true, text: `Choose a field to edit\n${entry.key}`, keyboard: editKeyboard(entry.key) };
  }

  const field = data.match(/^faq:field:([a-z0-9-]+):(question_my|answer_my|question_en|answer_en|question_zh|answer_zh|keywords_my|keywords_en|keywords_zh)$/);
  if (field) {
    await saveSession(db, userId, "awaiting_faq_edit_value", field[1], { field: field[2] });
    return {
      handled: true,
      text: field[2].startsWith("keywords_") ? "Send comma-separated keywords for this language." : `Send the new value for ${field[2]}.`,
    };
  }

  const disable = data.match(/^faq:disable:([a-z0-9-]+)$/);
  if (disable) {
    const mutation = await setFaqActive(db, userId, disable[1], false);
    return { handled: true, text: `FAQ disabled: ${mutation.entry.key}\nVersion ${mutation.entry.version}`, keyboard: faqKeyboard(mutation.entry.key, false, 0, "inactive"), mutation };
  }

  const restore = data.match(/^faq:restore:([a-z0-9-]+)$/);
  if (restore) {
    const mutation = await setFaqActive(db, userId, restore[1], true);
    return { handled: true, text: `FAQ restored: ${mutation.entry.key}\nVersion ${mutation.entry.version}`, keyboard: faqKeyboard(mutation.entry.key, true), mutation };
  }

  return { handled: true, text: "Unknown FAQ action.", keyboard: adminMenuKeyboard() };
}

export async function consumeFaqAdminText(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue: string | undefined,
  text: string,
): Promise<FaqUiResponse> {
  if (!db || !(await authorized(db, userId, ownerIdValue))) return { handled: false };

  const session = await db.prepare(
    `SELECT state, provider, payload FROM admin_sessions WHERE telegram_user_id=?1`,
  ).bind(userId).first<{ state: string; provider: string | null; payload: string | null }>();

  if (!session || !session.state.startsWith("awaiting_faq_")) return { handled: false };
  const value = text.trim();
  if (!value) return { handled: true, text: "Value cannot be empty. Send a value or use /faq to restart." };

  if (session.state === "awaiting_faq_edit_value") {
    if (!session.provider || !session.payload) {
      await clearSession(db, userId);
      return { handled: true, text: "Edit session expired. Open /faq and try again." };
    }
    const payload = JSON.parse(session.payload) as { field: EditField };
    const entry = await getFaq(db, session.provider);
    if (!entry) {
      await clearSession(db, userId);
      return { handled: true, text: "FAQ no longer exists." };
    }
    const question = { ...entry.question };
    const answer = { ...entry.answer };
    const keywords = { my: [...entry.keywords.my], en: [...entry.keywords.en], zh: [...entry.keywords.zh] };
    const [kind, langRaw] = payload.field.split("_") as ["question" | "answer" | "keywords", Language];
    if (kind === "question") question[langRaw] = value;
    if (kind === "answer") answer[langRaw] = value;
    if (kind === "keywords") keywords[langRaw] = value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
    const mutation = await updateFaq(db, userId, entry.key, { question, answer, keywords });
    await clearSession(db, userId);
    return { handled: true, text: `FAQ updated: ${entry.key}\nVersion ${mutation.entry.version}`, keyboard: faqKeyboard(entry.key, mutation.entry.active), mutation };
  }

  let payload: DraftPayload;
  try { payload = session.payload ? JSON.parse(session.payload) as DraftPayload : {} as DraftPayload; } catch {
    await clearSession(db, userId);
    return { handled: true, text: "FAQ draft session expired. Open /faq and try again." };
  }

  if (session.state === "awaiting_faq_draft_key") {
    const key = slugify(value) || value;
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(key)) {
      return { handled: true, text: "Use a short stable English key containing letters, numbers, and hyphens only." };
    }
    if (await getFaq(db, key)) return { handled: true, text: `FAQ key '${key}' already exists. Send a different key.` };
    payload.key = key;
    payload.question = {};
    payload.answer = {};
    await saveSession(db, userId, "awaiting_faq_draft_question", null, payload);
    return { handled: true, text: `Add FAQ · Source: ${LANGUAGE_LABEL[payload.sourceLanguage]}\nStep 2/3 — Send the authoritative ${LANGUAGE_LABEL[payload.sourceLanguage]} question.` };
  }

  if (session.state === "awaiting_faq_draft_question" || session.state === "awaiting_faq_editdraft_question") {
    payload.question = { ...(payload.question ?? {}), [payload.sourceLanguage]: value };
    await saveSession(db, userId, "awaiting_faq_draft_answer", null, payload);
    return { handled: true, text: `Step ${payload.mode === "create" ? "3/3" : "2/2"} — Send the authoritative ${LANGUAGE_LABEL[payload.sourceLanguage]} answer.` };
  }

  if (session.state === "awaiting_faq_draft_answer") {
    payload.answer = { ...(payload.answer ?? {}), [payload.sourceLanguage]: value };
    await saveSession(db, userId, "faq_draft_ready", null, payload);
    return {
      handled: true,
      text: draftPreview(payload),
      keyboard: draftActionKeyboard(false),
    };
  }

  if (session.state === "awaiting_faq_draft_manual_question") {
    const languages = payload.manualLanguages ?? LANGUAGES.filter((language) => language !== payload.sourceLanguage);
    const index = Math.max(0, Math.min(payload.manualIndex ?? 0, languages.length - 1));
    const language = languages[index];
    payload.question = { ...(payload.question ?? {}), [language]: value };
    payload.manualLanguages = languages;
    payload.manualIndex = index;
    await saveSession(db, userId, "awaiting_faq_draft_manual_answer", null, payload);
    return { handled: true, text: promptForManualLanguage(language, "answer") };
  }

  if (session.state === "awaiting_faq_draft_manual_answer") {
    const languages = payload.manualLanguages ?? LANGUAGES.filter((language) => language !== payload.sourceLanguage);
    const index = Math.max(0, Math.min(payload.manualIndex ?? 0, languages.length - 1));
    const language = languages[index];
    payload.answer = { ...(payload.answer ?? {}), [language]: value };
    const nextIndex = index + 1;
    if (nextIndex < languages.length) {
      payload.manualIndex = nextIndex;
      await saveSession(db, userId, "awaiting_faq_draft_manual_question", null, payload);
      return { handled: true, text: promptForManualLanguage(languages[nextIndex], "question") };
    }
    payload.manualIndex = undefined;
    payload.manualLanguages = undefined;
    await saveSession(db, userId, "faq_draft_complete", null, payload);
    return { handled: true, text: draftPreview(payload), keyboard: draftActionKeyboard(true) };
  }

  await clearSession(db, userId);
  return { handled: true, text: "FAQ session expired. Open /faq and try again." };
}
