import { handleAdminCommand } from "./admin";
import {
  aiSettingsKeyboard,
  aiStatus,
  bindSelectedModel,
  consumeAiSetupText,
  fetchProviderModels,
  startProviderSetup,
} from "./ai";
import { chooseModelForPing, selectedModelPassedPing, testSelectedModel } from "./ai_ping";
import { findFaq, type Language } from "./faq";

export interface Env {
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
  language_code?: string;
};

type TelegramMessage = {
  message_id: number;
  text?: string;
  chat: { id: number };
  from?: TelegramUser;
};

type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};

type TelegramUpdate = {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

function isOwner(userId: number, configuredOwnerId?: string): boolean {
  return Boolean(configuredOwnerId && String(userId) === configuredOwnerId.trim());
}

function languageKeyboard() {
  return {
    inline_keyboard: [[
      { text: "မြန်မာ", callback_data: "lang:my" },
      { text: "English", callback_data: "lang:en" },
      { text: "简体中文", callback_data: "lang:zh" },
    ]],
  };
}

const COPY: Record<Language, { selected: string; noMatch: string }> = {
  my: {
    selected: "ဘာသာစကားကို မြန်မာဘာသာအဖြစ် သတ်မှတ်ပြီးပါပြီ။ မေးလိုသည့် မေးခွန်းကို ပို့နိုင်ပါပြီ။",
    noMatch: "ဒီမေးခွန်းကို အတည်ပြုထားသော FAQ အချက်အလက်များဖြင့် ယုံကြည်စိတ်ချစွာ မဖြေနိုင်သေးပါ။ မေးခွန်းကို ဝန်ထမ်းများ ပြန်လည်စစ်ဆေးနိုင်ရန် မှတ်တမ်းတင်ထားပါသည်။",
  },
  en: {
    selected: "Language set to English. You can now send your question.",
    noMatch: "I cannot answer this confidently from the approved FAQ information yet. Your question has been recorded for authorized staff review.",
  },
  zh: {
    selected: "语言已设置为简体中文。现在可以发送您的问题。",
    noMatch: "目前无法仅根据已批准的 FAQ 信息可靠回答此问题。您的问题已记录，以便授权工作人员进一步核查。",
  },
};

async function telegramApi(env: Env, method: string, body: unknown) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN is not configured");
    return;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) console.error(`Telegram ${method} failed`, response.status);
}

async function sendTelegramMessage(env: Env, chatId: number, text: string, replyMarkup?: unknown) {
  await telegramApi(env, "sendMessage", { chat_id: chatId, text, reply_markup: replyMarkup });
}

async function deleteTelegramMessage(env: Env, chatId: number, messageId: number) {
  await telegramApi(env, "deleteMessage", { chat_id: chatId, message_id: messageId });
}

