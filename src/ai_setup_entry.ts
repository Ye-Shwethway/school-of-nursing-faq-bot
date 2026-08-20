import app from "./pre_faq_quality_entry";
import { consumeAiSetupText } from "./ai";

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
type TelegramUpdate = { message?: TelegramMessage };

type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function ownerId(env: Env): number | null {
  const raw = env.BOT_OWNER_TELEGRAM_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function privateChat(message: TelegramMessage): boolean {
  return Boolean(message.from && (message.chat.type === "private" || message.chat.id === message.from.id));
}

function withClose(keyboard?: unknown): unknown {
  if (!keyboard || typeof keyboard !== "object" || !Array.isArray((keyboard as InlineKeyboard).inline_keyboard)) {
    return keyboard;
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

async function sendMessage(env: Env, chatId: number, text: string, keyboard?: unknown): Promise<boolean> {
  const result = await telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: withClose(keyboard),
  });
  return Boolean(result);
}

async function deleteMessage(env: Env, chatId: number, messageId: number): Promise<void> {
  await telegramApi(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function activeAiSetupState(db: D1Database | undefined, userId: number): Promise<string | null> {
  if (!db) return null;
  try {
    const row = await db.prepare(
      `SELECT state FROM admin_sessions
       WHERE telegram_user_id=?1 AND state LIKE 'awaiting_ai_%'`,
    ).bind(userId).first<{ state: string }>();
    return row?.state ?? null;
  } catch {
    return null;
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

  const message = update.message;
  if (!message?.from || !message.text) return app.fetch(request, env);

  const configuredOwner = ownerId(env);
  if (configuredOwner === null || message.from.id !== configuredOwner) return app.fetch(request, env);

  const state = await activeAiSetupState(env.DB, configuredOwner);
  if (!state) return app.fetch(request, env);

  const text = message.text.trim();
  if (!text || text.startsWith("/")) return app.fetch(request, env);

  if (!privateChat(message)) {
    await sendMessage(
      env,
      message.chat.id,
      "AI provider setup is active, but API keys can only be entered in a private chat with this bot. Continue privately or use /cancel.",
    );
    return json({ ok: true });
  }

  try {
    const result = await consumeAiSetupText(env, configuredOwner, text);
    if (!result.handled) return app.fetch(request, env);

    if (result.secretInput) await deleteMessage(env, message.chat.id, message.message_id);
    if (result.text) {
      const sent = await sendMessage(env, message.chat.id, result.text, result.keyboard);
      if (!sent) {
        return json({ ok: false, error: "ai_setup_reply_failed" }, 502);
      }
    }
    return json({ ok: true, ai_setup: state });
  } catch (error) {
    await deleteMessage(env, message.chat.id, message.message_id);
    const detail = error instanceof Error ? error.message : "unknown error";
    const masterKeyProblem = detail.includes("AI_CONFIG_MASTER_KEY") || detail.toLowerCase().includes("base64");
    const reply = masterKeyProblem
      ? "AI setup could not encrypt the API key because AI_CONFIG_MASTER_KEY is invalid. It must be Base64 for exactly 32 random bytes. Correct the Cloudflare secret, deploy, then run /ai and try again."
      : "AI setup could not save the API key because of a server-side configuration error. The submitted key was not stored. Run /ai and try again after the configuration is corrected.";
    const sent = await sendMessage(env, message.chat.id, reply);
    return json({ ok: sent, error: "ai_setup_failed" }, sent ? 200 : 502);
  }
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
