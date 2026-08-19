import app from "./input_quality_entry";
import { consumeFaqAdminText, handleFaqCallback, handleFaqCommand, type FaqUiResponse } from "./faq_admin";
import { notifyFaqChange } from "./faq_notify";
import { findFaqDynamic } from "./faq_store";
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
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

async function activeFaqDraftState(db: D1Database | undefined, userId: number): Promise<string | null> {
  if (!db) return null;
  try {
    const row = await db.prepare(
      `SELECT state FROM admin_sessions WHERE telegram_user_id=?1 AND state LIKE 'faq_draft_%'`,
    ).bind(userId).first<{ state: string }>();
    return row?.state ?? null;
  } catch {
    return null;
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

async function serveDynamicFaqFastPath(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text || !isPrivate(message)) return false;
  const text = message.text.trim();
  if (!text || text.startsWith("/") || await hasInteractiveSession(env.DB, message.from.id)) return false;

  try {
    const control = await getConversationControl(env.DB, message.from.id);
    if (control.mode === "human") return false;

    const language = await userLanguage(env.DB, message.from.id);
    if (!language) return false;
    const faq = await findFaqDynamic(env.DB, text, language);
    if (!faq) return false;

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

    await sendMessage(
      env,
      message.chat.id,
      faq.answer[language],
      undefined,
      { replyToMessageId: message.message_id },
    );
    return true;
  } catch {
    // Never answer from the static seed after a live-store failure. A later
    // canonical layer may provide a safe operational fallback, but stale FAQ
    // content must not be served as approved production knowledge.
    return false;
  }
}

async function handleFaqSurface(env: Env, update: TelegramUpdate): Promise<boolean> {
  const callback = update.callback_query;
  if (callback?.data?.startsWith("faq:")) {
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
    return true;
  }

  const message = update.message;
  if (!message?.from || !message.text || commandName(message.text) !== "/faq") return false;
  const result = await handleFaqCommand(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID, message.text);
  if (result.handled && result.text) {
    await sendMessage(env, message.chat.id, result.text, withClose(result.keyboard), {
      messageThreadId: message.message_thread_id,
    });
  }
  return result.handled;
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
  // Commands such as /cancel and /reset belong to the canonical lower UX layer.
  // Only ordinary text is intercepted here so FAQ authoring inside Staff Inbox
  // cannot be mistaken for a staff reply to a user topic.
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

      if (await activeFaqDraftState(env.DB, message.from.id)) {
        await sendMessage(
          env,
          message.chat.id,
          "An FAQ draft is waiting for a button action. Use Generate, Manual Fill, Approve/Save, or Discard on the draft message. Use /cancel to leave the workflow.",
          undefined,
          { messageThreadId: message.message_thread_id },
        );
        return json({ ok: true });
      }
    } catch {
      // Let the canonical lower stack handle non-authoring messages or transient failures.
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
