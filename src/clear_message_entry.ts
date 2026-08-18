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
    // Cleanup telemetry must never block normal Telegram traffic.
  }
}

async function recordMessageId(db: D1Database | undefined, chatId: number, messageId: number): Promise<void> {
  if (!db || !Number.isSafeInteger(messageId)) return;
  try {
    await db.prepare(
      `INSERT OR IGNORE INTO group_message_ledger (chat_id, message_id, observed_at)
       VALUES (?1, ?2, CURRENT_TIMESTAMP)`,
    ).bind(chatId, messageId).run();
  } catch {
    // Cleanup telemetry is best-effort.
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
  if (result.ok && Number.isSafeInteger(Number(result.result?.message_id))) {
    await recordMessageId(env.DB, chatId, Number(result.result.message_id));
  }
  return result.ok ? result.result ?? null : null;
}

async function answerCallback(env: Env, callbackId: string, text?: string): Promise<void> {
  await telegramApi(env, "answerCallbackQuery", {
    callback_query_id: callbackId,
    text,
  });
}

async function verifyDeletePermission(env: Env, chatId: number): Promise<{ ok: boolean; reason?: string; readsAll?: boolean }> {
  const me = await telegramApi(env, "getMe", {});
  const botId = Number(me.result?.id);
  if (!me.ok || !Number.isSafeInteger(botId)) {
    return { ok: false, reason: me.description ?? "Could not resolve bot identity." };
  }
  const readsAll = me.result?.can_read_all_group_messages === true;
  const member = await telegramApi(env, "getChatMember", { chat_id: chatId, user_id: botId });
  if (!member.ok) return { ok: false, reason: member.description ?? "Could not read bot group permissions.", readsAll };
  const status = String(member.result?.status ?? "");
  if (status === "creator") return { ok: true, readsAll };
  if (status !== "administrator") {
    return { ok: false, reason: `Bot status is ${status || "unknown"}; make the bot a group administrator.`, readsAll };
  }
  if (member.result?.can_delete_messages !== true) {
    return { ok: false, reason: "Bot administrator is missing the Delete messages permission.", readsAll };
  }
  return { ok: true, readsAll };
}

async function deleteIds(
  env: Env,
  chatId: number,
  ids: number[],
): Promise<{ deleted: number[]; failed: Array<{ id: number; reason: string }> }> {
  const deleted: number[] = [];
  const failed: Array<{ id: number; reason: string }> = [];
  for (const id of ids) {
    const result = await telegramApi(env, "deleteMessage", { chat_id: chatId, message_id: id });
    if (result.ok && result.result === true) deleted.push(id);
    else failed.push({ id, reason: result.description ?? "deleteMessage did not return true" });
  }
  return { deleted, failed };
}

async function removeDeletedLedgerRows(db: D1Database, chatId: number, ids: number[]): Promise<void> {
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    if (!batch.length) continue;
    const placeholders = batch.map((_, index) => `?${index + 2}`).join(",");
    await db.prepare(
      `DELETE FROM group_message_ledger WHERE chat_id=?1 AND message_id IN (${placeholders})`,
    ).bind(chatId, ...batch).run();
  }
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

  const permission = await verifyDeletePermission(env, message.chat.id);
  if (!permission.ok) {
    await sendMessage(
      env,
      message.chat.id,
      `Cannot clear messages yet. ${permission.reason ?? "Telegram delete permission check failed."}`,
    );
    return true;
  }

  await sendMessage(
    env,
    message.chat.id,
    [
      "Clear Staff Inbox messages?",
      "",
      "This removes recent deletable messages that the bot has actually observed in this group.",
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

  const permission = await verifyDeletePermission(env, chatId);
  if (!permission.ok) {
    await answerCallback(env, callback.id, "Delete permission missing");
    if (owner !== null) {
      await sendMessage(env, owner, `Staff Inbox cleanup blocked: ${permission.reason ?? "Telegram permission check failed."}`);
    }
    return true;
  }

  await answerCallback(env, callback.id, "Clearing recent messages…");

  const rows = await env.DB.prepare(
    `SELECT message_id
     FROM group_message_ledger
     WHERE chat_id=?1 AND observed_at >= datetime('now', '-47 hours', '-50 minutes')
     ORDER BY message_id DESC
     LIMIT 5000`,
  ).bind(chatId).all<{ message_id: number }>();

  const ids = (rows.results ?? [])
    .map((row) => Number(row.message_id))
    .filter((id) => Number.isSafeInteger(id));

  if (!ids.includes(message.message_id)) ids.unshift(message.message_id);

  const deleted: number[] = [];
  const failed: Array<{ id: number; reason: string }> = [];
  for (let start = 0; start < ids.length; start += 100) {
    const result = await deleteIds(env, chatId, ids.slice(start, start + 100));
    deleted.push(...result.deleted);
    failed.push(...result.failed);
  }

  if (deleted.length) await removeDeletedLedgerRows(env.DB, chatId, deleted);
  await env.DB.prepare(
    `DELETE FROM group_message_ledger WHERE observed_at < datetime('now', '-3 days')`,
  ).run();

  if (owner !== null) {
    const firstFailure = failed[0]?.reason;
    await sendMessage(
      env,
      owner,
      [
        "Staff Inbox cleanup result",
        `Confirmed deleted: ${deleted.length}`,
        `Could not confirm/delete: ${failed.length}`,
        `Tracked IDs attempted: ${ids.length}`,
        permission.readsAll === true
          ? "Bot privacy mode: disabled (getMe can_read_all_group_messages=true)."
          : "Bot privacy mode: enabled or not globally disabled; administrator status can still allow group updates.",
        ids.length === 5000 ? "Note: cleanup was limited to the newest 5,000 tracked messages." : null,
        firstFailure ? `First Telegram error: ${firstFailure}` : null,
      ].filter(Boolean).join("\n"),
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
