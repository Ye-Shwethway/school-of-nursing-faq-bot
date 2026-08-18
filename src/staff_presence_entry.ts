import app from "./clear_message_entry";
import { getStaffInboxChatId } from "./handoff";
import { getUserForMonitoringTopic, takeOverConversation } from "./monitoring";
import {
  canManageStaffState,
  countAvailableStaff,
  setStaffAvailability,
  setStaffNotificationsEnabled,
  staffNotificationsEnabled,
} from "./staff_presence";

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
  message_thread_id?: number;
  text?: string;
  chat: { id: number; type?: string; title?: string };
  from?: TelegramUser;
};
type TelegramUpdate = { message?: TelegramMessage };

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

async function sendMessage(env: Env, chatId: number, text: string, options?: { silent?: boolean; threadId?: number }): Promise<any | null> {
  return telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    disable_notification: options?.silent,
    message_thread_id: options?.threadId,
  });
}

async function activeGroup(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !isGroup(message)) return false;
  const active = await getStaffInboxChatId(env.DB);
  return active === message.chat.id;
}

async function handleStaffCommand(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!message.from || !message.text) return false;
  const command = commandName(message.text);
  if (command !== "/noti" && command !== "/available" && command !== "/unavailable") return false;

  if (!await activeGroup(env, message)) {
    await sendMessage(env, message.chat.id, "Use this command inside the active Staff Inbox group.");
    return true;
  }
  if (!await canManageStaffState(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID)) {
    await sendMessage(env, message.chat.id, "This command is available to authorized staff only.");
    return true;
  }

  if (command === "/available" || command === "/unavailable") {
    const available = command === "/available";
    await setStaffAvailability(env.DB, message.from.id, available);
    const count = await countAvailableStaff(env.DB);
    await sendMessage(
      env,
      message.chat.id,
      available
        ? `You are marked available. Available staff: ${count}`
        : `You are marked unavailable. Available staff: ${count}`,
      { silent: true, threadId: message.message_thread_id },
    );
    return true;
  }

  const action = message.text.trim().split(/\s+/)[1]?.toLowerCase();
  if (action !== "on" && action !== "off") {
    const enabled = await staffNotificationsEnabled(env.DB);
    await sendMessage(
      env,
      message.chat.id,
      `Staff notifications are ${enabled ? "ON" : "OFF"}.\nUsage: /noti on | /noti off`,
      { silent: true, threadId: message.message_thread_id },
    );
    return true;
  }

  const enabled = action === "on";
  await setStaffNotificationsEnabled(env.DB, message.from.id, enabled);
  await sendMessage(
    env,
    message.chat.id,
    enabled
      ? "Staff notifications are ON. New handoff messages may trigger Telegram notifications."
      : "Staff notifications are OFF. Handoff messages will remain visible in the group but will be sent silently.",
    { silent: true, threadId: message.message_thread_id },
  );
  return true;
}

async function relayStaffTopicReply(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text || !message.message_thread_id) return false;
  const text = message.text.trim();
  if (!text || text.startsWith("/")) return false;
  if (!await activeGroup(env, message)) return false;
  if (!await canManageStaffState(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID)) return false;

  const userId = await getUserForMonitoringTopic(env.DB, message.chat.id, message.message_thread_id);
  if (!userId) return false;

  await setStaffAvailability(env.DB, message.from.id, true);
  const takeover = await takeOverConversation(env.DB, userId, message.from.id);
  if (!takeover.ok && !takeover.message.includes("already control")) {
    await sendMessage(env, message.chat.id, takeover.message, { silent: true, threadId: message.message_thread_id });
    return true;
  }

  const sent = await sendMessage(
    env,
    userId,
    `School of Nursing staff:\n${text}`,
  );
  if (!sent) {
    await sendMessage(
      env,
      message.chat.id,
      "Could not deliver this reply to the user. The user may have blocked the bot or Telegram may not allow the private message.",
      { silent: true, threadId: message.message_thread_id },
    );
  }
  return true;
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

  if (update.message && await handleStaffCommand(env, update.message)) return json({ ok: true });
  if (update.message && await relayStaffTopicReply(env, update.message)) return json({ ok: true });
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
