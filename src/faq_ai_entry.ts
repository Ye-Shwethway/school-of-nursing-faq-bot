import app from "./cases_entry";
import { handleFaqCallback } from "./faq_admin";

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
type TelegramUpdate = { callback_query?: TelegramCallbackQuery };

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

async function editOrSend(env: Env, message: TelegramMessage, text: string, keyboard?: unknown): Promise<void> {
  const edited = await telegramApi(env, "editMessageText", {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text,
    reply_markup: keyboard,
  });
  if (!edited) {
    await telegramApi(env, "sendMessage", {
      chat_id: message.chat.id,
      text,
      reply_markup: keyboard,
    });
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
    if (callback.message && result.text) {
      await editOrSend(env, callback.message, result.text, result.keyboard);
    }
    return json({ ok: true });
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
