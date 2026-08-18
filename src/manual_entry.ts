import app from "./deployment_notice_entry";
import { getAdminRole } from "./admin";
import { syncCommandRegistryIfNeeded } from "./command_sync";
import {
  getManualSection,
  listManualSections,
  updateManualSection,
  type ManualKey,
} from "./manual_store";

interface Env {
  APP_ENV: string;
  DEPLOY_REVISION?: string;
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
  AI_CONFIG_MASTER_KEY?: string;
}

type TelegramUser = { id: number; username?: string; first_name?: string; last_name?: string };
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
type TelegramUpdate = { message?: TelegramMessage; callback_query?: TelegramCallbackQuery };
type InlineKeyboard = { inline_keyboard: Array<Array<{ text: string; callback_data: string }>> };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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

async function syncCommandsBeforeIntercept(env: Env): Promise<void> {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN) return;
  const api = (method: string, body: unknown) => telegramApi(env, method, body);
  try {
    await syncCommandRegistryIfNeeded(env.DB, api, env.BOT_OWNER_TELEGRAM_ID);
  } catch {
    // Command synchronization must remain non-fatal.
  }
}

async function sendMessage(env: Env, chatId: number, text: string, keyboard?: InlineKeyboard): Promise<void> {
  await telegramApi(env, "sendMessage", { chat_id: chatId, text, reply_markup: keyboard });
}

async function answerCallback(env: Env, callbackId: string, text?: string): Promise<void> {
  await telegramApi(env, "answerCallbackQuery", { callback_query_id: callbackId, text });
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

async function roleFor(env: Env, userId: number) {
  return getAdminRole(env.DB, userId, env.BOT_OWNER_TELEGRAM_ID);
}

function manualTitle(key: ManualKey): string {
  return key === "owner" ? "Bot Owner Manual" : "Sudo Admin Manual";
}

function canReadManual(role: string, key: ManualKey): boolean {
  if (key === "owner") return role === "owner";
  return role === "owner" || role === "sudo_admin";
}

function pagerKeyboard(key: ManualKey, index: number, total: number, canEdit: boolean): InlineKeyboard {
  const nav: Array<{ text: string; callback_data: string }> = [];
  if (index > 0) nav.push({ text: "◀ Previous", callback_data: `manual:page:${key}:${index - 1}` });
  nav.push({ text: `${index + 1}/${total}`, callback_data: "manual:noop" });
  if (index < total - 1) nav.push({ text: "Next ▶", callback_data: `manual:page:${key}:${index + 1}` });

  const rows: InlineKeyboard["inline_keyboard"] = [nav];
  if (canEdit) rows.push([{ text: "✎ Edit this section", callback_data: `manual:editpage:${key}:${index}` }]);
  rows.push([{ text: "✕ Close", callback_data: "ui:close" }]);
  return { inline_keyboard: rows };
}

async function renderManualPage(
  env: Env,
  key: ManualKey,
  index: number,
  canEdit: boolean,
): Promise<{ text: string; keyboard: InlineKeyboard } | null> {
  const sections = await listManualSections(env.DB, key);
  if (!sections.length) return null;
  const safeIndex = Math.min(Math.max(index, 0), sections.length - 1);
  const section = sections[safeIndex];
  return {
    text: [
      manualTitle(key),
      `${safeIndex + 1}/${sections.length}`,
      "",
      section.title,
      "",
      section.body,
    ].join("\n"),
    keyboard: pagerKeyboard(key, safeIndex, sections.length, canEdit),
  };
}

async function saveSession(
  db: D1Database,
  userId: number,
  state: string,
  provider: string | null,
  payload: unknown,
): Promise<void> {
  await db.prepare(
    `INSERT INTO admin_sessions (telegram_user_id, state, provider, payload, updated_at)
     VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       state=excluded.state, provider=excluded.provider, payload=excluded.payload, updated_at=CURRENT_TIMESTAMP`,
  ).bind(userId, state, provider, payload == null ? null : JSON.stringify(payload)).run();
}

async function clearSession(db: D1Database, userId: number): Promise<void> {
  await db.prepare(`DELETE FROM admin_sessions WHERE telegram_user_id=?1`).bind(userId).run();
}

async function handleManualCommand(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!message.from || !message.text) return false;
  const command = commandName(message.text);
  if (command !== "/ownermanual" && command !== "/adminmanual") return false;

  const role = await roleFor(env, message.from.id);
  const key: ManualKey = command === "/ownermanual" ? "owner" : "admin";
  if (!canReadManual(role, key)) {
    await sendMessage(
      env,
      message.chat.id,
      key === "owner"
        ? "Owner Manual is available to the Bot Owner only."
        : "Admin Manual is available to the Bot Owner and Sudo Admins only.",
    );
    return true;
  }

  const page = await renderManualPage(env, key, 0, role === "owner");
  if (!page) {
    await sendMessage(env, message.chat.id, `${manualTitle(key)} is not available yet.`);
    return true;
  }
  await sendMessage(env, message.chat.id, page.text, page.keyboard);
  return true;
}

