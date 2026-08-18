import app from "./manual_entry";

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

type TelegramApiResult = { ok: boolean; result?: any; description?: string };

function json(body: unknown, status = 200): Response {
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

async function telegramApi(env: Env, method: string, body: unknown): Promise<TelegramApiResult> {
  if (!env.TELEGRAM_BOT_TOKEN) return { ok: false, description: "telegram_token_missing" };
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = await response.json<any>().catch(() => null);
    return {
      ok: response.ok && payload?.ok === true,
      result: payload?.result,
      description: payload?.description,
    };
  } catch {
    return { ok: false, description: "telegram_request_failed" };
  }
}

async function recordGroupMessage(db: D1Database | undefined, message?: TelegramMessage): Promise<void> {
  if (!db || !message || !isGroup(message)) return;
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO group_message_ledger (chat_id, message_id, observed_at)
       VALUES (?1, ?2, CURRENT_TIMESTAMP)`,
    ).bind(message.chat.id, message.message_id).run();
  } catch {
    // Migration rollout must never block normal Telegram traffic.
  }
}

async function activeStaffInbox(db: D1Database | undefined): Promise<number | null> {
  if (!db) return null;
  try {
    const row = await db.prepare(
      `SELECT setting_value FROM bot_settings WHERE setting_key='staff_inbox_chat_id'`,
    ).first<{ setting_value: string }>();
    if (!row?.setting_value) return null;
    const id = Number(row.setting_value);
    return Number.isSafeInteger(id) ? id : null;
  } catch {
    return null;
  }
}

async function sendMessage(env: Env, chatId: number, text: string, keyboard?: unknown): Promise<any | null> {
  const result = await telegramApi(env, "sendMessage", {
    chat_id: chatId,
    text,
    reply_markup: keyboard,
  });
  return result.ok ? result.result ?? null : null;
}

async function answerCallback(env: Env, callbackId: string, text?: string): Promise<void> {
  await telegramApi(env, "answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
  });
}

async function deleteIds(env: Env, chatId: number, ids: number[]): Promise<{ attempted: number; skipped: number }> {
  if (!ids.length) return { attempted: 0, skipped: 0 };
  const bulk = await telegramApi(env, "deleteMessages", { chat_id: chatId, message_ids: ids });
  if (bulk.ok) return { attempted: ids.length, skipped: 0 };
  if (ids.length === 1) return { attempted: 1, skipped: 1 };

  const middle = Math.floor(ids.length / 2);
  const left = await deleteIds(env, chatId, ids.slice(0, middle));
  const right = await deleteIds(env, chatId, ids.slice(middle));
  return {
    attempted: left.attempted + right.attempted,
    skipped: left.skipped + right.skipped,
  };
}

async function handleClearCommand(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!message.from || commandName(message.text ?? "") !== "/clearmessage") return false;

  const owner = ownerId(env);
  if (message.from.id !== owner) {
    await sendMessage(env, message.chat.id, "This command is available to the Bot Owner only.");
    return true;
  }
  if (!isGroup(message)) {
    await sendMessage(env, message.chat.id, "Use /clearmessage inside the active Staff Inbox group.");
    return true;
  }

  const staffInbox = await activeStaffInbox(env.DB);
  if (staffInbox !== message.chat.id) {
    await sendMessage(
      env,
      message.chat.id,
      "This is not the active Staff Inbox. Use /staff to switch the Staff Inbox first if this is the group you want to manage.",
    );
    return true;
  }

  await sendMessage(
    env,
    message.chat.id,
    [
      "Clear Staff Inbox messages?",
      "",
      "This removes recent deletable messages that the bot has observed in this group. Telegram only allows bot deletion for messages younger than 48 hours.",
      "",
      "This action cannot be undone.",
    ].join("\n"),
    {
      inline_keyboard: [
        [{ text: "🗑 Clear messages", callback_data: `clearmsg:confirm:${message.chat.id}` }],
        [{ text: "Cancel", callback_data: "clearmsg:cancel" }],
      ],
    },
  );
  return true;
}

async function handleClearCallback(env: Env, callback: TelegramCallbackQuery): Promise<boolean> {
  const data = callback.data ?? "";
  if (!data.startsWith("clearmsg:")) return false;

  const owner = ownerId(env);
  if (callback.from.id !== owner) {
    await answerCallback(env, callback.id, "Owner only");
    return true;
  }
  const message = callback.message;
  if (!message || !isGroup(message)) {
    await answerCallback(env, callback.id, "Group context required");
    return true;
  }

  if (data === "clearmsg:cancel") {
    await answerCallback(env, callback.id, "Cancelled");
    await telegramApi(env, "deleteMessage", { chat_id: message.chat.id, message_id: message.message_id });
    return true;
  }

  const match = data.match(/^clearmsg:confirm:(-?\d+)$/);
  if (!match) {
    await answerCallback(env, callback.id, "Invalid request");
    return true;
  }
  const chatId = Number(match[1]);
  if (!Number.isSafeInteger(chatId) || chatId !== message.chat.id) {
    await answerCallback(env, callback.id, "Chat mismatch");
    return true;
  }
  if (await activeStaffInbox(env.DB) !== chatId) {
    await answerCallback(env, callback.id, "Staff Inbox changed");
    return true;
  }
  if (!env.DB) {
    await answerCallback(env, callback.id, "Storage unavailable");
    return true;
  }

  await answerCallback(env, callback.id, "Clearing recent messages…");

  const bounds = await env.DB.prepare(
    `SELECT MIN(message_id) AS min_id, MAX(message_id) AS max_id
     FROM group_message_ledger
     WHERE chat_id=?1 AND observed_at >= datetime('now', '-47 hours', '-50 minutes')`,
  ).bind(chatId).first<{ min_id: number | null; max_id: number | null }>();

  const high = Math.max(message.message_id, Number(bounds?.max_id ?? message.message_id));
  const rawLow = Number(bounds?.min_id ?? message.message_id);
  const low = Math.max(rawLow, high - 4999);
  const truncated = low > rawLow;

  let skipped = 0;
  for (let start = low; start <= high; start += 100) {
    const end = Math.min(high, start + 99);
    const ids = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    const result = await deleteIds(env, chatId, ids);
    skipped += result.skipped;
  }

  await env.DB.prepare(
    `DELETE FROM group_message_ledger WHERE chat_id=?1 AND message_id<=?2`,
  ).bind(chatId, high).run();
  await env.DB.prepare(
    `DELETE FROM group_message_ledger WHERE observed_at < datetime('now', '-3 days')`,
  ).run();

  if (truncated || skipped > 0) {
    const notes = [
      "Staff Inbox cleanup completed with limitations.",
      truncated ? "Only the newest 5,000 message IDs were attempted in this cleanup." : null,
      skipped > 0 ? `${skipped} message ID(s) could not be deleted, usually because Telegram does not permit deletion of those messages.` : null,
    ].filter(Boolean).join("\n");
    if (owner !== null) await sendMessage(env, owner, notes);
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

  await recordGroupMessage(env.DB, update.message ?? update.callback_query?.message);

  if (update.callback_query && await handleClearCallback(env, update.callback_query)) {
    return json({ ok: true });
  }
  if (update.message && await handleClearCommand(env, update.message)) {
    return json({ ok: true });
  }
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
