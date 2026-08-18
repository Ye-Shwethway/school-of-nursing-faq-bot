import app from "./cases_entry";
import { consumeFaqAdminText, handleFaqCallback, type FaqUiResponse } from "./faq_admin";
import { notifyFaqChange } from "./faq_notify";

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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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

  const callback = update.callback_query;
  if (callback?.data === "faq:draft:generate") {
    const result = await handleFaqCallback(
      env.DB,
      callback.from.id,
      env.BOT_OWNER_TELEGRAM_ID,
      callback.data,
      { DB: env.DB, AI_CONFIG_MASTER_KEY: env.AI_CONFIG_MASTER_KEY },
    );
    await telegramApi(env, "answerCallbackQuery", { callback_query_id: callback.id });
    if (callback.message && result.text) await editOrSend(env, callback.message, result.text, result.keyboard);
    return json({ ok: true });
  }

  const message = update.message;
  if (message?.from && message.text) {
    try {
      const result = await consumeFaqAdminText(
        env.DB,
        message.from.id,
        env.BOT_OWNER_TELEGRAM_ID,
        message.text,
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
    } catch {
      // Let the canonical lower stack handle non-authoring messages or transient failures.
    }
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
