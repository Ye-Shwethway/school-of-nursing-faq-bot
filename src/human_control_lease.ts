import { getStaffInboxChatId } from "./handoff";
import {
  expireHumanControlLease,
  getMonitoringTopic,
  listExpiredHumanControls,
} from "./monitoring";

interface Env {
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
}

type Language = "my" | "en" | "zh";

const AUTO_RETURN_COPY: Record<Language, string> = {
  my: "ဝန်ထမ်းမှ တိုက်ရိုက်ကိုင်တွယ်မှုသည် 1 hour ကြာ activity မရှိသဖြင့် automated assistant ဆီ အလိုအလျောက် ပြန်လည်လွှဲပြောင်းပြီးပါပြီ။ မေးခွန်းများကို ဆက်လက်ပို့နိုင်ပါတယ်။",
  en: "This conversation was automatically returned to the automated assistant after 1 hour without staff activity. You may continue sending your questions here.",
  zh: "由于工作人员连续 1 小时没有新的处理活动，此对话已自动交回智能助理。您可以继续在这里发送问题。",
};

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

async function languageFor(db: D1Database, telegramUserId: number): Promise<Language> {
  try {
    const row = await db.prepare(
      `SELECT language FROM users WHERE telegram_user_id=?1`,
    ).bind(telegramUserId).first<{ language: string | null }>();
    return row?.language === "my" || row?.language === "zh" ? row.language : "en";
  } catch {
    return "en";
  }
}

async function clearLatestReturnButton(
  env: Env,
  telegramUserId: number,
  staffChatId: number,
): Promise<void> {
  if (!env.DB) return;
  try {
    const row = await env.DB.prepare(
      `SELECT latest_control_message_id FROM monitoring_topics
       WHERE telegram_user_id=?1 AND staff_chat_id=?2`,
    ).bind(telegramUserId, staffChatId).first<{ latest_control_message_id: number | null }>();
    const messageId = row?.latest_control_message_id ?? null;
    if (messageId) {
      await telegramApi(env, "editMessageReplyMarkup", {
        chat_id: staffChatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [] },
      });
    }
    await env.DB.prepare(
      `UPDATE monitoring_topics
       SET latest_control_message_id=NULL, updated_at=CURRENT_TIMESTAMP
       WHERE telegram_user_id=?1 AND staff_chat_id=?2`,
    ).bind(telegramUserId, staffChatId).run();
  } catch {
    // Cleanup is best-effort; lease state in D1 remains authoritative.
  }
}

async function notifyExpiredLease(
  env: Env,
  telegramUserId: number,
  claimantId: number,
): Promise<void> {
  if (!env.DB) return;

  const language = await languageFor(env.DB, telegramUserId);
  await telegramApi(env, "sendMessage", {
    chat_id: telegramUserId,
    text: AUTO_RETURN_COPY[language],
  });

  const claimantText = [
    "Human-control lease expired",
    `Conversation with user ${telegramUserId} was automatically returned to AI after 1 hour without claimant activity.`,
    "Take Over again if further staff handling is needed.",
  ].join("\n");
  const direct = await telegramApi(env, "sendMessage", {
    chat_id: claimantId,
    text: claimantText,
  });

  const staffChatId = await getStaffInboxChatId(env.DB);
  if (!staffChatId) return;
  const threadId = await getMonitoringTopic(env.DB, telegramUserId, staffChatId);

  await clearLatestReturnButton(env, telegramUserId, staffChatId);

  if (threadId) {
    await telegramApi(env, "sendMessage", {
      chat_id: staffChatId,
      message_thread_id: threadId,
      text: [
        `Auto-return to AI · User ${telegramUserId}`,
        `Previous claimant: ${claimantId}`,
        "Reason: 1 hour without claimant activity.",
        direct ? "Claimant notification: delivered privately." : "Claimant notification: private delivery unavailable; this topic note is the fallback notification.",
      ].join("\n"),
    });
  }
}

export async function sweepExpiredHumanControls(env: Env): Promise<number> {
  if (!env.DB) return 0;
  const expired = await listExpiredHumanControls(env.DB, 100);
  let returned = 0;

  for (const item of expired) {
    const changed = await expireHumanControlLease(
      env.DB,
      item.telegramUserId,
      item.claimedBy,
    );
    if (!changed) continue;
    returned += 1;
    await notifyExpiredLease(env, item.telegramUserId, item.claimedBy);
  }

  return returned;
}