async function handleManualCallback(env: Env, callback: TelegramCallbackQuery): Promise<boolean> {
  const data = callback.data ?? "";
  if (!data.startsWith("manual:")) return false;
  if (!env.DB || !callback.message) {
    await answerCallback(env, callback.id);
    return true;
  }

  if (data === "manual:noop") {
    await answerCallback(env, callback.id);
    return true;
  }

  const role = await roleFor(env, callback.from.id);

  const pageMatch = data.match(/^manual:page:(owner|admin):(\d+)$/);
  if (pageMatch) {
    const key = pageMatch[1] as ManualKey;
    if (!canReadManual(role, key)) {
      await answerCallback(env, callback.id, "Not authorized");
      return true;
    }
    const page = await renderManualPage(env, key, Number(pageMatch[2]), role === "owner");
    await answerCallback(env, callback.id);
    if (page) await editOrSend(env, callback.message, page.text, page.keyboard);
    return true;
  }

  const editMatch = data.match(/^manual:editpage:(owner|admin):(\d+)$/);
  if (editMatch) {
    if (role !== "owner") {
      await answerCallback(env, callback.id, "Owner only");
      return true;
    }
    const key = editMatch[1] as ManualKey;
    const index = Number(editMatch[2]);
    const sections = await listManualSections(env.DB, key);
    const section = sections[index];
    await answerCallback(env, callback.id);
    if (!section) return true;

    await saveSession(
      env.DB,
      callback.from.id,
      "awaiting_manual_edit_body",
      `${key}:${section.sectionKey}`,
      { index },
    );
    await editOrSend(
      env,
      callback.message,
      [
        `Editing ${manualTitle(key)}`,
        "",
        section.title,
        `Version ${section.version}`,
        "",
        "Send the complete replacement text for this section in one message.",
        "Nothing is saved until you review the preview and press Save.",
        "Use /cancel to stop editing.",
      ].join("\n"),
    );
    return true;
  }

  if (data === "manual:discard") {
    await clearSession(env.DB, callback.from.id);
    await answerCallback(env, callback.id, "Edit discarded");
    await editOrSend(env, callback.message, "Manual edit discarded. Open the manual again when needed.");
    return true;
  }

  if (data === "manual:save") {
    if (role !== "owner") {
      await answerCallback(env, callback.id, "Owner only");
      return true;
    }
    const session = await env.DB.prepare(
      `SELECT state, provider, payload FROM admin_sessions WHERE telegram_user_id=?1`,
    ).bind(callback.from.id).first<{ state: string; provider: string | null; payload: string | null }>();
    if (!session || session.state !== "manual_edit_preview" || !session.provider || !session.payload) {
      await answerCallback(env, callback.id, "Edit session expired");
      return true;
    }
    const target = session.provider.match(/^(owner|admin):([a-z0-9-]+)$/);
    if (!target) {
      await clearSession(env.DB, callback.from.id);
      await answerCallback(env, callback.id, "Invalid edit session");
      return true;
    }

    const payload = JSON.parse(session.payload) as { body: string; index?: number };
    const key = target[1] as ManualKey;
    const updated = await updateManualSection(env.DB, key, target[2], payload.body, callback.from.id);
    await clearSession(env.DB, callback.from.id);
    await answerCallback(env, callback.id, updated ? "Saved" : "Section not found");

    const page = await renderManualPage(env, key, payload.index ?? 0, true);
    if (page) await editOrSend(env, callback.message, page.text, page.keyboard);
    return true;
  }

  return false;
}

async function consumeManualEditText(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text) return false;
  const text = message.text.trim();
  if (!text || text.startsWith("/")) return false;
  if (await roleFor(env, message.from.id) !== "owner") return false;

  const session = await env.DB.prepare(
    `SELECT state, provider, payload FROM admin_sessions WHERE telegram_user_id=?1`,
  ).bind(message.from.id).first<{ state: string; provider: string | null; payload: string | null }>();
  if (!session || session.state !== "awaiting_manual_edit_body" || !session.provider) return false;

  if (text.length > 3500) {
    await sendMessage(env, message.chat.id, "This section is too long for a clean Telegram manual view. Keep it under 3,500 characters or use /cancel.");
    return true;
  }

  const oldPayload = session.payload ? JSON.parse(session.payload) as { index?: number } : {};
  await saveSession(env.DB, message.from.id, "manual_edit_preview", session.provider, {
    body: text.replace(/\\n/g, "\n"),
    index: oldPayload.index ?? 0,
  });
  await sendMessage(
    env,
    message.chat.id,
    `Preview — not saved yet\n\n${text.replace(/\\n/g, "\n")}`,
    {
      inline_keyboard: [[
        { text: "✓ Save", callback_data: "manual:save" },
        { text: "Discard", callback_data: "manual:discard" },
      ]],
    },
  );
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

    await syncCommandsBeforeIntercept(env);

    if (update.callback_query && await handleManualCallback(env, update.callback_query)) {
      return json({ ok: true });
    }
    if (update.message && await handleManualCommand(env, update.message)) {
      return json({ ok: true });
    }
    if (update.message && await consumeManualEditText(env, update.message)) {
      return json({ ok: true });
    }

    return app.fetch(request, env);
  },
};
