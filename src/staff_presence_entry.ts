import app from "./clear_message_entry";
import { getStaffInboxChatId } from "./handoff";
import { getUserForMonitoringTopic, takeOverConversation } from "./monitoring";
import {
  canManageStaffState,
  countAvailableStaff,
  hasDailyAvailabilitySchedule,
  isStaffAvailable,
  markStaffActiveNow,
  setDailyAvailabilitySchedule,
  setStaffAvailability,
  setStaffNotificationsEnabled,
  setTemporaryUnavailable,
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
type TelegramCallbackQuery = {
  id: string;
  from: TelegramUser;
  data?: string;
  message?: TelegramMessage;
};
type TelegramUpdate = { message?: TelegramMessage; callback_query?: TelegramCallbackQuery };

type PendingSummary = { count: number; newestId: number };

const YANGON_OFFSET_MINUTES = 390;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
}

function commandArgs(text: string): string[] {
  return text.trim().split(/\s+/).slice(1);
}

function parseTimeToken(token: string): number | null {
  const value = token.trim().toLowerCase();
  const h24 = value.match(/^(\d{1,2}):([0-5]\d)$/);
  if (h24) {
    const hour = Number(h24[1]);
    if (hour >= 0 && hour <= 23) return hour * 60 + Number(h24[2]);
    return null;
  }
  const h12 = value.match(/^(\d{1,2})(?::([0-5]\d))?(am|pm)$/);
  if (!h12) return null;
  let hour = Number(h12[1]);
  if (hour < 1 || hour > 12) return null;
  const minute = Number(h12[2] ?? 0);
  if (h12[3] === "am") hour = hour === 12 ? 0 : hour;
  else hour = hour === 12 ? 12 : hour + 12;
  return hour * 60 + minute;
}

function minuteLabel(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}

function yangonDateTimeLabel(sqliteUtc: string): string {
  const utc = Date.parse(sqliteUtc.replace(" ", "T") + "Z");
  if (!Number.isFinite(utc)) return sqliteUtc;
  const local = new Date(utc + YANGON_OFFSET_MINUTES * 60_000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")} ${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`;
}

function isGroup(message: TelegramMessage): boolean {
  return message.chat.type === "group" || message.chat.type === "supergroup";
}

function isPrivate(message: TelegramMessage): boolean {
  return message.chat.type === "private" || message.chat.id === message.from?.id;
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

async function sendMessage(
  env: Env,
  chatId: number,
  text: string,
  options?: { silent?: boolean; threadId?: number; keyboard?: unknown },
): Promise<any | null> {
  return telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    disable_notification: options?.silent,
    message_thread_id: options?.threadId,
    reply_markup: options?.keyboard,
  });
}

async function answerCallback(env: Env, callbackId: string, text?: string): Promise<void> {
  await telegramApi(env, "answerCallbackQuery", { callback_query_id: callbackId, text });
}

async function activeGroup(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !isGroup(message)) return false;
  const active = await getStaffInboxChatId(env.DB);
  return active === message.chat.id;
}

async function pendingSummary(db: D1Database | undefined): Promise<PendingSummary> {
  if (!db) return { count: 0, newestId: 0 };
  const row = await db.prepare(
    `SELECT COUNT(*) AS count, COALESCE(MAX(id), 0) AS newest_id
     FROM escalation_cases
     WHERE status='open'`,
  ).first<{ count: number; newest_id: number }>();
  return { count: Number(row?.count ?? 0), newestId: Number(row?.newest_id ?? 0) };
}

function pendingAckKey(userId: number): string {
  return `staff_pending_prompt_seen:${userId}`;
}

