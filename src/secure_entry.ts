import runtime from "./runtime_entry";
import { consumeAiSetupText } from "./ai";

type Env = {
  APP_ENV: string;
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
  AI_CONFIG_MASTER_KEY?: string;
};

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

type Language = "my" | "en" | "zh";

type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data?: string; url?: string }>>;
};

function json(body: unknown, status = 200) {
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

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
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

function faqFirstKeyboard(language: Language): InlineKeyboard {
  const labels: Record<Language, string> = {
    my: "📚 FAQ များကြည့်ရန်",
    en: "📚 Browse FAQ",
    zh: "📚 查看常见问题",
  };
  return {
    inline_keyboard: [[{ text: labels[language], callback_data: "faq:list:0" }]],
  };
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
  await telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: withClose(keyboard),
  });
}

async function deleteMessage(env: Env, chatId: number, messageId: number): Promise<void> {
  await telegramApi(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function setLanguage(
  db: D1Database | undefined,
  user: TelegramUser,
  language: Language,
): Promise<void> {
  if (!db) return;
  await db.prepare(
    `INSERT INTO users
      (telegram_user_id, username, first_name, last_name, language, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       username=excluded.username,
       first_name=excluded.first_name,
       last_name=excluded.last_name,
       language=excluded.language,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(
    user.id,
    user.username ?? null,
    user.first_name ?? null,
    user.last_name ?? null,
    language,
  ).run();
}

async function handleLanguageSelection(
  env: Env,
  callback: TelegramCallbackQuery,
): Promise<boolean> {
  const match = callback.data?.match(/^lang:(my|en|zh)$/);
  if (!match) return false;

  const language = match[1] as Language;
  const confirmations: Record<Language, string> = {
    my: "ဘာသာစကားကို မြန်မာဘာသာအဖြစ် သတ်မှတ်ပြီးပါပြီ။\n\nအများအားဖြင့် မေးလေ့ရှိသော အချက်အလက်များအတွက် /faq ကို အရင်ကြည့်ရှုပါ။ သင်မေးလိုသောအကြောင်းအရာ မပါရှိသေးပါက ဒီနေရာမှာ စာရိုက်ပြီး မေးမြန်းနိုင်ပါတယ်။",
    en: "Language set to English.\n\nFor common questions, please check /faq first. If your question is not covered there, you can send it here and the assistant will help.",
    zh: "语言已设置为简体中文。\n\n常见问题请先查看 /faq。如果没有找到您需要的信息，可以直接在这里发送问题。",
  };

  try {
    await setLanguage(env.DB, callback.from, language);
  } catch {
    await telegramApi(env, "answerCallbackQuery", {
      callback_query_id: callback.id,
      text: "Could not save the language. Please try again.",
      show_alert: true,
    });
    return true;
  }

  await telegramApi(env, "answerCallbackQuery", { callback_query_id: callback.id });

  if (callback.message) {
    await deleteMessage(env, callback.message.chat.id, callback.message.message_id);
    await sendMessage(
      env,
      callback.message.chat.id,
      confirmations[language],
      faqFirstKeyboard(language),
    );
  }
  return true;
}

async function activeAiSetupState(db: D1Database | undefined, telegramUserId: number): Promise<string | null> {
  if (!db) return null;
  try {
    const row = await db.prepare(
      `SELECT state FROM admin_sessions
       WHERE telegram_user_id=?1 AND state LIKE 'awaiting_ai_%'`,
    ).bind(telegramUserId).first<{ state: string }>();
    return row?.state ?? null;
  } catch {
    return null;
  }
}

async function clearAiSetup(db: D1Database | undefined, telegramUserId: number): Promise<boolean> {
  if (!db) return false;
  try {
    const result = await db.prepare(
      `DELETE FROM admin_sessions
       WHERE telegram_user_id=?1 AND state LIKE 'awaiting_ai_%'`,
    ).bind(telegramUserId).run();
    return (result.meta.changes ?? 0) > 0;
  } catch {
    return false;
  }
}

async function forward(request: Request, raw: string, env: Env): Promise<Response> {
  const forwarded = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: raw,
  });
  return runtime.fetch(forwarded, env);
}

async function handleWebhook(request: Request, env: Env): Promise<Response> {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false }, 401);
  }

  const raw = await request.text();
  let update: TelegramUpdate;
  try {
    update = JSON.parse(raw) as TelegramUpdate;
  } catch {
    return forward(request, raw, env);
  }

  if (update.callback_query && await handleLanguageSelection(env, update.callback_query)) {
    return json({ ok: true });
  }

  const message = update.message;
  if (!message?.from || !message.text) return forward(request, raw, env);

  const configuredOwner = ownerId(env);
  if (configuredOwner === null || message.from.id !== configuredOwner) {
    return forward(request, raw, env);
  }

  const text = message.text.trim();
  const command = commandName(text);
  const state = await activeAiSetupState(env.DB, configuredOwner);

  if (command === "/start") {
    if (state) await clearAiSetup(env.DB, configuredOwner);
    return forward(request, raw, env);
  }

  // ux_entry owns the canonical /cancel and /reset semantics. These remain as
  // migration-safe fallbacks if secure_entry is ever invoked directly.
  if (command === "/cancel" || command === "/reset") {
    const cleared = await clearAiSetup(env.DB, configuredOwner);
    await sendMessage(
      env,
      message.chat.id,
      cleared
        ? "AI setup cancelled and reset. Use /ai to start again."
        : "No AI setup session is active. Use /ai to open AI settings.",
    );
    return json({ ok: true });
  }

  if (!state) return forward(request, raw, env);

  if (!privateChat(message)) {
    await sendMessage(
      env,
      message.chat.id,
      "AI provider setup is active, but API keys can only be entered in a private chat with this bot. Open the bot privately and continue there, or use /cancel to reset the setup.",
    );
    return json({ ok: true });
  }

  if (text.startsWith("/")) {
    if (command === "/ai") {
      await clearAiSetup(env.DB, configuredOwner);
      return forward(request, raw, env);
    }
    await sendMessage(
      env,
      message.chat.id,
      "AI setup is waiting for input. Send the requested value, or use /cancel, /reset, /start, or /ai to leave this setup.",
    );
    return json({ ok: true });
  }

  let setup: Awaited<ReturnType<typeof consumeAiSetupText>>;
  try {
    setup = await consumeAiSetupText(env, configuredOwner, text);
  } catch (error) {
    await deleteMessage(env, message.chat.id, message.message_id);
    const detail = error instanceof Error ? error.message : "unknown error";
    const masterKeyProblem = detail.includes("AI_CONFIG_MASTER_KEY");
    await sendMessage(
      env,
      message.chat.id,
      masterKeyProblem
        ? "AI setup could not encrypt the API key because AI_CONFIG_MASTER_KEY is invalid. Configure it as Base64 for exactly 32 random bytes, then run /ai and try again."
        : "AI setup could not save the API key because of a server-side configuration error. The submitted key was not stored. Run /ai and try again after the configuration is corrected.",
    );
    return json({ ok: true });
  }

  if (!setup.handled) return forward(request, raw, env);

  if (setup.secretInput) {
    await deleteMessage(env, message.chat.id, message.message_id);
  }
  if (setup.text) {
    await sendMessage(env, message.chat.id, setup.text, setup.keyboard);
  }
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleWebhook(request, env);
    }
    return runtime.fetch(request, env);
  },
};