async function answerCallbackQuery(env: Env, callbackQueryId: string, text?: string) {
  await telegramApi(env, "answerCallbackQuery", { callback_query_id: callbackQueryId, text });
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

async function getLanguage(db: D1Database, telegramUserId: number): Promise<Language | null> {
  const row = await db.prepare(
    `SELECT language FROM users WHERE telegram_user_id = ?1`,
  ).bind(telegramUserId).first<{ language: Language | null }>();
  return row?.language ?? null;
}

async function setLanguage(db: D1Database, user: TelegramUser, language: Language) {
  await db.prepare(
    `INSERT INTO users
      (telegram_user_id, username, first_name, last_name, language, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       username = excluded.username,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       language = excluded.language,
       updated_at = CURRENT_TIMESTAMP`,
  ).bind(user.id, user.username ?? null, user.first_name ?? null, user.last_name ?? null, language).run();
}

async function logQuestion(
  db: D1Database,
  message: TelegramMessage,
  language: Language,
  resolution: "answered" | "pending",
  matchedFaqKey: string | null,
  answerSource: "canonical_faq" | "unresolved",
) {
  if (!message.from || !message.text) return;
  await db.prepare(
    `INSERT INTO questions
      (telegram_user_id, chat_id, message_id, question, language, resolution, matched_faq_key, answer_source)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  ).bind(
    message.from.id,
    message.chat.id,
    message.message_id,
    message.text,
    language,
    resolution,
    matchedFaqKey,
    answerSource,
  ).run();
}

async function handleLanguageCallback(env: Env, callback: TelegramCallbackQuery): Promise<boolean> {
  const match = callback.data?.match(/^lang:(my|en|zh)$/);
  if (!match) return false;

  const language = match[1] as Language;
  if (env.DB) await setLanguage(env.DB, callback.from, language);
  await answerCallbackQuery(env, callback.id);
  if (callback.message) await sendTelegramMessage(env, callback.message.chat.id, COPY[language].selected);
  return true;
}

async function handleAiCallback(env: Env, callback: TelegramCallbackQuery): Promise<boolean> {
  const data = callback.data ?? "";
  if (!data.startsWith("ai:")) return false;

  if (!isOwner(callback.from.id, env.BOT_OWNER_TELEGRAM_ID)) {
    await answerCallbackQuery(env, callback.id, "Owner only");
    return true;
  }

  const chatId = callback.message?.chat.id;
  if (!chatId) {
    await answerCallbackQuery(env, callback.id);
    return true;
  }

  await answerCallbackQuery(env, callback.id);

  if (data === "ai:menu") {
    await sendTelegramMessage(env, chatId, "AI Agent Settings\nChoose a provider or view the current binding.", aiSettingsKeyboard());
    return true;
  }

  if (data === "ai:status") {
    await sendTelegramMessage(env, chatId, await aiStatus(env.DB), aiSettingsKeyboard());
    return true;
  }

  if (data === "ai:ping") {
    const result = await testSelectedModel(env, callback.from.id);
    await sendTelegramMessage(env, chatId, result.text, result.keyboard);
    return true;
  }

  const providerMatch = data.match(/^ai:provider:([a-z0-9_-]+)$/);
  if (providerMatch) {
    const result = await startProviderSetup(env.DB, callback.from.id, providerMatch[1]);
    await sendTelegramMessage(env, chatId, result.text, result.keyboard);
    return true;
  }

  const fetchMatch = data.match(/^ai:fetch:([a-z0-9_-]+)$/);
  if (fetchMatch) {
    const result = await fetchProviderModels(env, callback.from.id, fetchMatch[1]);
    await sendTelegramMessage(env, chatId, result.text, result.keyboard);
    return true;
  }

  const modelMatch = data.match(/^ai:model:([a-z0-9_-]+):([A-Za-z0-9_-]+)$/);
  if (modelMatch) {
    const result = await chooseModelForPing(env.DB, callback.from.id, modelMatch[1], modelMatch[2]);
    await sendTelegramMessage(env, chatId, result.text, result.keyboard);
    return true;
  }

  const bindMatch = data.match(/^ai:bind:(primary|fallback)$/);
  if (bindMatch) {
    if (!(await selectedModelPassedPing(env.DB, callback.from.id))) {
      await sendTelegramMessage(env, chatId, "Run Test Ping successfully before binding this model.");
      return true;
    }
    const response = await bindSelectedModel(env.DB, callback.from.id, bindMatch[1] as "primary" | "fallback");
    await sendTelegramMessage(env, chatId, response, aiSettingsKeyboard());
    return true;
  }

  await sendTelegramMessage(env, chatId, "Unknown AI settings action.", aiSettingsKeyboard());
  return true;
}

async function handleMessage(env: Env, message: TelegramMessage) {
  if (!message.from) return;
  if (env.DB) await upsertUser(env.DB, message.from);

  const text = message.text?.trim() ?? "";
  if (!text) return;

  if (isOwner(message.from.id, env.BOT_OWNER_TELEGRAM_ID)) {
    const setup = await consumeAiSetupText(env, message.from.id, text);
    if (setup.handled) {
      if (setup.secretInput) await deleteTelegramMessage(env, message.chat.id, message.message_id);
      if (setup.text) await sendTelegramMessage(env, message.chat.id, setup.text, setup.keyboard);
      return;
    }
  }

  if (text === "/start" || text === "/language") {
    await sendTelegramMessage(
      env,
      message.chat.id,
      "Please choose your language.\nဘာသာစကား ရွေးချယ်ပါ။\n请选择语言。",
      languageKeyboard(),
    );
    return;
  }

  if (text === "/ai" || text === "/ai settings") {
    if (!isOwner(message.from.id, env.BOT_OWNER_TELEGRAM_ID)) {
      await sendTelegramMessage(env, message.chat.id, "This setting is available to the Bot Owner only.");
      return;
    }
    await sendTelegramMessage(
      env,
      message.chat.id,
      "AI Agent Settings\nChoose a provider, save a key, fetch models, select a model, pass Test Ping, then bind primary and fallback models.",
      aiSettingsKeyboard(),
    );
    return;
  }

  const admin = await handleAdminCommand(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID, text);
  if (admin.handled) {
    if (admin.response) await sendTelegramMessage(env, message.chat.id, admin.response);
    return;
  }

  const language = env.DB ? await getLanguage(env.DB, message.from.id) : null;
  if (!language) {
    await sendTelegramMessage(
      env,
      message.chat.id,
      "Please choose your language.\nဘာသာစကား ရွေးချယ်ပါ။\n请选择语言。",
      languageKeyboard(),
    );
    return;
  }

  const faq = findFaq(text, language);
  if (faq) {
    if (env.DB) await logQuestion(env.DB, message, language, "answered", faq.key, "canonical_faq");
    await sendTelegramMessage(env, message.chat.id, faq.answer[language]);
    return;
  }

  if (env.DB) await logQuestion(env.DB, message, language, "pending", null, "unresolved");
  await sendTelegramMessage(env, message.chat.id, COPY[language].noMatch);
}

async function handleTelegramWebhook(request: Request, env: Env) {
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false }, 401);
  }

  let update: TelegramUpdate;
  try {
    update = await request.json<TelegramUpdate>();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (update.callback_query) {
    const handledAi = await handleAiCallback(env, update.callback_query);
    if (!handledAi) await handleLanguageCallback(env, update.callback_query);
  }

  if (update.message) await handleMessage(env, update.message);
  return json({ ok: true });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "school-of-nursing-faq-bot", environment: env.APP_ENV });
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleTelegramWebhook(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};
