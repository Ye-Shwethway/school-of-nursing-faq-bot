import app from "./cases_entry";
import type { Language } from "./faq";
import { getConversationControl } from "./monitoring";

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
  chat: { id: number; type?: string };
  from?: TelegramUser;
};
type TelegramUpdate = { message?: TelegramMessage };

const CLARIFY_COPY: Record<Language, string> = {
  my: "မေးခွန်းကို အနည်းငယ် ပိုပြည့်စုံအောင် ရေးပေးပါ။ ဥပမာ ကျောင်းဝင်ခွင့်၊ သင်တန်းကြေး၊ လျှောက်လွှာ၊ စာမေးပွဲ သို့မဟုတ် သင်တန်းကာလအကြောင်း မေးမြန်းနိုင်ပါတယ်။ အများအားဖြင့်မေးလေ့ရှိသော အချက်အလက်များကို /faq မှလည်း ကြည့်နိုင်ပါတယ်။",
  en: "Please send a little more detail so I can understand your question. For example, you can ask about admissions, tuition, applications, exams, or the academic calendar. You can also check /faq for common School of Nursing questions.",
  zh: "请提供更完整的问题，以便我准确理解。例如，您可以询问招生、学费、申请、考试或校历等内容。常见问题也可以先查看 /faq。",
};

const FAQ_LABEL: Record<Language, string> = {
  my: "📚 FAQ များကြည့်ရန်",
  en: "📚 Browse FAQ",
  zh: "📚 查看常见问题",
};

const SHORT_MEANINGFUL = new Set([
  "fee", "fees", "tuition", "admission", "admissions", "apply", "application",
  "exam", "cdm", "accreditation", "scholarship", "loan", "bond", "campus",
  "address", "eligibility", "calendar",
]);

const LOW_INFORMATION = new Set([
  "ok", "okay", "yes", "no", "hi", "hello", "hey", "thanks", "thank you",
  "ဟုတ်", "ဟုတ်ကဲ့", "အင်း", "ကျေးဇူး", "ကျေးဇူးတင်ပါတယ်",
  "好", "好的", "是", "不是", "谢谢", "你好",
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function privateChat(message: TelegramMessage): boolean {
  return Boolean(message.from && (message.chat.type === "private" || message.chat.id === message.from.id));
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

async function languageFor(db: D1Database | undefined, userId: number): Promise<Language> {
  if (!db) return "en";
  const row = await db.prepare(`SELECT language FROM users WHERE telegram_user_id=?1`)
    .bind(userId).first<{ language: string | null }>();
  return row?.language === "my" || row?.language === "zh" ? row.language : "en";
}

async function hasInteractiveSession(db: D1Database | undefined, userId: number): Promise<boolean> {
  if (!db) return false;
  try {
    const row = await db.prepare(`SELECT state FROM admin_sessions WHERE telegram_user_id=?1`)
      .bind(userId).first<{ state: string }>();
    return Boolean(row?.state);
  } catch {
    return false;
  }
}

function isLowInformation(text: string): boolean {
  const trimmed = text.trim();
  const normalized = trimmed.toLocaleLowerCase();
  if (!trimmed) return false;
  if (SHORT_MEANINGFUL.has(normalized.replace(/[?!.,]+$/u, ""))) return false;
  if (LOW_INFORMATION.has(normalized)) return true;
  if (/^\d+(?:[\s,._-]*\d+)*$/u.test(trimmed)) return true;
  if (/^[\p{P}\p{S}\s]+$/u.test(trimmed)) return true;
  if (/^https?:\/\/\S+$/iu.test(trimmed)) return true;
  if (/^@[A-Za-z0-9_]{2,}$/u.test(trimmed)) return true;
  if (/^[+()\d\s.-]{5,}$/u.test(trimmed) && !/[\p{L}]/u.test(trimmed)) return true;
  if (/^(.)\1{4,}$/u.test(trimmed)) return true;
  if (!/[\p{L}\p{N}]/u.test(trimmed)) return true;

  const lettersAndNumbers = Array.from(trimmed.matchAll(/[\p{L}\p{N}]/gu)).length;
  if (lettersAndNumbers <= 1) return true;
  return false;
}

async function shouldBypassQualityGate(env: Env, userId: number): Promise<boolean> {
  if (await hasInteractiveSession(env.DB, userId)) return true;
  if (!env.DB) return false;
  try {
    return (await getConversationControl(env.DB, userId)).mode === "human";
  } catch {
    return false;
  }
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

  const message = update.message;
  const text = message?.text?.trim() ?? "";
  if (!message?.from || !text || text.startsWith("/") || !privateChat(message)) {
    return app.fetch(request, env);
  }
  if (await shouldBypassQualityGate(env, message.from.id)) return app.fetch(request, env);
  if (!isLowInformation(text)) return app.fetch(request, env);

  const language = await languageFor(env.DB, message.from.id);
  await telegramApi(env, "sendMessage", {
    chat_id: message.chat.id,
    text: CLARIFY_COPY[language],
    reply_parameters: { message_id: message.message_id },
    reply_markup: {
      inline_keyboard: [[{ text: FAQ_LABEL[language], callback_data: "faq:list:0" }]],
    },
  });
  return json({ ok: true, filtered: "low_information" });
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
