import app from "./staff_ux_entry";
import { buildApprovedFaqContext, findFaqDynamic } from "./faq_store";
import { runGroundedFaqAgent } from "./ai_runtime";
import { getAgentPersona } from "./persona";
import type { Language } from "./faq";
import {
  ensureConversationControl,
  getConversationControl,
  getMonitoringMode,
  shouldMirrorRoutine,
} from "./monitoring";
import {
  attachStaffMessage,
  createEscalationCase,
  getHandoffDestination,
} from "./handoff";
import {
  monitoringAiHeader,
  monitoringBotHeader,
  monitoringUserHeader,
} from "./monitoring_headers";
import { ensureIsolatedMonitoringTarget } from "./monitoring_target";
import { countAvailableStaff, staffNotificationsEnabled } from "./staff_presence";

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
  text?: string;
  chat: { id: number; type?: string; title?: string };
  from?: TelegramUser;
};

type TelegramUpdate = { message?: TelegramMessage };

const HANDOFF_COPY: Record<Language, string> = {
  my: "ဒီမေးခွန်းကို အတည်ပြုထားသော အချက်အလက်များဖြင့် ယုံကြည်စိတ်ချစွာ မဖြေနိုင်သေးပါ။ မေးခွန်းကို School of Nursing ဝန်ထမ်းများ ပြန်လည်စစ်ဆေးနိုင်ရန် လွှဲပို့ထားပါသည်။",
  en: "I cannot answer this confidently from the approved information. Your question has been forwarded to authorized School of Nursing staff for review.",
  zh: "目前无法根据已批准的信息可靠回答此问题。您的问题已转交给护理学院授权工作人员进一步核查。",
};

const STAFF_UNAVAILABLE_COPY: Record<Language, string> = {
  my: "ဒီမေးခွန်းကို လက်ရှိအတည်ပြုထားသော FAQ သို့မဟုတ် AI ဖြင့် ယုံကြည်စိတ်ချစွာ မဖြေနိုင်သေးပါ။ လောလောဆယ် School of Nursing ဝန်ထမ်းများလည်း မအားသေးပါ။ မေးခွန်းကို မှတ်တမ်းတင်ထားပြီးဖြစ်သောကြောင့် နောက်မှ ပြန်လည်ကြိုးစားပါ။ ဝန်ထမ်းတစ်ဦး ပြန်လည်ကြည့်ရှုပြီး ဆက်သွယ်နိုင်ပါသည်။",
  en: "I cannot answer this confidently from the approved FAQ or AI right now, and no School of Nursing staff are currently available. Your question has been kept for review. Please try again later; a staff member may also follow up when available.",
  zh: "目前无法根据已批准的 FAQ 或 AI 可靠回答此问题，护理学院工作人员当前也暂时无法在线处理。您的问题已保留待审核，请稍后再试；工作人员恢复在线后也可能主动回复您。",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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
  const row = await db.prepare(`SELECT language FROM users WHERE telegram_user_id=?1`)
    .bind(userId).first<{ language: Language | null }>();
  return row?.language ?? null;
}

async function hasInteractiveSession(db: D1Database, userId: number): Promise<boolean> {
  try {
    const row = await db.prepare(`SELECT state FROM admin_sessions WHERE telegram_user_id=?1`)
      .bind(userId).first<{ state: string }>();
    return Boolean(row?.state);
  } catch {
    return false;
  }
}

async function ensureMonitoringTarget(
  env: Env,
  user: TelegramUser,
): Promise<{ chatId: number; threadId: number } | null> {
  return ensureIsolatedMonitoringTarget(
    env,
    user,
    (method, body) => telegramApi(env, method, body),
  );
}

async function mirrorRoutine(env: Env, user: TelegramUser, header: string, text: string): Promise<void> {
  if (!env.DB) return;
  const mode = await getMonitoringMode(env.DB);
  if (!shouldMirrorRoutine(mode)) return;
  const target = await ensureMonitoringTarget(env, user);
  if (!target) return;
  await sendMessage(
    env,
    target.chatId,
    `${header}\n${text}`,
    { inline_keyboard: [[{ text: "Take Over", callback_data: `conv:take:${user.id}` }]] },
    { disableNotification: true, messageThreadId: target.threadId },
  );
}

