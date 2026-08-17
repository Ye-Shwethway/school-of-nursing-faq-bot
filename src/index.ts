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
import {
  addStaffMember,
  attachStaffMessage,
  caseForStaffReply,
  claimCase,
  createEscalationCase,
  getDedicatedStaffId,
  getHandoffDestination,
  handoffStatus,
  logStaffReply,
  removeStaffMember,
  resolveCase,
  setDedicatedStaff,
  setHandoffRoute,
  setStaffInbox,
} from "./handoff";
import { getAgentPersona, setAgentPersona } from "./persona";

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
  chat: { id: number; type?: string; title?: string };
  from?: TelegramUser;
  reply_to_message?: TelegramMessage;
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

function configuredOwnerId(value?: string): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
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

function aiMenuKeyboard() {
  const base = aiSettingsKeyboard() as {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
  return {
    inline_keyboard: [
      ...base.inline_keyboard,
      [
        { text: "Male persona", callback_data: "ai:persona:male" },
        { text: "Female persona", callback_data: "ai:persona:female" },
      ],
    ],
  };
}

const COPY: Record<Language, { selected: string; noMatch: string }> = {
  my: {
    selected: "ဘာသာစကားကို မြန်မာဘာသာအဖြစ် သတ်မှတ်ပြီးပါပြီ။ မေးလိုသည့် မေးခွန်းကို ပို့နိုင်ပါပြီ။",
    noMatch: "ဒီမေးခွန်းကို အတည်ပြုထားသော အချက်အလက်များဖြင့် ယုံကြည်စိတ်ချစွာ မဖြေနိုင်သေးပါ။ မေးခွန်းကို School of Nursing ဝန်ထမ်းများ ပြန်လည်စစ်ဆေးနိုင်ရန် လွှဲပို့ထားပါသည်။",
  },
  en: {
    selected: "Language set to English. You can now send your question.",
    noMatch: "I cannot answer this confidently from the approved information. Your question has been forwarded to authorized School of Nursing staff for review.",
  },
  zh: {
    selected: "语言已设置为简体中文。现在可以发送您的问题。",
    noMatch: "目前无法根据已批准的信息可靠回答此问题。您的问题已转交给护理学院授权工作人员进一步核查。",
  },
};

async function telegramApi(env: Env, method: string, body: unknown): Promise<any | null> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN is not configured");
    return null;
  }

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    console.error(`Telegram ${method} failed`, response.status);
    return null;
  }

  try {
    const payload = await response.json<any>();
    return payload?.result ?? null;
  } catch {
    return null;
  }
}

async function sendTelegramMessage(
  env: Env,
  chatId: number,
  text: string,
  replyMarkup?: unknown,
): Promise<any | null> {
  return telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: replyMarkup,
  });
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
  ).bind(
    user.id,
    user.username ?? null,
    user.first_name ?? null,
    user.last_name ?? null,
    language,
  ).run();
}

async function logQuestion(
  db: D1Database,
  message: TelegramMessage,
  language: Language,
  resolution: "answered" | "pending",
  matchedFaqKey: string | null,
  answerSource: "canonical_faq" | "unresolved",
): Promise<number | null> {
  if (!message.from || !message.text) return null;
  const result = await db.prepare(
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
  const id = Number(result.meta.last_row_id);
  return Number.isSafeInteger(id) ? id : null;
}

async function handleLanguageCallback(env: Env, callback: TelegramCallbackQuery): Promise<boolean> {
  const match = callback.data?.match(/^lang:(my|en|zh)$/);
  if (!match) return false;

  const language = match[1] as Language;
  if (env.DB) await setLanguage(env.DB, callback.from, language);
  await answerCallbackQuery(env, callback.id);
  if (callback.message) {
    await sendTelegramMessage(env, callback.message.chat.id, COPY[language].selected);
  }
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
    const persona = await getAgentPersona(env.DB);
    await sendTelegramMessage(
      env,
      chatId,
      `AI Agent Settings\nPersona: ${persona}\nChoose a provider, model, or persona.`,
      aiMenuKeyboard(),
    );
    return true;
  }

  if (data === "ai:status") {
    const persona = await getAgentPersona(env.DB);
    await sendTelegramMessage(
      env,
      chatId,
      `${await aiStatus(env.DB)}\nPersona: ${persona}`,
      aiMenuKeyboard(),
    );
    return true;
  }

  const personaMatch = data.match(/^ai:persona:(male|female)$/);
  if (personaMatch) {
    const response = await setAgentPersona(
      env.DB,
      callback.from.id,
      personaMatch[1] as "male" | "female",
    );
    await sendTelegramMessage(env, chatId, response, aiMenuKeyboard());
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
    const result = await chooseModelForPing(
      env.DB,
      callback.from.id,
      modelMatch[1],
      modelMatch[2],
    );
    await sendTelegramMessage(env, chatId, result.text, result.keyboard);
    return true;
  }

  const bindMatch = data.match(/^ai:bind:(primary|fallback)$/);
  if (bindMatch) {
    if (!(await selectedModelPassedPing(env.DB, callback.from.id))) {
      await sendTelegramMessage(env, chatId, "Run Test Ping successfully before binding this model.");
      return true;
    }
    const response = await bindSelectedModel(
      env.DB,
      callback.from.id,
      bindMatch[1] as "primary" | "fallback",
    );
    await sendTelegramMessage(env, chatId, response, aiMenuKeyboard());
    return true;
  }

  await sendTelegramMessage(env, chatId, "Unknown AI settings action.", aiMenuKeyboard());
  return true;
}

