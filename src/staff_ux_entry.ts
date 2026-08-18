import uxRuntime from "./ux_entry";
import {
  handoffStatus,
  setHandoffRoute,
  setStaffInbox,
} from "./handoff";
import {
  getMonitoringTopic,
  monitoringStatus,
} from "./monitoring";
import { getStaffInboxChatId } from "./handoff";

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
  chat: { id: number; type?: string; title?: string; is_forum?: boolean };
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

type InlineKeyboard = {
  inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
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
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function commandName(text: string): string {
  return text.trim().split(/\s+/, 1)[0].toLowerCase().replace(/@[^\s]+$/, "");
}

function isGroup(message: TelegramMessage): boolean {
  return message.chat.type === "group" || message.chat.type === "supergroup";
}

function isPrivate(message: TelegramMessage): boolean {
  return message.chat.type === "private" || message.chat.id === message.from?.id;
}

function userIdentity(user: TelegramUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "Unknown name";
  const username = user.username ? ` (@${user.username})` : "";
  return `${name}${username} — ID: ${user.id}`;
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

async function sendMessage(env: Env, chatId: number, text: string, keyboard?: InlineKeyboard): Promise<void> {
  await telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: keyboard,
  });
}

async function editOrSend(env: Env, message: TelegramMessage, text: string, keyboard?: InlineKeyboard): Promise<void> {
  const edited = await telegramApi(env, "editMessageText", {
    chat_id: message.chat.id,
    message_id: message.message_id,
    text,
    reply_markup: keyboard,
  });
  if (!edited) await sendMessage(env, message.chat.id, text, keyboard);
}

async function answerCallback(env: Env, callbackId: string, text?: string): Promise<void> {
  await telegramApi(env, "answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
  });
}

function staffMenuKeyboard(groupContext: boolean): InlineKeyboard {
  const rows: InlineKeyboard["inline_keyboard"] = [];
  if (groupContext) {
    rows.push([{ text: "✓ Set this group as Staff Inbox", callback_data: "ux:staff:bind_here" }]);
  }
  rows.push([
    { text: "Status", callback_data: "ux:staff:status" },
    { text: "Monitoring", callback_data: "ux:staff:monitoring" },
  ]);
  rows.push([
    { text: "Route: Group", callback_data: "ux:staff:route_group" },
    { text: "Route: Auto", callback_data: "ux:staff:route_auto" },
  ]);
  rows.push([{ text: "✕ Close", callback_data: "ui:close" }]);
  return { inline_keyboard: rows };
}

function monitoringKeyboard(): InlineKeyboard {
  return {
    inline_keyboard: [
      [
        { text: "All + Alerts", callback_data: "ux:monitor:all_alerts" },
        { text: "Silent All", callback_data: "ux:monitor:silent_all" },
      ],
      [
        { text: "Alerts Only", callback_data: "ux:monitor:alerts_only" },
        { text: "Monitoring Off", callback_data: "ux:monitor:off" },
      ],
      [{ text: "← Staff", callback_data: "ux:staff:menu" }],
      [{ text: "✕ Close", callback_data: "ui:close" }],
    ],
  };
}

async function staffPanelText(env: Env, message: TelegramMessage): Promise<string> {
  const where = isGroup(message)
    ? `Current group: ${message.chat.title ?? "Telegram group"}\nChat ID: ${message.chat.id}`
    : "Open /staff inside the staff group to bind that group automatically.";
  return [
    "School of Nursing Staff Control",
    "",
    where,
    "",
    "Use the buttons below to manage the Staff Inbox, routing, and monitoring.",
  ].join("\n");
}

