import app from "./monitoring_message_entry";
import { getConversationControl, returnConversationToAi } from "./monitoring";
import { getStaffInboxChatId } from "./handoff";
import { monitoringUserHeader } from "./monitoring_headers";
import { ensureIsolatedMonitoringTarget } from "./monitoring_target";

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
  message_thread_id?: number;
  text?: string;
  chat: { id: number; type?: string; title?: string };
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

const AI_RETURNED_COPY: Record<Language, string> = {
  my: "ဒီစကားဝိုင်းကို automated assistant ဆီ ပြန်လည်လွှဲပြောင်းပြီးပါပြီ။",
  en: "This conversation has been returned to the automated assistant.",
  zh: "此对话已交回自动助理处理。",
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

function privateChat(message: TelegramMessage): boolean {
  return Boolean(message.from && (message.chat.type === "private" || message.chat.id === message.from.id));
}

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
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

async function getLanguage(db: D1Database | undefined, telegramUserId: number): Promise<Language> {
  if (!db) return "en";
  try {
    const row = await db.prepare(
      `SELECT language FROM users WHERE telegram_user_id=?1`,
    ).bind(telegramUserId).first<{ language: string | null }>();
    return row?.language === "my" || row?.language === "zh" ? row.language : "en";
  } catch {
    return "en";
  }
}

async function ensureMonitoringTarget(
  env: Env,
  user: TelegramUser,
): Promise<{ chatId: number; threadId: number } | null> {
  return ensureIsolatedMonitoringTarget(
    env,
    user,
    (method, body) => telegramApi(env, method, body),
  );
}

async function getLatestControlMessage(
  db: D1Database,
  telegramUserId: number,
  staffChatId: number,
): Promise<number | null> {
  try {
    const row = await db.prepare(
      `SELECT latest_control_message_id FROM monitoring_topics
       WHERE telegram_user_id=?1 AND staff_chat_id=?2`,
    ).bind(telegramUserId, staffChatId).first<{ latest_control_message_id: number | null }>();
    return row?.latest_control_message_id ?? null;
  } catch {
    return null;
  }
}

async function setLatestControlMessage(
  db: D1Database,
  telegramUserId: number,
  staffChatId: number,
  messageId: number | null,
): Promise<void> {
  try {
    await db.prepare(
      `UPDATE monitoring_topics
       SET latest_control_message_id=?3, updated_at=CURRENT_TIMESTAMP
       WHERE telegram_user_id=?1 AND staff_chat_id=?2`,
    ).bind(telegramUserId, staffChatId, messageId).run();
  } catch {
    // Transitional deploys before migration 0007 should not break inquiry handling.
  }
}

async function removeReturnButton(env: Env, staffChatId: number, messageId: number | null): Promise<void> {
  if (!messageId) return;
  await telegramApi(env, "editMessageReplyMarkup", {
    chat_id: staffChatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

async function moveReturnButtonToLatest(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text || !privateChat(message)) return false;
  const text = message.text.trim();
  if (!text || text.startsWith("/")) return false;

  const control = await getConversationControl(env.DB, message.from.id);
  if (control.mode !== "human") return false;

  const target = await ensureMonitoringTarget(env, message.from);
  if (!target) return false;

  const previous = await getLatestControlMessage(env.DB, message.from.id, target.chatId);
  const sent = await telegramApi(env, "sendMessage", {
    chat_id: target.chatId,
    text: `${monitoringUserHeader(message.from)} · Human control\n${message.text}`,
    message_thread_id: target.threadId,
    reply_markup: {
      inline_keyboard: [[
        { text: "Return to AI", callback_data: `conv:return:${message.from.id}` },
      ]],
    },
  });

  const sentId = Number(sent?.message_id);
  if (Number.isSafeInteger(sentId)) {
    await removeReturnButton(env, target.chatId, previous);
    await setLatestControlMessage(env.DB, message.from.id, target.chatId, sentId);
  }
  return true;
}

async function cleanupLatestButtonIfAi(env: Env, telegramUserId: number): Promise<void> {
  if (!env.DB) return;
  const control = await getConversationControl(env.DB, telegramUserId);
  if (control.mode !== "ai") return;

  const staffChatId = await getStaffInboxChatId(env.DB);
  if (!staffChatId) return;
  const latest = await getLatestControlMessage(env.DB, telegramUserId, staffChatId);
  await removeReturnButton(env, staffChatId, latest);
  await setLatestControlMessage(env.DB, telegramUserId, staffChatId, null);
}

async function notifyPreviousClaimant(
  env: Env,
  claimantId: number,
  telegramUserId: number,
  callbackMessage?: TelegramMessage,
): Promise<void> {
  const text = [
    "Bot Owner override",
    `Conversation with user ${telegramUserId} was returned to AI by the Bot Owner.`,
    "Your previous human-control claim is no longer active. Take Over again only if further staff handling is needed.",
  ].join("\n");

  const direct = await telegramApi(env, "sendMessage", {
    chat_id: claimantId,
    text,
  });
  if (direct) return;

  if (callbackMessage) {
    await telegramApi(env, "sendMessage", {
      chat_id: callbackMessage.chat.id,
      text: `${text}\nPrevious claimant ID: ${claimantId}`,
      message_thread_id: callbackMessage.message_thread_id,
    });
  }
}

async function handleOwnerReturnOverride(
  env: Env,
  callback: TelegramCallbackQuery,
  telegramUserId: number,
): Promise<boolean> {
  const configuredOwner = ownerId(env);
  if (configuredOwner === null || callback.from.id !== configuredOwner || !env.DB) return false;

  const current = await getConversationControl(env.DB, telegramUserId);
  if (current.mode !== "human" || current.claimedBy === null || current.claimedBy === configuredOwner) {
    return false;
  }

  const previousClaimant = current.claimedBy;
  const result = await returnConversationToAi(
    env.DB,
    telegramUserId,
    configuredOwner,
    configuredOwner,
  );

  await telegramApi(env, "answerCallbackQuery", {
    callback_query_id: callback.id,
    text: result.ok ? "Owner override: returned to AI" : result.message,
  });

  if (!result.ok) return true;

  await cleanupLatestButtonIfAi(env, telegramUserId);

  const language = await getLanguage(env.DB, telegramUserId);
  await telegramApi(env, "sendMessage", {
    chat_id: telegramUserId,
    text: AI_RETURNED_COPY[language],
  });

  await notifyPreviousClaimant(env, previousClaimant, telegramUserId, callback.message);

  if (callback.message) {
    await telegramApi(env, "sendMessage", {
      chat_id: callback.message.chat.id,
      text: `Owner override · User ${telegramUserId} returned to AI. Previous claimant: ${previousClaimant}.`,
      message_thread_id: callback.message.message_thread_id,
    });
  }

  return true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/telegram/webhook") {
      return app.fetch(request, env);
    }

    if (env.TELEGRAM_WEBHOOK_SECRET) {
      const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false }, 401);
    }

    let update: TelegramUpdate;
    try {
      update = await request.clone().json<TelegramUpdate>();
    } catch {
      return app.fetch(request, env);
    }

    if (update.message && await moveReturnButtonToLatest(env, update.message)) {
      return json({ ok: true });
    }

    const returnMatch = update.callback_query?.data?.match(/^conv:return:(\d+)$/);
    if (returnMatch && update.callback_query) {
      const telegramUserId = Number(returnMatch[1]);
      if (Number.isSafeInteger(telegramUserId) && await handleOwnerReturnOverride(env, update.callback_query, telegramUserId)) {
        return json({ ok: true });
      }
    }

    const resetUserId = update.message?.from && commandName(update.message.text ?? "") === "/reset"
      ? update.message.from.id
      : null;

    const response = await app.fetch(request, env);

    if (returnMatch) {
      const telegramUserId = Number(returnMatch[1]);
      if (Number.isSafeInteger(telegramUserId)) {
        await cleanupLatestButtonIfAi(env, telegramUserId);
      }
    } else if (resetUserId !== null) {
      await cleanupLatestButtonIfAi(env, resetUserId);
    }

    return response;
  },
};