async function handleCaseCallback(env: Env, callback: TelegramCallbackQuery): Promise<boolean> {
  const data = callback.data ?? "";
  const match = data.match(/^case:(claim|resolve):(\d+)$/);
  if (!match) return false;

  const caseId = Number(match[2]);
  if (!Number.isSafeInteger(caseId)) return true;

  if (match[1] === "claim") {
    const result = await claimCase(env.DB, caseId, callback.from.id);
    await answerCallbackQuery(env, callback.id, result.message);
    if (result.ok && callback.message) {
      await sendTelegramMessage(
        env,
        callback.message.chat.id,
        `${result.message}\nReply directly to the original case message to answer anonymously.`,
        { inline_keyboard: [[{ text: "Resolve", callback_data: `case:resolve:${caseId}` }]] },
      );
    }
    return true;
  }

  const result = await resolveCase(env.DB, caseId, callback.from.id);
  await answerCallbackQuery(env, callback.id, result.message);
  if (callback.message) {
    await sendTelegramMessage(env, callback.message.chat.id, result.message);
  }
  return true;
}

function staffCaseText(
  caseId: number,
  message: TelegramMessage,
  language: Language,
  route: "group" | "dedicated",
): string {
  const displayName = [message.from?.first_name, message.from?.last_name]
    .filter(Boolean)
    .join(" ") || "—";

  return [
    `New FAQ Escalation #${caseId}`,
    `Route: ${route}`,
    `Language: ${language}`,
    `User ID: ${message.from?.id ?? "—"}`,
    `Username: ${message.from?.username ? `@${message.from.username}` : "—"}`,
    `Name: ${displayName}`,
    "",
    message.text ?? "",
  ].join("\n");
}

async function notifyOwnerOfUndeliveredCase(env: Env, caseId: number): Promise<void> {
  const ownerId = configuredOwnerId(env.BOT_OWNER_TELEGRAM_ID);
  if (!ownerId) return;
  await sendTelegramMessage(
    env,
    ownerId,
    `Human handoff warning\nCase #${caseId} is queued in D1 but no configured staff destination accepted the notification.`,
  );
}

async function postEscalationToStaff(
  env: Env,
  message: TelegramMessage,
  language: Language,
  sourceQuestionId: number | null,
): Promise<void> {
  if (!env.DB || !message.from || !message.text) return;

  const destination = await getHandoffDestination(env.DB);
  const caseId = await createEscalationCase(env.DB, {
    telegramUserId: message.from.id,
    sourceQuestionId,
    language,
    question: message.text,
    staffChatId: destination?.chatId ?? null,
  });
  if (!caseId) return;

  if (!destination) {
    await notifyOwnerOfUndeliveredCase(env, caseId);
    return;
  }

  const staffMessage = await sendTelegramMessage(
    env,
    destination.chatId,
    staffCaseText(caseId, message, language, destination.route),
    { inline_keyboard: [[{ text: "Take Over", callback_data: `case:claim:${caseId}` }]] },
  );

  if (staffMessage?.message_id) {
    await attachStaffMessage(env.DB, caseId, destination.chatId, Number(staffMessage.message_id));
    return;
  }

  await notifyOwnerOfUndeliveredCase(env, caseId);
}

async function handleStaffReply(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text || !message.reply_to_message) return false;

  const target = await caseForStaffReply(
    env.DB,
    message.chat.id,
    message.reply_to_message.message_id,
    message.from.id,
  );
  if (!target) return false;

  await sendTelegramMessage(
    env,
    target.telegramUserId,
    `School of Nursing Staff\n\n${message.text}`,
  );
  await logStaffReply(env.DB, target.caseId, message.from.id, message.text);
  await sendTelegramMessage(
    env,
    message.chat.id,
    `Reply delivered anonymously for Case #${target.caseId}.`,
  );
  return true;
}

