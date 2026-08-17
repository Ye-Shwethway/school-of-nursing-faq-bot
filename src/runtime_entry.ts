import app from "./index";
import { syncCommandRegistryIfNeeded, syncUserCommandScope } from "./command_sync";
import { formatTelegramIdentity } from "./identity";
import { handleFaqCallback, handleFaqCommand, consumeFaqAdminText, type FaqUiResponse } from "./faq_admin";
import { notifyFaqChange } from "./faq_notify";
import { buildApprovedFaqContext, findFaqDynamic } from "./faq_store";
import { runGroundedFaqAgent } from "./ai_runtime";
import { getAgentPersona } from "./persona";
import type { Language } from "./faq";
import {
  getConversationControl,
  getMonitoringMode,
  getMonitoringTopic,
  saveMonitoringTopic,
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

async function telegramApi(env: Env, method: string, body: unknown): Promise<any | null> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      },
    );
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
  options?: { disableNotification?: boolean; messageThreadId?: number },
): Promise<any | null> {
  return telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: keyboard,
    disable_notification: options?.disableNotification,
    message_thread_id: options?.messageThreadId,
  });
}

async function upsertIdentity(db: D1Database | undefined, user: TelegramUser): Promise<void> {
  if (!db) return;
  await db.prepare(
    `INSERT INTO users (telegram_user_id, username, first_name, last_name, updated_at)
     VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       username=excluded.username,
       first_name=excluded.first_name,
       last_name=excluded.last_name,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(user.id, user.username ?? null, user.first_name ?? null, user.last_name ?? null).run();
}

function privateChat(message: TelegramMessage): boolean {
  return Boolean(message.from && (message.chat.type === "private" || message.chat.id === message.from.id));
}

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
}

function sudoTarget(text: string): number | null {
  const match = text.trim().match(/^\/sudo(?:@[^\s]+)?\s+(?:grant|revoke)\s+(\d+)$/i);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isSafeInteger(id) ? id : null;
}

async function getLanguage(db: D1Database, userId: number): Promise<Language | null> {
  const row = await db.prepare(
    `SELECT language FROM users WHERE telegram_user_id=?1`,
  ).bind(userId).first<{ language: Language | null }>();
  return row?.language ?? null;
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

async function ensureMonitoringTarget(
  env: Env,
  user: TelegramUser,
): Promise<{ chatId: number; threadId?: number } | null> {
  if (!env.DB) return null;
  const staffChatId = await getStaffInboxChatId(env.DB);
  if (!staffChatId) return null;
  const existing = await getMonitoringTopic(env.DB, user.id, staffChatId);
  if (existing) return { chatId: staffChatId, threadId: existing };

  const name = user.username
    ? `@${user.username}`
    : [user.first_name, user.last_name].filter(Boolean).join(" ");
  const topic = await telegramApi(env, "createForumTopic", {
    chat_id: staffChatId,
    name: `User ${user.id}${name ? ` · ${name}` : ""}`.slice(0, 120),
  });
  const threadId = Number(topic?.message_thread_id);
  if (Number.isSafeInteger(threadId)) {
    await saveMonitoringTopic(env.DB, user.id, staffChatId, threadId);
    return { chatId: staffChatId, threadId };
  }
  return { chatId: staffChatId };
}

async function mirrorRoutine(
  env: Env,
  user: TelegramUser,
  label: "USER" | "BOT" | "AI",
  text: string,
): Promise<void> {
  if (!env.DB) return;
  const mode = await getMonitoringMode(env.DB);
  if (!shouldMirrorRoutine(mode)) return;
  const target = await ensureMonitoringTarget(env, user);
  if (!target) return;
  await sendMessage(
    env,
    target.chatId,
    `${label}\n${text}`,
    { inline_keyboard: [[{ text: "Take Over", callback_data: `conv:take:${user.id}` }]] },
    { disableNotification: true, messageThreadId: target.threadId },
  );
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
  if (!caseId) return;

  if (!destination) {
    const ownerId = Number(env.BOT_OWNER_TELEGRAM_ID ?? "");
    if (Number.isSafeInteger(ownerId)) {
      await sendMessage(env, ownerId, `Human handoff warning\nCase #${caseId} remains queued in D1 because no staff destination is configured.`);
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

async function sendFaqUi(env: Env, chatId: number, actorId: number, result: FaqUiResponse): Promise<void> {
  if (result.text) await sendMessage(env, chatId, result.text, result.keyboard);
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

async function handleFaqSurfaces(env: Env, update: TelegramUpdate): Promise<boolean> {
  const callback = update.callback_query;
  if (callback?.data?.startsWith("faq:")) {
    const result = await handleFaqCallback(env.DB, callback.from.id, env.BOT_OWNER_TELEGRAM_ID, callback.data);
    await telegramApi(env, "answerCallbackQuery", { callback_query_id: callback.id });
    if (callback.message) await sendFaqUi(env, callback.message.chat.id, callback.from.id, result);
    return true;
  }

  const message = update.message;
  if (!message?.from || !message.text) return false;
  const text = message.text.trim();

  try {
    const pending = await consumeFaqAdminText(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID, text);
    if (pending.handled) {
      await sendFaqUi(env, message.chat.id, message.from.id, pending);
      return true;
    }

    if (commandName(text) === "/faq") {
      const result = await handleFaqCommand(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID, text);
      if (result.handled) {
        await sendFaqUi(env, message.chat.id, message.from.id, result);
        return true;
      }
    }
  } catch {
    if (commandName(text) === "/faq") {
      await sendMessage(env, message.chat.id, "FAQ management is not active yet. Apply migration 0005 and retry.");
      return true;
    }
  }
  return false;
}

async function handleDynamicQuestion(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text || !privateChat(message)) return false;
  const text = message.text.trim();
  if (!text || text.startsWith("/")) return false;
  if (!(await dynamicFaqReady(env.DB))) return false;

  const language = await getLanguage(env.DB, message.from.id);
  if (!language) return false;

  try {
    const control = await getConversationControl(env.DB, message.from.id);
    if (control.mode === "human") return false;
  } catch {
    // Migration 0004 may not exist in a transitional deployment. Continue automated handling.
  }

  await mirrorRoutine(env, message.from, "USER", text);

  const faq = await findFaqDynamic(env.DB, text, language);
  if (faq) {
    await logQuestion(env.DB, message, language, "answered", faq.key, "dynamic_faq");
    await sendMessage(env, message.chat.id, faq.answer[language]);
    await mirrorRoutine(env, message.from, "BOT", faq.answer[language]);
    return true;
  }

  let context = "";
  try {
    context = await buildApprovedFaqContext(env.DB);
  } catch {
    context = "";
  }

  const persona = await getAgentPersona(env.DB);
  const ai = await runGroundedFaqAgent(env, {
    persona,
    language,
    approvedContext: context,
    question: text,
  });

  if (ai.action === "answer" && ai.answer) {
    await logQuestion(
      env.DB,
      message,
      language,
      "answered",
      null,
      ai.source === "fallback" ? "ai_fallback" : "ai_primary",
    );
    await sendMessage(env, message.chat.id, ai.answer);
    await mirrorRoutine(env, message.from, "AI", ai.answer);
    return true;
  }

  const questionId = await logQuestion(env.DB, message, language, "pending", null, "human_handoff");
  await humanHandoff(env, message, language, questionId, ai.reason || "AI could not answer safely");
  await sendMessage(env, message.chat.id, HANDOFF_COPY[language]);
  await mirrorRoutine(env, message.from, "BOT", HANDOFF_COPY[language]);
  return true;
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false }, 401);
  }

  const raw = await request.text();
  let update: TelegramUpdate | null = null;
  try {
    update = JSON.parse(raw) as TelegramUpdate;
  } catch {
    const forwarded = new Request(request.url, { method: request.method, headers: request.headers, body: raw });
    return app.fetch(forwarded, env);
  }

  const api = (method: string, body: unknown) => telegramApi(env, method, body);
  try {
    await syncCommandRegistryIfNeeded(env.DB, api, env.BOT_OWNER_TELEGRAM_ID);
  } catch {
    // Command menu synchronization is best-effort and never blocks bot runtime.
  }

  const message = update.message;
  const text = message?.text?.trim() ?? "";

  if (message?.from) {
    try { await upsertIdentity(env.DB, message.from); } catch { /* non-fatal metadata */ }

    const command = commandName(text);
    if (privateChat(message) && (command === "/start" || command === "/whoami")) {
      try { await syncUserCommandScope(env.DB, api, message.from.id, env.BOT_OWNER_TELEGRAM_ID); } catch { /* non-fatal */ }
    }

    if (command === "/whoami") {
      if (!privateChat(message)) {
        await sendMessage(env, message.chat.id, "Please use /whoami in a private chat with this bot.");
      } else {
        await sendMessage(
          env,
          message.chat.id,
          [
            "Your Telegram identity",
            formatTelegramIdentity(message.from),
            "",
            "Share the numeric ID with the Bot Owner if you need administrator or staff access.",
          ].join("\n"),
        );
      }
      return json({ ok: true });
    }
  }

  if (await handleFaqSurfaces(env, update)) return json({ ok: true });
  if (message && await handleDynamicQuestion(env, message)) return json({ ok: true });

  const forwarded = new Request(request.url, { method: request.method, headers: request.headers, body: raw });
  const response = await app.fetch(forwarded, env);

  const targetId = sudoTarget(text);
  if (targetId !== null) {
    try { await syncUserCommandScope(env.DB, api, targetId, env.BOT_OWNER_TELEGRAM_ID); } catch { /* non-fatal */ }
  }
  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleWebhook(request, env);
    }
    return app.fetch(request, env);
  },
};