async function handleStaffUi(env: Env, update: TelegramUpdate): Promise<boolean> {
  const configuredOwner = ownerId(env);
  const message = update.message;

  if (message?.from && commandName(message.text ?? "") === "/staff" && message.text?.trim().split(/\s+/).length === 1) {
    if (message.from.id !== configuredOwner) {
      await sendMessage(env, message.chat.id, "Staff configuration is available to the Bot Owner only.");
      return true;
    }
    await sendMessage(env, message.chat.id, await staffPanelText(env, message), staffMenuKeyboard(isGroup(message)));
    return true;
  }

  const callback = update.callback_query;
  const data = callback?.data ?? "";
  if (!callback || !data.startsWith("ux:staff:")) return false;

  if (callback.from.id !== configuredOwner) {
    await answerCallback(env, callback.id, "Owner only");
    return true;
  }
  if (!callback.message) {
    await answerCallback(env, callback.id);
    return true;
  }

  await answerCallback(env, callback.id);
  const menuMessage = callback.message;

  if (data === "ux:staff:menu") {
    await editOrSend(env, menuMessage, await staffPanelText(env, menuMessage), staffMenuKeyboard(isGroup(menuMessage)));
    return true;
  }

  if (data === "ux:staff:bind_here") {
    if (!isGroup(menuMessage)) {
      await editOrSend(
        env,
        menuMessage,
        "Open /staff inside the Telegram staff group, then choose Set this group as Staff Inbox.",
        staffMenuKeyboard(false),
      );
      return true;
    }
    const bindResult = await setStaffInbox(env.DB, callback.from.id, menuMessage.chat.id);
    const routeResult = await setHandoffRoute(env.DB, callback.from.id, "group");
    await editOrSend(
      env,
      menuMessage,
      [
        "Staff Inbox configured",
        "",
        bindResult,
        routeResult,
        "",
        await handoffStatus(env.DB),
      ].join("\n"),
      staffMenuKeyboard(true),
    );
    return true;
  }

  if (data === "ux:staff:status") {
    await editOrSend(
      env,
      menuMessage,
      `${await handoffStatus(env.DB)}\n\n${await monitoringStatus(env.DB)}`,
      staffMenuKeyboard(isGroup(menuMessage)),
    );
    return true;
  }

  if (data === "ux:staff:monitoring") {
    await editOrSend(env, menuMessage, await monitoringStatus(env.DB), monitoringKeyboard());
    return true;
  }

  if (data === "ux:staff:route_group") {
    const result = await setHandoffRoute(env.DB, callback.from.id, "group");
    await editOrSend(
      env,
      menuMessage,
      `${result}\n\n${await handoffStatus(env.DB)}`,
      staffMenuKeyboard(isGroup(menuMessage)),
    );
    return true;
  }

  if (data === "ux:staff:route_auto") {
    const result = await setHandoffRoute(env.DB, callback.from.id, "auto");
    await editOrSend(
      env,
      menuMessage,
      `${result}\n\n${await handoffStatus(env.DB)}`,
      staffMenuKeyboard(isGroup(menuMessage)),
    );
    return true;
  }

  return false;
}

async function syncTopicIdentity(env: Env, user: TelegramUser): Promise<void> {
  if (!env.DB) return;
  try {
    const staffChatId = await getStaffInboxChatId(env.DB);
    if (!staffChatId) return;
    const threadId = await getMonitoringTopic(env.DB, user.id, staffChatId);
    if (!threadId) return;
    await telegramApi(env, "editForumTopic", {
      chat_id: staffChatId,
      message_thread_id: threadId,
      name: topicTitle(user),
    });
  } catch {
    // Identity decoration is best-effort and must never interrupt inquiry handling.
  }
}

async function appendIdentityMirror(env: Env, update: TelegramUpdate): Promise<void> {
  const message = update.message;
  if (!message?.from || !message.text || !isPrivate(message)) return;
  const text = message.text.trim();
  if (!text || text.startsWith("/")) return;
  await syncTopicIdentity(env, message.from);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "POST" || url.pathname !== "/telegram/webhook") {
      return uxRuntime.fetch(request, env);
    }

    if (env.TELEGRAM_WEBHOOK_SECRET) {
      const supplied = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
      if (supplied !== env.TELEGRAM_WEBHOOK_SECRET) return json({ ok: false }, 401);
    }

    let update: TelegramUpdate;
    try {
      update = await request.clone().json<TelegramUpdate>();
    } catch {
      return uxRuntime.fetch(request, env);
    }

    if (await handleStaffUi(env, update)) return json({ ok: true });

    const response = await uxRuntime.fetch(request, env);
    await appendIdentityMirror(env, update);
    return response;
  },
};
