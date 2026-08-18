import app from "./monitoring_message_entry";
import {
  getConversationControl,
  getMonitoringTopic,
  saveMonitoringTopic,
} from "./monitoring";
import { getStaffInboxChatId } from "./handoff";
import { monitoringUserHeader } from "./monitoring_headers";

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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function privateChat(message: TelegramMessage): boolean {
  return Boolean(message.from && (message.chat.type === "private" || message.chat.id === message.from.id));
}

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
}

function topicTitle(user: TelegramUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "User";
  const username = user.username ? ` · @${user.username}` : "";
  return `${name}${username} · ID ${user.id}`.slice(0, 120);
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

async function ensureMonitoringTarget(
  env: Env,
  user: TelegramUser,
): Promise<{ chatId: number; threadId?: number } | null> {
  if (!env.DB) return null;
  const staffChatId = await getStaffInboxChatId(env.DB);
  if (!staffChatId) return null;

  const existing = await getMonitoringTopic(env.DB, user.id, staffChatId);
  if (existing) {
    await telegramApi(env, "editForumTopic", {
      chat_id: staffChatId,
      message_thread_id: existing,
      name: topicTitle(user),
    });
    return { chatId: staffChatId, threadId: existing };
  }

  const topic = await telegramApi(env, "createForumTopic", {
    chat_id: staffChatId,
    name: topicTitle(user),
  });
  const threadId = Number(topic?.message_thread_id);
  if (Number.isSafeInteger(threadId)) {
    await saveMonitoringTopic(env.DB, user.id, staffChatId, threadId);
    return { chatId: staffChatId, threadId };
  }
  return { chatId: staffChatId };
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
