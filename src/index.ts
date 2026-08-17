export interface Env {
  APP_ENV: string;
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  GEMINI_API_KEY?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
}

type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  language_code?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number };
  from?: TelegramUser;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function languageKeyboard() {
  return {
    inline_keyboard: [[
      { text: "မြန်မာ", callback_data: "lang:my" },
      { text: "English", callback_data: "lang:en" },
      { text: "简体中文", callback_data: "lang:zh" },
    ]],
  };
}

async function sendTelegramMessage(
  env: Env,
  chatId: number,
  text: string,
  replyMarkup?: unknown,
) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN is not configured");
    return;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        reply_markup: replyMarkup,
      }),
    },
  );

  if (!response.ok) {
    console.error("Telegram sendMessage failed", response.status);
  }
}

async function upsertUser(db: D1Database, user: TelegramUser) {
  await db.prepare(
    `INSERT INTO users (telegram_user_id, username, first_name, last_name, updated_at)
     VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       username = excluded.username,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(user.id, user.username ?? null, user.first_name ?? null, user.last_name ?? null).run();
}

async function logQuestion(db: D1Database, message: TelegramMessage) {
  if (!message.from || !message.text) return;

  await db.prepare(
    `INSERT INTO questions
      (telegram_user_id, chat_id, message_id, question, resolution)
     VALUES (?1, ?2, ?3, ?4, 'pending')`,
  ).bind(
    message.from.id,
    message.chat.id,
    message.message_id,
    message.text,
  ).run();
}

async function handleMessage(env: Env, message: TelegramMessage) {
  if (!message.from) return;

  if (env.DB) {
    await upsertUser(env.DB, message.from);
  }

  const text = message.text?.trim() ?? "";

  if (text === "/start" || text === "/language") {
    await sendTelegramMessage(
      env,
      message.chat.id,
      "Please choose your language.\nဘာသာစကား ရွေးချယ်ပါ။\n请选择语言。",
      languageKeyboard(),
    );
    return;
  }

  if (text && env.DB) {
    await logQuestion(env.DB, message);
  }

  if (text) {
    await sendTelegramMessage(
      env,
      message.chat.id,
      "Your question has been recorded. The FAQ answer engine is being connected in the next implementation slice.",
    );
  }
}

async function handleTelegramWebhook(request: Request, env: Env) {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) {
      return json({ ok: false }, 401);
    }
  }

  let update: TelegramUpdate;
  try {
    update = await request.json<TelegramUpdate>();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (update.message) {
    await handleMessage(env, update.message);
  }

  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({
        ok: true,
        service: "school-of-nursing-faq-bot",
        environment: env.APP_ENV,
      });
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleTelegramWebhook(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};
