import app from "./input_quality_entry";
import { consumeFaqAdminText, handleFaqCallback, handleFaqCommand, type FaqUiResponse } from "./faq_admin";
import { notifyFaqChange } from "./faq_notify";
import { findFaqDynamic, repairCorruptedFaqs } from "./faq_store";
import { getConversationControl } from "./monitoring";
import type { Language } from "./faq";

interface Env {
  APP_ENV: string;
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
  AI_CONFIG_MASTER_KEY?: string;
  DEPLOY_REVISION?: string;
}

type TelegramUser = { id: number };
type TelegramMessage = {
  message_id: number;
  message_thread_id?: number;
  text?: string;
  chat: { id: number; type?: string };
  from?: TelegramUser;
};
type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};
type TelegramUpdate = { message?: TelegramMessage; callback_query?: TelegramCallbackQuery };
type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>> };

const FAQ_STORAGE_UNAVAILABLE: Record<Language, string> = {
  my: "FAQ အချက်အလက်များကို လောလောဆယ် မဖတ်နိုင်သေးပါ။ ခဏနောက် ပြန်စမ်းကြည့်ပါ။ အဟောင်း FAQ အချက်အလက်ကို အစားထိုးပြသမည်မဟုတ်ပါ။",
  en: "FAQ data is temporarily unavailable. Please try again shortly. The bot will not substitute older FAQ content.",
  zh: "暂时无法读取常见问题数据，请稍后重试。系统不会用旧版常见问题内容替代。",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
}

function ownerId(env: Env): number | null {
  const raw = env.BOT_OWNER_TELEGRAM_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}

function isPrivate(message: TelegramMessage): boolean {
  return Boolean(message.from && (message.chat.type === "private" || message.chat.id === message.from.id));
}

function withClose(keyboard?: unknown): InlineKeyboard | undefined {
  if (!keyboard || typeof keyboard !== "object" || !Array.isArray((keyboard as InlineKeyboard).inline_keyboard)) {
    return keyboard as InlineKeyboard | undefined;
  }
  const rows = [...(keyboard as InlineKeyboard).inline_keyboard];
  if (!rows.some((row) => row.some((button) => button.callback_data === "ui:close"))) {
    rows.push([{ text: "✕ Close", callback_data: "ui:close" }]);
  }
  return { inline_keyboard: rows };
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

async function editOrSend(env: Env, message: TelegramMessage, text: string, keyboard?: unknown): Promise<void> {
  const edited = await telegramApi(env, "editMessageText", {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text,
    reply_markup: keyboard,
  });
  if (!edited) {
    await sendMessage(env, message.chat.id, text, keyboard, { messageThreadId: message.message_thread_id });
  }
}

async function notifyMutation(env: Env, actorId: number, result: FaqUiResponse): Promise<void> {
  if (!result.mutation) return;
  await notifyFaqChange(
    env.DB,
    env.BOT_OWNER_TELEGRAM_ID,
    actorId,
    result.mutation,
    async (target, text, options) => sendMessage(env, target, text, undefined, options),
  );
}

async function activeFaqSession(db: D1Database | undefined, userId: number): Promise<string | null> {
  if (!db) return null;
  try {
    const row = await db.prepare(
      `SELECT state FROM admin_sessions WHERE telegram_user_id=?1 AND (state LIKE 'faq_%' OR state LIKE 'awaiting_faq_%')`,
    ).bind(userId).first<{ state: string }>();
    return row?.state ?? null;
  } catch {
    return null;
  }
}

async function clearFaqSession(db: D1Database | undefined, userId: number): Promise<void> {
  if (!db) return;
  try {
    await db.prepare(
      `DELETE FROM admin_sessions WHERE telegram_user_id=?1 AND (state LIKE 'faq_%' OR state LIKE 'awaiting_faq_%')`,
    ).bind(userId).run();
  } catch {
    // Lower command handling remains available even if cleanup fails transiently.
  }
}

async function hasInteractiveSession(db: D1Database | undefined, userId: number): Promise<boolean> {
  if (!db) return false;
  try {
    const row = await db.prepare(
      `SELECT state FROM admin_sessions WHERE telegram_user_id=?1`,
    ).bind(userId).first<{ state: string }>();
    return Boolean(row?.state);
  } catch {
    return false;
  }
}

async function userLanguage(db: D1Database, userId: number): Promise<Language | null> {
  const row = await db.prepare(
    `SELECT language FROM users WHERE telegram_user_id=?1`,
  ).bind(userId).first<{ language: string | null }>();
  return row?.language === "my" || row?.language === "en" || row?.language === "zh"
    ? row.language
    : null;
}

async function safeUserLanguage(db: D1Database | undefined, userId: number): Promise<Language> {
  if (!db) return "en";
  try { return await userLanguage(db, userId) ?? "en"; } catch { return "en"; }
}

async function serveDynamicFaqFastPath(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text || !isPrivate(message)) return false;
  const text = message.text.trim();
  if (!text || text.startsWith("/") || await hasInteractiveSession(env.DB, message.from.id)) return false;

  let language: Language = "en";
  try {
    const control = await getConversationControl(env.DB, message.from.id);
    if (control.mode === "human") return false;

    language = await userLanguage(env.DB, message.from.id) ?? "en";
    const faq = await findFaqDynamic(env.DB, text, language);
    if (!faq) return false;

    try {
      await env.DB.prepare(
        `INSERT INTO questions
          (telegram_user_id, chat_id, message_id, question, language, resolution, matched_faq_key, answer_source)
         VALUES (?1, ?2, ?3, ?4, ?5, 'answered', ?6, 'canonical_faq')`,
      ).bind(
        message.from.id,
        message.chat.id,
        message.message_id,
        text,
        language,
        faq.key,
      ).run();
    } catch {
      // Logging is operational metadata; it must not suppress a valid live FAQ answer.
    }

    await sendMessage(
      env,
      message.chat.id,
      faq.answer[language],
      undefined,
      { replyToMessageId: message.message_id },
    );
    return true;
  } catch {
    await sendMessage(env, message.chat.id, FAQ_STORAGE_UNAVAILABLE[language]);
    return true;
  }
}

