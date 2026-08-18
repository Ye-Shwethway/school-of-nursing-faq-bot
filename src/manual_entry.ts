import app from "./deployment_notice_entry";
import { getAdminRole } from "./admin";
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

function manualControls(key: ManualKey, canEdit: boolean): InlineKeyboard {
  const rows: InlineKeyboard["inline_keyboard"] = [];
  if (canEdit) rows.push([{ text: "✎ Edit a section", callback_data: `manual:edit:${key}` }]);
  rows.push([{ text: "✕ Close", callback_data: "ui:close" }]);
  return { inline_keyboard: rows };
}

async function sendFullManual(env: Env, chatId: number, key: ManualKey, canEdit: boolean): Promise<void> {
  const sections = await listManualSections(env.DB, key);
  if (!sections.length) {
    await sendMessage(env, chatId, `${manualTitle(key)} is not available yet.`);
    return;
  }
  await sendMessage(
    env,
    chatId,
    `${manualTitle(key)}\n\nဒီ manual က bot ကို နေ့စဉ်အသုံးပြုရာမှာ နားလည်လွယ်အောင် ရေးထားတာပါ။ Technical setup guide မဟုတ်ပါ။`,
  );
  for (const section of sections) {
    await sendMessage(env, chatId, `${section.title}\n\n${section.body}`);
  }
  await sendMessage(env, chatId, "Manual controls", manualControls(key, canEdit));
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

  if (key === "owner" && role !== "owner") {
    await sendMessage(env, message.chat.id, "Owner Manual is available to the Bot Owner only.");
    return true;
  }
  if (key === "admin" && role !== "owner" && role !== "sudo_admin") {
    await sendMessage(env, message.chat.id, "Admin Manual is available to the Bot Owner and Sudo Admins only.");
    return true;
  }

  await sendFullManual(env, message.chat.id, key, role === "owner");
  return true;
}

async function handleManualCallback(env: Env, callback: TelegramCallbackQuery): Promise<boolean> {
  const data = callback.data ?? "";
  if (!data.startsWith("manual:")) return false;
  const role = await roleFor(env, callback.from.id);
  if (role !== "owner") {
    await answerCallback(env, callback.id, "Owner only");
    return true;
  }
  if (!env.DB || !callback.message) {
    await answerCallback(env, callback.id);
    return true;
  }

  const editMatch = data.match(/^manual:edit:(owner|admin)$/);
  if (editMatch) {
    const key = editMatch[1] as ManualKey;
    const sections = await listManualSections(env.DB, key);
    await answerCallback(env, callback.id);
    await editOrSend(
      env,
      callback.message,
      `${manualTitle(key)}\nChoose the section you want to edit.`,
      {
        inline_keyboard: [
          ...sections.map((section) => [{
            text: section.title.slice(0, 58),
            callback_data: `manual:section:${key}:${section.sectionKey}`,
          }]),
          [{ text: "← Back", callback_data: `manual:back:${key}` }],
          [{ text: "✕ Close", callback_data: "ui:close" }],
        ],
      },
    );
    return true;
  }

  const sectionMatch = data.match(/^manual:section:(owner|admin):([a-z0-9-]+)$/);
  if (sectionMatch) {
    const key = sectionMatch[1] as ManualKey;
    const sectionKey = sectionMatch[2];
    const section = await getManualSection(env.DB, key, sectionKey);
    await answerCallback(env, callback.id);
    if (!section) {
      await editOrSend(env, callback.message, "Manual section not found.", manualControls(key, true));
      return true;
    }
    await saveSession(env.DB, callback.from.id, "awaiting_manual_edit_body", `${key}:${sectionKey}`, null);
    await editOrSend(
      env,
      callback.message,
      [
        `Editing: ${section.title}`,
        `Current version: ${section.version}`,
        "",
        "Send the complete replacement text for this section in one message.",
        "Nothing is saved until you review the preview and press Save.",
        "Use /cancel to stop editing.",
      ].join("\n"),
    );
    return true;
  }

  const backMatch = data.match(/^manual:back:(owner|admin)$/);
  if (backMatch) {
    const key = backMatch[1] as ManualKey;
    await answerCallback(env, callback.id);
    await editOrSend(env, callback.message, `${manualTitle(key)} controls`, manualControls(key, true));
    return true;
  }

  if (data === "manual:discard") {
    await clearSession(env.DB, callback.from.id);
    await answerCallback(env, callback.id, "Edit discarded");
    await editOrSend(env, callback.message, "Manual edit discarded.");
    return true;
  }

  if (data === "manual:save") {
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
    const payload = JSON.parse(session.payload) as { body: string };
    const key = target[1] as ManualKey;
    const updated = await updateManualSection(env.DB, key, target[2], payload.body, callback.from.id);
    await clearSession(env.DB, callback.from.id);
    await answerCallback(env, callback.id, updated ? "Saved" : "Section not found");
    await editOrSend(
      env,
      callback.message,
      updated
        ? `Saved successfully.\n\n${updated.title}\nVersion: ${updated.version}\n\n${updated.body}`
        : "Manual section was not found.",
      manualControls(key, true),
    );
    return true;
  }

  return false;
}

async function consumeManualEditText(env: Env, message: TelegramMessage): Promise<boolean> {
  if (!env.DB || !message.from || !message.text) return false;
  const text = message.text.trim();
  if (!text || text.startsWith("/")) return false;
  const role = await roleFor(env, message.from.id);
  if (role !== "owner") return false;

  const session = await env.DB.prepare(
    `SELECT state, provider FROM admin_sessions WHERE telegram_user_id=?1`,
  ).bind(message.from.id).first<{ state: string; provider: string | null }>();
  if (!session || session.state !== "awaiting_manual_edit_body" || !session.provider) return false;

  if (text.length > 3500) {
    await sendMessage(env, message.chat.id, "This section is too long for a clean Telegram manual view. Keep it under 3,500 characters or use /cancel.");
    return true;
  }

  const target = session.provider.match(/^(owner|admin):([a-z0-9-]+)$/);
  if (!target) {
    await clearSession(env.DB, message.from.id);
    await sendMessage(env, message.chat.id, "Manual edit session expired. Open the manual and try again.");
    return true;
  }

  await saveSession(env.DB, message.from.id, "manual_edit_preview", session.provider, { body: text });
  await sendMessage(
    env,
    message.chat.id,
    `Preview — not saved yet\n\n${text}`,
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
