import app from "./index";
import { syncCommandRegistryIfNeeded, syncUserCommandScope } from "./command_sync";
import { formatTelegramIdentity } from "./identity";

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
  chat: { id: number; type?: string };
  from?: TelegramUser;
};

type TelegramUpdate = {
  message?: TelegramMessage;
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
  ).bind(
    user.id,
    user.username ?? null,
    user.first_name ?? null,
    user.last_name ?? null,
  ).run();
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

async function handleWebhookWrapper(request: Request, env: Env): Promise<Response> {
  const raw = await request.text();
  let update: TelegramUpdate | null = null;
  try {
    update = JSON.parse(raw) as TelegramUpdate;
  } catch {
    // Preserve canonical invalid-JSON behavior in the underlying Worker.
  }

  const api = (method: string, body: unknown) => telegramApi(env, method, body);
  await syncCommandRegistryIfNeeded(env.DB, api, env.BOT_OWNER_TELEGRAM_ID);

  const message = update?.message;
  const text = message?.text?.trim() ?? "";

  if (message?.from) {
    try {
      await upsertIdentity(env.DB, message.from);
    } catch {
      // Identity refresh is useful metadata and must not block normal bot behavior.
    }

    const command = commandName(text);
    if (privateChat(message) && (command === "/start" || command === "/whoami")) {
      await syncUserCommandScope(env.DB, api, message.from.id, env.BOT_OWNER_TELEGRAM_ID);
    }

    if (command === "/whoami") {
      if (!privateChat(message)) {
        await telegramApi(env, "sendMessage", {
          chat_id: message.chat.id,
          text: "Please use /whoami in a private chat with this bot.",
        });
        return json({ ok: true });
      }

      await telegramApi(env, "sendMessage", {
        chat_id: message.chat.id,
        text: [
          "Your Telegram identity",
          formatTelegramIdentity(message.from),
          "",
          "Share the numeric ID with the Bot Owner if you need administrator or staff access.",
        ].join("\n"),
      });
      return json({ ok: true });
    }
  }

  const forwarded = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: raw,
  });
  const response = await app.fetch(forwarded, env);

  const targetId = sudoTarget(text);
  if (targetId !== null) {
    await syncUserCommandScope(env.DB, api, targetId, env.BOT_OWNER_TELEGRAM_ID);
  }

  return response;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleWebhookWrapper(request, env);
    }
    return app.fetch(request, env);
  },
};
