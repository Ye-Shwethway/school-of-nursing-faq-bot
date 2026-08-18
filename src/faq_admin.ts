import { getAdminRole, type AdminRole } from "./admin";
import type { FaqEntry, Language } from "./faq";
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

const FAQ_PAGE_SIZE = 8;
const COMPACT_LABEL_LENGTH = 26;

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
      [{ text: "Edit", callback_data: `faq:edit:${key}` }],
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

  if (includeInactive && !admin) {
    return buildFaqListUi(db, userId, role, "active", 0);
  }

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
    text: "FAQ Knowledge Management\nBrowse the public FAQ library or manage approved knowledge.",
    keyboard: adminMenuKeyboard(),
  };
}

export async function handleFaqCallback(
  db: D1Database | undefined,
  userId: number,
  ownerIdValue: string | undefined,
  data: string,
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
        "• Add creates a new live FAQ after the multilingual wizard completes.",
        "• Edit changes one field at a time.",
        "• Disable is a soft delete; Restore reactivates it.",
        "• Every mutation creates a revision and notifies Owner/Admins plus Staff Inbox when configured.",
        "• Active D1 FAQs are the runtime knowledge source for deterministic matching and AI grounding.",
      ].join("\n"),
      keyboard: adminMenuKeyboard(),
    };
  }

  const listMatch = data.match(/^faq:list(?::(\d+))?$/);
  if (listMatch) {
    return buildFaqListUi(db, userId, role, "active", Number(listMatch[1] ?? "0"));
  }

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
    if (!entry || (!admin && !entry.active)) {
      return buildFaqListUi(db, userId, role, "active", page);
    }

    if (!admin) {
      const language = await uiLanguage(db, userId);
      return {
        handled: true,
        text: publicEntryText(entry, language),
        keyboard: {
          inline_keyboard: [[{
            text: PUBLIC_COPY[language].back,
            callback_data: `faq:list:${page}`,
          }]],
        },
      };
    }

    return {
      handled: true,
      text: adminEntryText(entry),
      keyboard: faqKeyboard(entry.key, entry.active, page, mode),
    };
  }

  if (!admin) {
    return buildFaqListUi(db, userId, role, "active", 0);
  }

  if (data === "faq:add") {
    await saveSession(db, userId, "awaiting_faq_add_key", null, {});
    return {
      handled: true,
      text: "Add FAQ — step 1/7\nSend a short stable key in English, for example: entrance-exam-dates\nOr send a short English title and I will normalize it into a key.",
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
      text: field[2].startsWith("keywords_")
        ? "Send comma-separated keywords for this language."
        : `Send the new value for ${field[2]}.`,
    };
  }

  const disable = data.match(/^faq:disable:([a-z0-9-]+)$/);
  if (disable) {
    const mutation = await setFaqActive(db, userId, disable[1], false);
    return {
      handled: true,
      text: `FAQ disabled: ${mutation.entry.key}\nVersion ${mutation.entry.version}`,
      keyboard: faqKeyboard(mutation.entry.key, false, 0, "inactive"),
      mutation,
    };
  }

  const restore = data.match(/^faq:restore:([a-z0-9-]+)$/);
  if (restore) {
    const mutation = await setFaqActive(db, userId, restore[1], true);
    return {
      handled: true,
      text: `FAQ restored: ${mutation.entry.key}\nVersion ${mutation.entry.version}`,
      keyboard: faqKeyboard(mutation.entry.key, true),
      mutation,
    };
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
    const keywords = {
      my: [...entry.keywords.my],
      en: [...entry.keywords.en],
      zh: [...entry.keywords.zh],
    };

    const [kind, langRaw] = payload.field.split("_") as ["question" | "answer" | "keywords", Language];
    if (kind === "question") question[langRaw] = value;
    if (kind === "answer") answer[langRaw] = value;
    if (kind === "keywords") {
      keywords[langRaw] = value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 20);
    }

    const mutation = await updateFaq(db, userId, entry.key, { question, answer, keywords });
    await clearSession(db, userId);
    return {
      handled: true,
      text: `FAQ updated: ${entry.key}\nVersion ${mutation.entry.version}`,
      keyboard: faqKeyboard(entry.key, mutation.entry.active),
      mutation,
    };
  }

  let payload: any = session.payload ? JSON.parse(session.payload) : {};

  const steps: Record<string, { next: string; field: string; prompt: string }> = {
    awaiting_faq_add_key: { next: "awaiting_faq_add_q_my", field: "key", prompt: "Add FAQ — step 2/7\nSend the Burmese question." },
    awaiting_faq_add_q_my: { next: "awaiting_faq_add_a_my", field: "q_my", prompt: "Add FAQ — step 3/7\nSend the Burmese answer." },
    awaiting_faq_add_a_my: { next: "awaiting_faq_add_q_en", field: "a_my", prompt: "Add FAQ — step 4/7\nSend the English question." },
    awaiting_faq_add_q_en: { next: "awaiting_faq_add_a_en", field: "q_en", prompt: "Add FAQ — step 5/7\nSend the English answer." },
    awaiting_faq_add_a_en: { next: "awaiting_faq_add_q_zh", field: "a_en", prompt: "Add FAQ — step 6/7\nSend the Simplified Chinese question." },
    awaiting_faq_add_q_zh: { next: "awaiting_faq_add_a_zh", field: "q_zh", prompt: "Add FAQ — step 7/7\nSend the Simplified Chinese answer." },
  };

  const step = steps[session.state];
  if (step) {
    payload[step.field] = step.field === "key" ? (slugify(value) || value) : value;
    await saveSession(db, userId, step.next, null, payload);
    return { handled: true, text: step.prompt };
  }

  if (session.state === "awaiting_faq_add_a_zh") {
    payload.a_zh = value;
    const key = String(payload.key ?? "").trim();
    if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(key)) {
      await clearSession(db, userId);
      return { handled: true, text: "FAQ key is invalid. Restart with /faq and use a short English key." };
    }

    const entry: FaqEntry = {
      key,
      question: { my: payload.q_my, en: payload.q_en, zh: payload.q_zh },
      answer: { my: payload.a_my, en: payload.a_en, zh: payload.a_zh },
      keywords: {
        my: deriveKeywords(payload.q_my),
        en: deriveKeywords(payload.q_en),
        zh: deriveKeywords(payload.q_zh),
      },
    };

    const mutation = await createFaq(db, userId, entry);
    await clearSession(db, userId);
    return {
      handled: true,
      text: `FAQ created: ${key}\nVersion 1\nIt is active immediately and is now part of deterministic matching and AI grounding.`,
      keyboard: faqKeyboard(key, true),
      mutation,
    };
  }

  await clearSession(db, userId);
  return { handled: true, text: "FAQ session expired. Open /faq and try again." };
}
