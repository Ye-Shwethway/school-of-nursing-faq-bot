import app from "./rate_limit_entry";
import type { Language } from "./faq";
import { checkInteractionFlood, interactionFloodMessage } from "./interaction_flood";
import { sweepExpiredHumanControls } from "./human_control_lease";

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

function isPrivate(message: TelegramMessage): boolean {
  return message.chat.type === "private" || message.chat.id === message.from?.id;
}

async function telegramApi(env: Env, method: string, body: unknown): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Flood protection must fail closed for the current update without creating retry noise.
  }
}

async function languageFor(db: D1Database | undefined, userId: number): Promise<Language> {
  if (!db) return "en";
  try {
    const row = await db.prepare(`SELECT language FROM users WHERE telegram_user_id=?1`)
      .bind(userId).first<{ language: string | null }>();
    return row?.language === "my" || row?.language === "zh" ? row.language : "en";
  } catch {
    return "en";
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
  if (callback?.message && isPrivate(callback.message)) {
    const decision = await checkInteractionFlood(env.DB, callback.from.id, env.BOT_OWNER_TELEGRAM_ID);
    if (!decision.allowed) {
      if (decision.notify) {
        const language = await languageFor(env.DB, callback.from.id);
        await telegramApi(env, "answerCallbackQuery", {
          callback_query_id: callback.id,
          text: interactionFloodMessage(language, decision.retryMinutes),
          show_alert: true,
        });
      }
      return json({ ok: true });
    }
  }

  const message = update.message;
  if (message?.from && isPrivate(message)) {
    const decision = await checkInteractionFlood(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID);
    if (!decision.allowed) {
      if (decision.notify) {
        const language = await languageFor(env.DB, message.from.id);
        await telegramApi(env, "sendMessage", {
          chat_id: message.chat.id,
          text: interactionFloodMessage(language, decision.retryMinutes),
        });
      }
      return json({ ok: true });
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

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    await sweepExpiredHumanControls(env);
  },
};