async function handleFaqRepair(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!message.from || !message.text || !/^\/faq(?:@[^\s]+)?\s+repair$/i.test(message.text.trim())) return false;
  if (message.from.id !== ownerId(env)) {
    await sendMessage(env, message.chat.id, "FAQ repair is available to the Bot Owner only.");
    return true;
  }
  if (!env.DB) {
    await sendMessage(env, message.chat.id, "FAQ storage is temporarily unavailable.");
    return true;
  }

  try {
    await clearFaqSession(env.DB, message.from.id);
    const result = await repairCorruptedFaqs(env.DB, message.from.id);
    const lines = ["FAQ integrity repair complete."];
    if (!result.repaired.length && !result.unrecoverable.length) {
      lines.push("No corrupted live FAQ rows were detected.");
    }
    for (const item of result.repaired) {
      lines.push(`${item.key}: corrupt v${item.corruptVersion} → clean snapshot v${item.restoredFromVersion} → new live v${item.newVersion}`);
    }
    if (result.unrecoverable.length) {
      lines.push(`Needs manual review: ${result.unrecoverable.join(", ")}`);
    }
    lines.push("Revision history was preserved; no archive rows were deleted.");
    await sendMessage(env, message.chat.id, lines.join("\n"));
  } catch {
    await sendMessage(env, message.chat.id, "FAQ integrity repair failed safely. No static FAQ fallback was published.");
  }
  return true;
}

async function handleFaqSurface(env: Env, update: TelegramUpdate): Promise<boolean> {
  const callback = update.callback_query;
  if (callback?.data?.startsWith("faq:")) {
    try {
      const result = await handleFaqCallback(
        env.DB,
        callback.from.id,
        env.BOT_OWNER_TELEGRAM_ID,
        callback.data,
        { DB: env.DB, AI_CONFIG_MASTER_KEY: env.AI_CONFIG_MASTER_KEY },
      );
      await telegramApi(env, "answerCallbackQuery", { callback_query_id: callback.id });
      if (callback.message && result.text) {
        await editOrSend(env, callback.message, result.text, withClose(result.keyboard));
      }
      await notifyMutation(env, callback.from.id, result);
    } catch {
      const language = await safeUserLanguage(env.DB, callback.from.id);
      await telegramApi(env, "answerCallbackQuery", {
        callback_query_id: callback.id,
        text: FAQ_STORAGE_UNAVAILABLE[language],
        show_alert: true,
      });
    }
    return true;
  }

  const message = update.message;
  if (!message?.from || !message.text || commandName(message.text) !== "/faq") return false;
  if (await handleFaqRepair(env, message)) return true;
  try {
    await clearFaqSession(env.DB, message.from.id);
    const result = await handleFaqCommand(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID, message.text);
    if (result.handled && result.text) {
      await sendMessage(env, message.chat.id, result.text, withClose(result.keyboard), {
        messageThreadId: message.message_thread_id,
      });
    }
    return result.handled;
  } catch {
    const language = await safeUserLanguage(env.DB, message.from.id);
    await sendMessage(env, message.chat.id, FAQ_STORAGE_UNAVAILABLE[language]);
    return true;
  }
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return app.fetch(request, env);
  }

  let update: TelegramUpdate;
  try {
    update = await request.clone().json<TelegramUpdate>();
  } catch {
    return app.fetch(request, env);
  }

  if (await handleFaqSurface(env, update)) return json({ ok: true });

  const message = update.message;
  const text = message?.text?.trim() ?? "";

  // Any command exits a pending FAQ text-input state before lower command
  // handling. This prevents /faq, /start, /cancel, etc. from ever becoming
  // canonical FAQ field values in legacy lower wrappers.
  if (message?.from && text.startsWith("/") && await activeFaqSession(env.DB, message.from.id)) {
    await clearFaqSession(env.DB, message.from.id);
    return app.fetch(request, env);
  }

  // Only ordinary text is intercepted for FAQ authoring.
  if (message?.from && text && !text.startsWith("/")) {
    try {
      const result = await consumeFaqAdminText(
        env.DB,
        message.from.id,
        env.BOT_OWNER_TELEGRAM_ID,
        text,
      );
      if (result.handled) {
        if (result.text) {
          await sendMessage(
            env,
            message.chat.id,
            result.text,
            result.keyboard,
            { messageThreadId: message.message_thread_id },
          );
        }
        await notifyMutation(env, message.from.id, result);
        return json({ ok: true });
      }

      if (await activeFaqSession(env.DB, message.from.id)) {
        await sendMessage(
          env,
          message.chat.id,
          "An FAQ draft is waiting for a button action. Use Generate, Manual Fill, Approve/Save, or Discard on the draft message. Use /cancel to leave the workflow.",
          undefined,
          { messageThreadId: message.message_thread_id },
        );
        return json({ ok: true });
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "FAQ content was rejected.";
      await sendMessage(env, message.chat.id, detail.startsWith("FAQ content rejected:") ? detail : "FAQ edit could not be saved safely. Review the draft and try again.");
      return json({ ok: true });
    }

    if (await serveDynamicFaqFastPath(env, message)) return json({ ok: true });
  }

  return app.fetch(request, env);
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