async function lastPromptedCaseId(db: D1Database | undefined, userId: number): Promise<number> {
  if (!db) return 0;
  const row = await db.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key=?1`,
  ).bind(pendingAckKey(userId)).first<{ setting_value: string }>();
  const value = Number(row?.setting_value ?? 0);
  return Number.isSafeInteger(value) ? value : 0;
}

async function acknowledgePendingPrompt(db: D1Database | undefined, userId: number, newestId: number): Promise<void> {
  if (!db) return;
  await db.prepare(
    `INSERT INTO bot_settings (setting_key, setting_value, updated_by, updated_at)
     VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)
     ON CONFLICT(setting_key) DO UPDATE SET
       setting_value=excluded.setting_value,
       updated_by=excluded.updated_by,
       updated_at=CURRENT_TIMESTAMP`,
  ).bind(pendingAckKey(userId), String(newestId), userId).run();
}

async function maybePromptReturningStaff(env: Env, message: TelegramMessage): Promise<void> {
  if (!env.DB || !message.from || !isPrivate(message)) return;
  if (!await canManageStaffState(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID)) return;
  if (await isStaffAvailable(env.DB, message.from.id)) return;
  if (await hasDailyAvailabilitySchedule(env.DB, message.from.id)) return;

  const pending = await pendingSummary(env.DB);
  if (pending.count < 1 || pending.newestId < 1) return;
  const seen = await lastPromptedCaseId(env.DB, message.from.id);
  if (seen >= pending.newestId) return;

  await sendMessage(
    env,
    message.chat.id,
    [
      "Pending Staff Inbox inquiries",
      "",
      `${pending.count} unanswered inquiry${pending.count === 1 ? " is" : "ies are"} waiting for staff review.`,
      "You are currently marked unavailable.",
      "",
      "Would you like to become available now?",
    ].join("\n"),
    {
      keyboard: {
        inline_keyboard: [
          [{ text: "✅ Mark me Available & Review", callback_data: `staffreturn:available:${pending.newestId}` }],
          [{ text: "⏸ Stay Unavailable", callback_data: `staffreturn:stay:${pending.newestId}` }],
        ],
      },
    },
  );
}

async function handleReturnPromptCallback(env: Env, callback: TelegramCallbackQuery): Promise<boolean> {
  const match = callback.data?.match(/^staffreturn:(available|stay):(\d+)$/);
  if (!match) return false;
  if (!env.DB || !callback.message) {
    await answerCallback(env, callback.id, "Session unavailable");
    return true;
  }
  if (!await canManageStaffState(env.DB, callback.from.id, env.BOT_OWNER_TELEGRAM_ID)) {
    await answerCallback(env, callback.id, "Authorized staff only");
    return true;
  }

  const newestId = Number(match[2]);
  if (!Number.isSafeInteger(newestId)) {
    await answerCallback(env, callback.id, "Invalid request");
    return true;
  }

  await acknowledgePendingPrompt(env.DB, callback.from.id, newestId);
  if (match[1] === "available") {
    await setStaffAvailability(env.DB, callback.from.id, true);
    const pending = await pendingSummary(env.DB);
    await answerCallback(env, callback.id, "Marked available");
    await telegramApi(env, "editMessageText", {
      chat_id: callback.message.chat.id,
      message_id: callback.message.message_id,
      text: [
        "You are now marked available.",
        `Pending unanswered inquiries: ${pending.count}`,
        "Open the Staff Inbox and review the waiting user topics. Reply inside a user topic to reconnect with that user.",
      ].join("\n"),
    });
    return true;
  }

  await answerCallback(env, callback.id, "Staying unavailable");
  await telegramApi(env, "editMessageText", {
    chat_id: callback.message.chat.id,
    message_id: callback.message.message_id,
    text: "You remain marked unavailable. The pending inquiries will stay queued for another available staff member or for your later review.",
  });
  return true;
}

async function handleAvailabilityCommand(env: Env, message: TelegramMessage, command: string): Promise<boolean> {
  if (!env.DB || !message.from || !message.text) return false;
  const args = commandArgs(message.text);

  if (command === "/unavailable") {
    if (args.length === 0) {
      await setStaffAvailability(env.DB, message.from.id, false);
      const count = await countAvailableStaff(env.DB);
      await sendMessage(env, message.chat.id, `You are marked unavailable until you use /available. Available staff: ${count}`, { silent: true, threadId: message.message_thread_id });
      return true;
    }
    if (args.length === 1) {
      const hours = Number(args[0]);
      if (Number.isFinite(hours) && hours > 0 && hours <= 168) {
        const expiresAt = await setTemporaryUnavailable(env.DB, message.from.id, hours);
        const count = await countAvailableStaff(env.DB);
        await sendMessage(
          env,
          message.chat.id,
          `You are unavailable for ${hours} hour${hours === 1 ? "" : "s"}.\nAuto-return: ${expiresAt ? yangonDateTimeLabel(expiresAt) : "scheduled"} Asia/Yangon (UTC+06:30).\nAvailable staff: ${count}`,
          { silent: true, threadId: message.message_thread_id },
        );
        return true;
      }
    }
    await sendMessage(env, message.chat.id, "Usage: /unavailable | /unavailable <hours>\nExample: /unavailable 3", { silent: true, threadId: message.message_thread_id });
    return true;
  }

  if (args.length === 0) {
    await setStaffAvailability(env.DB, message.from.id, true);
    const count = await countAvailableStaff(env.DB);
    await sendMessage(env, message.chat.id, `You are marked available. Any recurring availability schedule was cleared. Available staff: ${count}`, { silent: true, threadId: message.message_thread_id });
    return true;
  }

  if (args.length === 2) {
    const start = parseTimeToken(args[0]);
    const end = parseTimeToken(args[1]);
    if (start !== null && end !== null && start !== end) {
      const availableNow = await setDailyAvailabilitySchedule(env.DB, message.from.id, start, end);
      const count = await countAvailableStaff(env.DB);
      await sendMessage(
        env,
        message.chat.id,
        `Daily availability scheduled: ${minuteLabel(start)}–${minuteLabel(end)} Asia/Yangon (UTC+06:30).\nCurrent state: ${availableNow ? "AVAILABLE" : "UNAVAILABLE"}.\nAvailable staff: ${count}`,
        { silent: true, threadId: message.message_thread_id },
      );
      return true;
    }
  }

  await sendMessage(
    env,
    message.chat.id,
    "Usage: /available | /available <start> <end>\nExamples: /available 09:00 17:00 | /available 9am 5pm | /available 20:00 08:00\nTimezone: Asia/Yangon (UTC+06:30)",
    { silent: true, threadId: message.message_thread_id },
  );
  return true;
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
    return handleAvailabilityCommand(env, message, command);
  }

  const action = commandArgs(message.text)[0]?.toLowerCase();
  if (action !== "on" && action !== "off") {
    const enabled = await staffNotificationsEnabled(env.DB);
    await sendMessage(env, message.chat.id, `Staff notifications are ${enabled ? "ON" : "OFF"}.\nUsage: /noti on | /noti off`, { silent: true, threadId: message.message_thread_id });
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

  await markStaffActiveNow(env.DB, message.from.id);
  const takeover = await takeOverConversation(env.DB, userId, message.from.id);
  if (!takeover.ok && !takeover.message.includes("already control")) {
    await sendMessage(env, message.chat.id, takeover.message, { silent: true, threadId: message.message_thread_id });
    return true;
  }

  const sent = await sendMessage(env, userId, `School of Nursing staff:\n${text}`);
  if (!sent) {
    await sendMessage(env, message.chat.id, "Could not deliver this reply to the user. The user may have blocked the bot or Telegram may not allow the private message.", { silent: true, threadId: message.message_thread_id });
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

  if (update.callback_query && await handleReturnPromptCallback(env, update.callback_query)) return json({ ok: true });
  if (update.message && await handleStaffCommand(env, update.message)) return json({ ok: true });
  if (update.message && await relayStaffTopicReply(env, update.message)) return json({ ok: true });

  if (update.message) await maybePromptReturningStaff(env, update.message);
  return app.fetch(request, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/telegram/webhook") return handleWebhook(request, env);
    return app.fetch(request, env);
  },
};
