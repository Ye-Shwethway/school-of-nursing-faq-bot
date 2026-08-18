import secureRuntime from "./secure_entry";
import {
  aiSettingsKeyboard,
  aiStatus,
  bindSelectedModel,
  fetchProviderModels,
  startProviderSetup,
} from "./ai";
import {
  chooseModelForPing,
  selectedModelPassedPing,
  testSelectedModel,
} from "./ai_ping";
import { getAgentPersona, setAgentPersona } from "./persona";
import {
  consumeFaqAdminText,
  handleFaqCallback,
  handleFaqCommand,
  type FaqUiResponse,
} from "./faq_admin";
import { notifyFaqChange } from "./faq_notify";
import { buildApprovedFaqContext, findFaqDynamic } from "./faq_store";
import { runGroundedFaqAgent } from "./ai_runtime";
import type { Language } from "./faq";
import {
  ensureConversationControl,
  getConversationControl,
  getMonitoringMode,
  getMonitoringTopic,
  monitoringStatus,
  resetConversationTransient,
  saveMonitoringTopic,
  setMonitoringMode,
  shouldMirrorRoutine,
} from "./monitoring";
import {
  attachStaffMessage,
  createEscalationCase,
  getHandoffDestination,
  getStaffInboxChatId,
} from "./handoff";

interface Env {
  APP_ENV: string;
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
  AI_CONFIG_MASTER_KEY?: string;
}

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

type TelegramMessage = {
  message_id: number;
  message_thread_id?: number;
  text?: string;
  chat: { id: number; type?: string; title?: string; is_forum?: boolean };
  from?: TelegramUser;
};

type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};

type TelegramUpdate = {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> };

const HANDOFF_COPY: Record<Language, string> = {
  my: "ဒီမေးခွန်းကို အတည်ပြုထားသော အချက်အလက်များဖြင့် ယုံကြည်စိတ်ချစွာ မဖြေနိုင်သေးပါ။ မေးခွန်းကို School of Nursing ဝန်ထမ်းများ ပြန်လည်စစ်ဆေးနိုင်ရန် လွှဲပို့ထားပါသည်။",
  en: "I cannot answer this confidently from the approved information. Your question has been forwarded to authorized School of Nursing staff for review.",
  zh: "目前无法根据已批准的信息可靠回答此问题。您的问题已转交给护理学院授权工作人员进一步核查。",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function ownerId(env: Env): number | null {
  const raw = env.BOT_OWNER_TELEGRAM_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
}

function privateChat(message: TelegramMessage): boolean {
  return Boolean(message.from && (message.chat.type === "private" || message.chat.id === message.from.id));
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

function withClose(keyboard?: unknown): InlineKeyboard {
  const rows = keyboard && typeof keyboard === "object" && Array.isArray((keyboard as InlineKeyboard).inline_keyboard)
    ? [...(keyboard as InlineKeyboard).inline_keyboard]
    : [];
  if (!rows.some((row) => row.some((button) => button.callback_data === "ui:close"))) {
    rows.push([{ text: "✕ Close", callback_data: "ui:close" }]);
  }
  return { inline_keyboard: rows };
}

function monitoringKeyboard(): InlineKeyboard {
  return withClose({
    inline_keyboard: [
      [
        { text: "All + Alerts", callback_data: "ux:monitor:all_alerts" },
        { text: "Silent All", callback_data: "ux:monitor:silent_all" },
      ],
      [
        { text: "Alerts Only", callback_data: "ux:monitor:alerts_only" },
        { text: "Monitoring Off", callback_data: "ux:monitor:off" },
      ],
    ],
  });
}

function aiMenuKeyboard(): InlineKeyboard {
  const base = aiSettingsKeyboard() as InlineKeyboard;
  return withClose({
    inline_keyboard: [
      ...base.inline_keyboard,
      [
        { text: "Male persona", callback_data: "ux:ai:persona:male" },
        { text: "Female persona", callback_data: "ux:ai:persona:female" },
      ],
    ],
  });
}

async function sendMessage(
  env: Env,
  chatId: number,
  text: string,
  keyboard?: unknown,
  options?: { disableNotification?: boolean; messageThreadId?: number; replyToMessageId?: number },
): Promise<any | null> {
  return telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: keyboard,
    disable_notification: options?.disableNotification,
    message_thread_id: options?.messageThreadId,
    reply_parameters: options?.replyToMessageId ? { message_id: options.replyToMessageId } : undefined,
  });
}

