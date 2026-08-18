import app from "./staff_presence_entry";
import { handleCasesCallback, handleCasesCommand, type CasesUiResponse } from "./cases";
import { getStaffInboxChatId } from "./handoff";

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
type TelegramUpdate = { message?: TelegramMessage; callback_query?: TelegramCallbackQuery };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
}

function isGroup(message: TelegramMessage): boolean {
  return message.chat.type === "group" || message.chat.type === "supergroup";
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

async function sendMessage(env: Env, chatId: number, text: string, keyboard?: unknown): Promise<void> {
  await telegramApi(env, "sendMessage", { chat_id: chatId, text, reply_markup: keyboard });
}

async function editOrSend(env: Env, message: TelegramMessage, result: CasesUiResponse): Promise<void> {
  if (!result.text) return;
  const edited = await telegramApi(env, "editMessageText", {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text: result.text,
    reply_markup: result.keyboard,
  });
  if (!edited) await sendMessage(env, message.chat.id, result.text, result.keyboard);
}

async function activeStaffGroup(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!isGroup(message)) return true;
  if (!env.DB) return false;
  return (await getStaffInboxChatId(env.DB)) === message.chat.id;
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
  if (callback?.data?.startsWith("cases:")) {
    if (callback.message && !await activeStaffGroup(env, callback.message)) {
      await telegramApi(env, "answerCallbackQuery", { callback_query_id: callback.id, text: "Use /cases privately or in the active Staff Inbox." });
      return json({ ok: true });
    }
    const result = await handleCasesCallback(env.DB, callback.from.id, env.BOT_OWNER_TELEGRAM_ID, callback.data);
    await telegramApi(env, "answerCallbackQuery", { callback_query_id: callback.id });
    if (callback.message) await editOrSend(env, callback.message, result);
    return json({ ok: true });
  }

  const message = update.message;
  if (message?.from && commandName(message.text ?? "") === "/cases") {
    if (!await activeStaffGroup(env, message)) {
      await sendMessage(env, message.chat.id, "Use /cases in a private chat with the bot or inside the active Staff Inbox group.");
      return json({ ok: true });
    }
    const result = await handleCasesCommand(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID, message.text ?? "");
    if (result.text) await sendMessage(env, message.chat.id, result.text, result.keyboard);
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