async function handleStaffCommand(env: Env, message: TelegramMessage, text: string): Promise<boolean> {
  if (!message.from || !text.startsWith("/staff")) return false;
  if (!isOwner(message.from.id, env.BOT_OWNER_TELEGRAM_ID)) {
    await sendTelegramMessage(
      env,
      message.chat.id,
      "Staff configuration is available to the Bot Owner only.",
    );
    return true;
  }

  if (text === "/staff inbox here") {
    await sendTelegramMessage(
      env,
      message.chat.id,
      await setStaffInbox(env.DB, message.from.id, message.chat.id),
    );
    return true;
  }

  if (text === "/staff status") {
    await sendTelegramMessage(env, message.chat.id, await handoffStatus(env.DB));
    return true;
  }

  const routeMatch = text.match(/^\/staff route (auto|group|dedicated)$/);
  if (routeMatch) {
    await sendTelegramMessage(
      env,
      message.chat.id,
      await setHandoffRoute(env.DB, message.from.id, routeMatch[1] as "auto" | "group" | "dedicated"),
    );
    return true;
  }

  const dedicatedMatch = text.match(/^\/staff dedicated (\d+)$/);
  if (dedicatedMatch) {
    const staffId = Number(dedicatedMatch[1]);
    if (!Number.isSafeInteger(staffId)) {
      await sendTelegramMessage(env, message.chat.id, "Invalid Telegram user ID.");
      return true;
    }

    const probe = await sendTelegramMessage(
      env,
      staffId,
      "School of Nursing Staff assignment check\n\nThe Bot Owner is assigning you as a dedicated human responder. If you can read this, private handoff delivery is available.",
    );

    if (!probe) {
      await sendTelegramMessage(
        env,
        message.chat.id,
        "Dedicated staff was not saved because the bot could not reach that private chat. Ask the staff member to open the bot and send /start, then retry.",
      );
      return true;
    }

    await sendTelegramMessage(
      env,
      message.chat.id,
      await setDedicatedStaff(env.DB, message.from.id, staffId),
    );
    return true;
  }

  const addMatch = text.match(/^\/staff add (\d+)$/);
  if (addMatch) {
    await sendTelegramMessage(
      env,
      message.chat.id,
      await addStaffMember(env.DB, message.from.id, Number(addMatch[1])),
    );
    return true;
  }

  const removeMatch = text.match(/^\/staff remove (\d+)$/);
  if (removeMatch) {
    const staffId = Number(removeMatch[1]);
    const dedicated = await getDedicatedStaffId(env.DB);
    if (dedicated === staffId) {
      await sendTelegramMessage(
        env,
        message.chat.id,
        "This staff member is currently the dedicated responder. Assign another dedicated staff member or change the route before disabling them.",
      );
      return true;
    }
    await sendTelegramMessage(
      env,
      message.chat.id,
      await removeStaffMember(env.DB, staffId),
    );
    return true;
  }

  await sendTelegramMessage(
    env,
    message.chat.id,
    [
      "Human Handoff Setup",
      "/staff status",
      "/staff route auto|group|dedicated",
      "/staff inbox here",
      "/staff dedicated <telegram_user_id>",
      "/staff add <telegram_user_id>",
      "/staff remove <telegram_user_id>",
      "",
      "Dedicated staff must open this bot and send /start before assignment can be validated.",
    ].join("\n"),
  );
  return true;
}

async function handleMessage(env: Env, message: TelegramMessage) {
  if (!message.from) return;
  if (env.DB) await upsertUser(env.DB, message.from);

  const text = message.text?.trim() ?? "";
  if (!text) return;

  if (await handleStaffReply(env, message)) return;
  if (await handleStaffCommand(env, message, text)) return;

  if (isOwner(message.from.id, env.BOT_OWNER_TELEGRAM_ID)) {
    const setup = await consumeAiSetupText(env, message.from.id, text);
    if (setup.handled) {
      if (setup.secretInput) {
        await deleteTelegramMessage(env, message.chat.id, message.message_id);
      }
      if (setup.text) {
        await sendTelegramMessage(env, message.chat.id, setup.text, setup.keyboard);
      }
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
      await sendTelegramMessage(
        env,
        message.chat.id,
        "This setting is available to the Bot Owner only.",
      );
      return;
    }
    const persona = await getAgentPersona(env.DB);
    await sendTelegramMessage(
      env,
      message.chat.id,
      `AI Agent Settings\nPersona: ${persona}\nChoose a provider, save a key, fetch models, select a model, pass Test Ping, bind primary/fallback, or change persona.`,
      aiMenuKeyboard(),
    );
    return;
  }

  const admin = await handleAdminCommand(
    env.DB,
    message.from.id,
    env.BOT_OWNER_TELEGRAM_ID,
    text,
  );
  if (admin.handled) {
    if (admin.response) {
      await sendTelegramMessage(env, message.chat.id, admin.response);
    }
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
    if (env.DB) {
      await logQuestion(env.DB, message, language, "answered", faq.key, "canonical_faq");
    }
    await sendTelegramMessage(env, message.chat.id, faq.answer[language]);
    return;
  }

  const questionId = env.DB
    ? await logQuestion(env.DB, message, language, "pending", null, "unresolved")
    : null;
  await postEscalationToStaff(env, message, language, questionId);
  await sendTelegramMessage(env, message.chat.id, COPY[language].noMatch);
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

  if (update.callback_query) {
    const handledCase = await handleCaseCallback(env, update.callback_query);
    if (!handledCase) {
      const handledAi = await handleAiCallback(env, update.callback_query);
      if (!handledAi) {
        await handleLanguageCallback(env, update.callback_query);
      }
    }
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