async function editOrSend(
  env: Env,
  message: TelegramMessage,
  text: string,
  keyboard?: unknown,
): Promise<void> {
  const edited = await telegramApi(env, "editMessageText", {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text,
    reply_markup: keyboard,
  });
  if (!edited) await sendMessage(env, message.chat.id, text, keyboard);
}

async function answerCallback(env: Env, callbackId: string, text?: string): Promise<void> {
  await telegramApi(env, "answerCallbackQuery", { callback_query_id: callbackId, text });
}

async function closeUi(env: Env, callback: TelegramCallbackQuery): Promise<boolean> {
  if (callback.data !== "ui:close") return false;
  await answerCallback(env, callback.id);
  if (callback.message) {
    await telegramApi(env, "deleteMessage", {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
    });
  }
  return true;
}

async function sendFaqUi(
  env: Env,
  actorId: number,
  result: FaqUiResponse,
  message?: TelegramMessage,
): Promise<void> {
  if (result.text) {
    if (message) await editOrSend(env, message, result.text, withClose(result.keyboard));
    else if (message === undefined) return;
  }
  if (result.mutation) {
    await notifyFaqChange(
      env.DB,
      env.BOT_OWNER_TELEGRAM_ID,
      actorId,
      result.mutation,
      async (target, text, options) => sendMessage(env, target, text, undefined, options),
    );
  }
}