async function relayHumanControl(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text) return false;
  const target = await ensureMonitoringTarget(env, message.from);
  if (!target) return false;
  const notificationsOn = await staffNotificationsEnabled(env.DB);
  await sendMessage(
    env,
    target.chatId,
    `${monitoringUserHeader(message.from)} · Human control\n${message.text}`,
    undefined,
    { disableNotification: !notificationsOn, messageThreadId: target.threadId },
  );
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
  faqKey: string | null,
  source: string,
): Promise<number | null> {
  if (!message.from || !message.text) return null;
  const result = await db.prepare(
    `INSERT INTO questions
      (telegram_user_id, chat_id, message_id, question, language, resolution, matched_faq_key, answer_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  ).bind(
    message.from.id,
    message.chat.id,
    message.message_id,
    message.text,
    language,
    resolution,
    faqKey,
    source,
  ).run();
  const id = Number(result.meta.last_row_id);
  return Number.isSafeInteger(id) ? id : null;
}

function caseText(caseId: number, message: TelegramMessage, language: Language, route: string, reason: string): string {
  const identity = message.from ? monitoringUserHeader(message.from).replace(/^USER · /, "") : "Unknown user";
  return [
    `New FAQ Escalation #${caseId}`,
    `Route: ${route}`,
    `Language: ${language}`,
    `User: ${identity}`,
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

  const notificationsOn = await staffNotificationsEnabled(env.DB);

  if (destination.route === "group") {
    const target = await ensureMonitoringTarget(env, message.from);
    if (!target) return;
    const sent = await sendMessage(
      env,
      target.chatId,
      caseText(caseId, message, language, destination.route, reason),
      { inline_keyboard: [[{ text: "Take Over", callback_data: `case:claim:${caseId}` }]] },
      { disableNotification: !notificationsOn, messageThreadId: target.threadId },
    );
    if (sent?.message_id) {
      await attachStaffMessage(env.DB, caseId, target.chatId, Number(sent.message_id));
    }
    return;
  }

  const sent = await sendMessage(
    env,
    destination.chatId,
    caseText(caseId, message, language, destination.route, reason),
    { inline_keyboard: [[{ text: "Take Over", callback_data: `case:claim:${caseId}` }]] },
  );
  if (sent?.message_id) {
    await attachStaffMessage(env.DB, caseId, destination.chatId, Number(sent.message_id));
  }
}

async function handleInquiry(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text || !privateChat(message)) return false;
  const text = message.text.trim();
  if (!text || text.startsWith("/")) return false;
  if (await hasInteractiveSession(env.DB, message.from.id)) return false;
  if (!await dynamicFaqReady(env.DB)) return false;
  const language = await getLanguage(env.DB, message.from.id);
  if (!language) return false;

  const control = await ensureConversationControl(env.DB, message.from.id);
  if (control.mode === "human") return relayHumanControl(env, message);

  await mirrorRoutine(env, message.from, monitoringUserHeader(message.from), text);

  const faq = await findFaqDynamic(env.DB, text, language);
  if (faq) {
    await logQuestion(env.DB, message, language, "answered", faq.key, "dynamic_faq");
    await sendMessage(env, message.chat.id, faq.answer[language], undefined, { replyToMessageId: message.message_id });
    await mirrorRoutine(env, message.from, monitoringBotHeader("faq"), faq.answer[language]);
    return true;
  }

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
      const source = ai.source === "fallback" ? "fallback" : "primary";
      await logQuestion(env.DB, message, language, "answered", null, source === "fallback" ? "ai_fallback" : "ai_primary");
      await sendMessage(env, message.chat.id, ai.answer, undefined, { replyToMessageId: message.message_id });
      await mirrorRoutine(env, message.from, await monitoringAiHeader(env.DB, source), ai.answer);
      return true;
    }

    const questionId = await logQuestion(env.DB, message, language, "pending", null, "human_handoff");
    await humanHandoff(env, message, language, questionId, ai.reason || "AI could not answer safely");

    const availableStaff = await countAvailableStaff(env.DB);
    const handoffCopy = availableStaff > 0 ? HANDOFF_COPY[language] : STAFF_UNAVAILABLE_COPY[language];
    await sendMessage(env, message.chat.id, handoffCopy, undefined, { replyToMessageId: message.message_id });
    await mirrorRoutine(env, message.from, monitoringBotHeader("handoff"), handoffCopy);
    return true;
  } finally {
    stopTyping();
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/telegram/webhook") {
      return app.fetch(request, env);
    }

    if (env.TELEGRAM_WEBHOOK_SECRET) {
      const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false }, 401);
    }

    let update: TelegramUpdate;
    try {
      update = await request.clone().json<TelegramUpdate>();
    } catch {
      return app.fetch(request, env);
    }

    if (update.message && await handleInquiry(env, update.message)) {
      return json({ ok: true });
    }
    return app.fetch(request, env);
  },
};