async function handleFaqUi(env: Env, update: TelegramUpdate): Promise<boolean> {
  const callback = update.callback_query;
  if (callback?.data?.startsWith("faq:")) {
    const result = await handleFaqCallback(env.DB, callback.from.id, env.BOT_OWNER_TELEGRAM_ID, callback.data);
    await answerCallback(env, callback.id);
    if (callback.message) await sendFaqUi(env, callback.from.id, result, callback.message);
    return true;
  }

  const message = update.message;
  if (!message?.from || !message.text) return false;
  const text = message.text.trim();

  try {
    const pending = await consumeFaqAdminText(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID, text);
    if (pending.handled) {
      if (pending.text) await sendMessage(env, message.chat.id, pending.text, pending.keyboard ? withClose(pending.keyboard) : undefined);
      if (pending.mutation) {
        await notifyFaqChange(
          env.DB,
          env.BOT_OWNER_TELEGRAM_ID,
          message.from.id,
          pending.mutation,
          async (target, body, options) => sendMessage(env, target, body, undefined, options),
        );
      }
      return true;
    }
    if (commandName(text) === "/faq") {
      const result = await handleFaqCommand(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID, text);
      if (result.handled) {
        if (result.text) await sendMessage(env, message.chat.id, result.text, withClose(result.keyboard));
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

async function handleAiUi(env: Env, update: TelegramUpdate): Promise<boolean> {
  const message = update.message;
  const callback = update.callback_query;
  const configuredOwner = ownerId(env);

  if (message?.from && commandName(message.text ?? "") === "/ai") {
    if (message.from.id !== configuredOwner || !privateChat(message)) return false;
    const persona = await getAgentPersona(env.DB);
    await sendMessage(
      env,
      message.chat.id,
      `AI Agent Settings\nPersona: ${persona}\nChoose a provider, model, binding, or persona.`,
      aiMenuKeyboard(),
    );
    return true;
  }

  const data = callback?.data ?? "";
  if (!callback || (!data.startsWith("ai:") && !data.startsWith("ux:ai:"))) return false;
  if (callback.from.id !== configuredOwner) {
    await answerCallback(env, callback.id, "Owner only");
    return true;
  }
  if (!callback.message || !privateChat(callback.message)) {
    await answerCallback(env, callback.id, "Use AI settings in private chat");
    return true;
  }

  await answerCallback(env, callback.id);
  const chatMessage = callback.message;

  if (data === "ai:menu" || data === "ux:ai:menu") {
    const persona = await getAgentPersona(env.DB);
    await editOrSend(env, chatMessage, `AI Agent Settings\nPersona: ${persona}\nChoose a provider, model, binding, or persona.`, aiMenuKeyboard());
    return true;
  }
  if (data === "ai:status") {
    const persona = await getAgentPersona(env.DB);
    await editOrSend(env, chatMessage, `${await aiStatus(env.DB)}\nPersona: ${persona}`, aiMenuKeyboard());
    return true;
  }

  const personaMatch = data.match(/^(?:ux:)?ai:persona:(male|female)$/);
  if (personaMatch) {
    const result = await setAgentPersona(env.DB, callback.from.id, personaMatch[1] as "male" | "female");
    await editOrSend(env, chatMessage, result, aiMenuKeyboard());
    return true;
  }

  const providerMatch = data.match(/^ai:provider:([a-z0-9_-]+)$/);
  if (providerMatch) {
    const result = await startProviderSetup(env.DB, callback.from.id, providerMatch[1]);
    await editOrSend(env, chatMessage, result.text, withClose(result.keyboard ?? { inline_keyboard: [[{ text: "← Back", callback_data: "ai:menu" }]] }));
    return true;
  }

  const fetchMatch = data.match(/^ai:fetch:([a-z0-9_-]+)$/);
  if (fetchMatch) {
    const result = await fetchProviderModels(env, callback.from.id, fetchMatch[1]);
    await editOrSend(env, chatMessage, result.text, withClose(result.keyboard ?? { inline_keyboard: [[{ text: "← Back", callback_data: "ai:menu" }]] }));
    return true;
  }

  const modelMatch = data.match(/^ai:model:([a-z0-9_-]+):([A-Za-z0-9_-]+)$/);
  if (modelMatch) {
    const result = await chooseModelForPing(env.DB, callback.from.id, modelMatch[1], modelMatch[2]);
    await editOrSend(env, chatMessage, result.text, withClose(result.keyboard));
    return true;
  }

  if (data === "ai:ping") {
    const result = await testSelectedModel(env, callback.from.id);
    await editOrSend(env, chatMessage, result.text, withClose(result.keyboard));
    return true;
  }

  const bindMatch = data.match(/^ai:bind:(primary|fallback)$/);
  if (bindMatch) {
    if (!await selectedModelPassedPing(env.DB, callback.from.id)) {
      await editOrSend(env, chatMessage, "Run Test Ping successfully before binding this model.", withClose({ inline_keyboard: [[{ text: "← Back", callback_data: "ai:menu" }]] }));
      return true;
    }
    const result = await bindSelectedModel(env.DB, callback.from.id, bindMatch[1] as "primary" | "fallback");
    await editOrSend(env, chatMessage, result, aiMenuKeyboard());
    return true;
  }

  return false;
}

async function handleMonitoringUi(env: Env, update: TelegramUpdate): Promise<boolean> {
  const configuredOwner = ownerId(env);
  const message = update.message;
  if (message?.from && message.text?.trim().match(/^\/staff(?:@[^\s]+)?\s+monitoring$/i)) {
    if (message.from.id !== configuredOwner) return false;
    await sendMessage(env, message.chat.id, await monitoringStatus(env.DB), monitoringKeyboard());
    return true;
  }

  const callback = update.callback_query;
  const match = callback?.data?.match(/^ux:monitor:(all_alerts|silent_all|alerts_only|off)$/);
  if (!callback || !match) return false;
  if (callback.from.id !== configuredOwner) {
    await answerCallback(env, callback.id, "Owner only");
    return true;
  }
  await answerCallback(env, callback.id);
  await setMonitoringMode(env.DB, callback.from.id, match[1] as "all_alerts" | "silent_all" | "alerts_only" | "off");
  if (callback.message) await editOrSend(env, callback.message, await monitoringStatus(env.DB), monitoringKeyboard());
  return true;
}

async function cancelCurrentSetup(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from) return false;
  const result = await env.DB.prepare(`DELETE FROM admin_sessions WHERE telegram_user_id=?1`).bind(message.from.id).run();
  const changed = (result.meta.changes ?? 0) > 0;
  await sendMessage(env, message.chat.id, changed ? "Current setup cancelled." : "No setup is currently active.");
  return true;
}

async function resetUserState(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!message.from) return false;
  await resetConversationTransient(env.DB, message.from.id);
  await sendMessage(
    env,
    message.chat.id,
    "Conversation state reset. Saved language, FAQ knowledge, AI credentials, model bindings, and administrator settings were not changed.",
  );
  return true;
}

async function dynamicFaqReady(db: D1Database | undefined): Promise<boolean> {
  if (!db) return false;
  try {
    await db.prepare(`SELECT 1 FROM faq_entries LIMIT 1`).first();
    return true;
  } catch {
    return false;
  }
}

async function getLanguage(db: D1Database, userId: number): Promise<Language | null> {
  const row = await db.prepare(`SELECT language FROM users WHERE telegram_user_id=?1`).bind(userId).first<{ language: Language | null }>();
  return row?.language ?? null;
}

async function hasInteractiveSession(db: D1Database | undefined, userId: number): Promise<boolean> {
  if (!db) return false;
  try {
    const row = await db.prepare(`SELECT state FROM admin_sessions WHERE telegram_user_id=?1`).bind(userId).first<{ state: string }>();
    return Boolean(row?.state);
  } catch {
    return false;
  }
}

async function ensureMonitoringTarget(env: Env, user: TelegramUser): Promise<{ chatId: number; threadId?: number } | null> {
  if (!env.DB) return null;
  const staffChatId = await getStaffInboxChatId(env.DB);
  if (!staffChatId) return null;
  const existing = await getMonitoringTopic(env.DB, user.id, staffChatId);
  if (existing) return { chatId: staffChatId, threadId: existing };
  const display = user.username ? `@${user.username}` : [user.first_name, user.last_name].filter(Boolean).join(" ");
  const topic = await telegramApi(env, "createForumTopic", {
    chat_id: staffChatId,
    name: `User ${user.id}${display ? ` · ${display}` : ""}`.slice(0, 120),
  });
  const threadId = Number(topic?.message_thread_id);
  if (Number.isSafeInteger(threadId)) {
    await saveMonitoringTopic(env.DB, user.id, staffChatId, threadId);
    return { chatId: staffChatId, threadId };
  }
  return { chatId: staffChatId };
}

async function mirrorRoutine(env: Env, user: TelegramUser, label: string, text: string): Promise<void> {
  if (!env.DB) return;
  const mode = await getMonitoringMode(env.DB);
  if (!shouldMirrorRoutine(mode)) return;
  const target = await ensureMonitoringTarget(env, user);
  if (!target) return;
  await sendMessage(env, target.chatId, `${label}\n${text}`, undefined, {
    disableNotification: true,
    messageThreadId: target.threadId,
  });
}

async function relayHumanControl(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text) return false;
  const target = await ensureMonitoringTarget(env, message.from);
  if (!target) return false;
  await sendMessage(env, target.chatId, `USER · Human control\n${message.text}`, undefined, {
    messageThreadId: target.threadId,
  });
  return true;
}

function startTyping(env: Env, chatId: number): () => void {
  let active = true;
  const tick = async () => {
    if (!active) return;
    await telegramApi(env, "sendChatAction", { chat_id: chatId, action: "typing" });
    if (active) setTimeout(tick, 4000);
  };
  void tick();
  return () => { active = false; };
}

async function logQuestion(
  db: D1Database,
  message: TelegramMessage,
  language: Language,
  resolution: "answered" | "pending",
  source: string,
): Promise<number | null> {
  if (!message.from || !message.text) return null;
  const result = await db.prepare(
    `INSERT INTO questions
      (telegram_user_id, chat_id, message_id, question, language, resolution, matched_faq_key, answer_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL, ?7)`,
  ).bind(message.from.id, message.chat.id, message.message_id, message.text, language, resolution, source).run();
  const id = Number(result.meta.last_row_id);
  return Number.isSafeInteger(id) ? id : null;
}

function caseText(caseId: number, message: TelegramMessage, language: Language, route: string, reason: string): string {
  const name = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || "—";
  return [
    `New FAQ Escalation #${caseId}`,
    `Route: ${route}`,
    `Language: ${language}`,
    `User: ${name}${message.from?.username ? ` (@${message.from.username})` : ""} — ID: ${message.from?.id ?? "—"}`,
    `Reason: ${reason}`,
    "",
    message.text ?? "",
  ].join("\n");
}

async function humanHandoff(
  env: Env,
  message: TelegramMessage,
  language: Language,
  questionId: number | null,
  reason: string,
): Promise<void> {
  if (!env.DB || !message.from || !message.text) return;
  const destination = await getHandoffDestination(env.DB);
  const caseId = await createEscalationCase(env.DB, {
    telegramUserId: message.from.id,
    sourceQuestionId: questionId,
    language,
    question: message.text,
    staffChatId: destination?.chatId ?? null,
  });
  if (!caseId || !destination) return;
  const sent = await sendMessage(
    env,
    destination.chatId,
    caseText(caseId, message, language, destination.route, reason),
    { inline_keyboard: [[{ text: "Take Over", callback_data: `case:claim:${caseId}` }]] },
  );
  if (sent?.message_id) await attachStaffMessage(env.DB, caseId, destination.chatId, Number(sent.message_id));
}

async function handleGroundedAiInquiry(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text || !privateChat(message)) return false;
  const text = message.text.trim();
  if (!text || text.startsWith("/") || await hasInteractiveSession(env.DB, message.from.id)) return false;
  if (!await dynamicFaqReady(env.DB)) return false;
  const language = await getLanguage(env.DB, message.from.id);
  if (!language) return false;

  const control = await ensureConversationControl(env.DB, message.from.id);
  if (control.mode === "human") return relayHumanControl(env, message);

  const faq = await findFaqDynamic(env.DB, text, language);
  if (faq) return false;

  await mirrorRoutine(env, message.from, "USER", text);
  const stopTyping = startTyping(env, message.chat.id);
  try {
    let context = "";
    try { context = await buildApprovedFaqContext(env.DB); } catch { context = ""; }
    const persona = await getAgentPersona(env.DB);
    const ai = await runGroundedFaqAgent(env, {
      persona,
      language,
      approvedContext: context,
      question: text,
    });

    const current = await getConversationControl(env.DB, message.from.id);
    if (current.mode !== "ai" || current.version !== control.version) return true;

    if (ai.action === "answer" && ai.answer) {
      await logQuestion(env.DB, message, language, "answered", ai.source === "fallback" ? "ai_fallback" : "ai_primary");
      await sendMessage(env, message.chat.id, ai.answer, undefined, { replyToMessageId: message.message_id });
      await mirrorRoutine(env, message.from, "AI", ai.answer);
      return true;
    }

    const questionId = await logQuestion(env.DB, message, language, "pending", "human_handoff");
    await humanHandoff(env, message, language, questionId, ai.reason || "AI could not answer safely");
    await sendMessage(env, message.chat.id, HANDOFF_COPY[language], undefined, { replyToMessageId: message.message_id });
    await mirrorRoutine(env, message.from, "BOT", HANDOFF_COPY[language]);
    return true;
  } finally {
    stopTyping();
  }
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = await request.clone().json<TelegramUpdate>();
  } catch {
    return secureRuntime.fetch(request, env);
  }

  if (update.callback_query && await closeUi(env, update.callback_query)) return json({ ok: true });

  const message = update.message;
  const command = commandName(message?.text ?? "");
  if (message?.from && command === "/cancel") {
    await cancelCurrentSetup(env, message);
    return json({ ok: true });
  }
  if (message?.from && command === "/reset") {
    await resetUserState(env, message);
    return json({ ok: true });
  }

  if (await handleAiUi(env, update)) return json({ ok: true });
  if (await handleMonitoringUi(env, update)) return json({ ok: true });
  if (await handleFaqUi(env, update)) return json({ ok: true });
  if (message && await handleGroundedAiInquiry(env, message)) return json({ ok: true });

  return secureRuntime.fetch(request, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleWebhook(request, env);
    }
    return secureRuntime.fetch(request, env);
  },
};
