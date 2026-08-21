import app from "./rate_limit_entry";
import type { Language } from "./faq";
import { checkInteractionFlood, interactionFloodMessage } from "./interaction_flood";
import { sweepExpiredHumanControls } from "./human_control_lease";
import {
  countAvailableStaff,
  sweepStaffAvailability,
  type StaffAvailabilityTransition,
} from "./staff_presence";
import { getHandoffRoute, getStaffInboxChatId } from "./handoff";
import { getMonitoringMode } from "./monitoring";

interface Env {
  APP_ENV: string;
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
  AI_CONFIG_MASTER_KEY?: string;
  IANEO_SERVICE_TOKEN?: string;
  DEPLOY_REVISION?: string;
}

type TelegramUser = { id: number };
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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function isPrivate(message: TelegramMessage): boolean {
  return message.chat.type === "private" || message.chat.id === message.from?.id;
}

async function telegramApi(env: Env, method: string, body: unknown): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    // Operational notifications are best-effort and must not interrupt scheduled state updates.
  }
}

async function languageFor(db: D1Database | undefined, userId: number): Promise<Language> {
  if (!db) return "en";
  try {
    const row = await db.prepare(`SELECT language FROM users WHERE telegram_user_id=?1`)
      .bind(userId).first<{ language: string | null }>();
    return row?.language === "my" || row?.language === "zh" ? row.language : "en";
  } catch {
    return "en";
  }
}

function transitionReason(transition: StaffAvailabilityTransition): string {
  if (transition.reason === "timer_expired") return "Temporary unavailable timer ended.";
  if (transition.reason === "manual_override_expired") return "Temporary manual override ended; recurring schedule resumed.";
  if (transition.reason === "schedule_started") return "Daily availability window started.";
  return "Daily availability window ended.";
}

async function announceStaffAvailabilityTransitions(
  env: Env,
  transitions: StaffAvailabilityTransition[],
): Promise<void> {
  if (!env.DB || transitions.length === 0) return;
  const staffInboxId = await getStaffInboxChatId(env.DB);
  const count = await countAvailableStaff(env.DB);

  for (const transition of transitions) {
    const state = transition.available ? "AVAILABLE" : "UNAVAILABLE";
    const reason = transitionReason(transition);
    await telegramApi(env, "sendMessage", {
      chat_id: transition.telegramUserId,
      text: [
        "🕒 Staff availability auto-update",
        `Your state is now: ${state}`,
        `Reason: ${reason}`,
        "Timezone: Asia/Yangon (UTC+06:30)",
        `Available staff: ${count}`,
      ].join("\n"),
    });

    if (staffInboxId !== null) {
      await telegramApi(env, "sendMessage", {
        chat_id: staffInboxId,
        text: [
          "🕒 Staff availability auto-update",
          `Staff: Telegram ID ${transition.telegramUserId}`,
          `State: ${state}`,
          `Reason: ${reason}`,
          "Timezone: Asia/Yangon (UTC+06:30)",
          `Available staff: ${count}`,
        ].join("\n"),
      });
    }
  }
}

async function countQuery(db: D1Database, sql: string): Promise<number> {
  const row = await db.prepare(sql).first<{ count: number }>();
  const count = Number(row?.count ?? 0);
  return Number.isFinite(count) ? count : 0;
}

function internalAuthorized(request: Request, env: Env): boolean {
  if (!env.IANEO_SERVICE_TOKEN) return false;
  return request.headers.get("authorization") === `Bearer ${env.IANEO_SERVICE_TOKEN}`;
}

async function handleInternalStatus(request: Request, env: Env): Promise<Response> {
  if (!env.IANEO_SERVICE_TOKEN) {
    return json({ ok: false, error: "internal_control_unconfigured" }, 503);
  }
  if (!internalAuthorized(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!env.DB) {
    return json({ ok: false, error: "storage_unavailable" }, 503);
  }

  try {
    const [
      monitoringMode,
      handoffRoute,
      staffInboxId,
      users,
      questions,
      pendingQuestions,
      activeCases,
      activeStaff,
      sudoAdmins,
      humanControlledConversations,
    ] = await Promise.all([
      getMonitoringMode(env.DB),
      getHandoffRoute(env.DB),
      getStaffInboxChatId(env.DB),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM users"),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM questions"),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM questions WHERE resolution='pending'"),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM escalation_cases WHERE status IN ('open','claimed')"),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM staff_members WHERE active=1"),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM admin_roles WHERE role='sudo_admin'"),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM conversation_control WHERE mode='human'"),
    ]);

    return json({
      ok: true,
      service: "school-of-nursing-faq-bot",
      environment: env.APP_ENV,
      monitoring: { mode: monitoringMode },
      handoff: {
        route: handoffRoute,
        staffInboxConfigured: staffInboxId !== null,
      },
      stats: {
        users,
        questions,
        pendingQuestions,
        activeCases,
        activeStaff,
        sudoAdmins,
        humanControlledConversations,
      },
    });
  } catch (error) {
    console.error("IANEO internal status failed", error);
    return json({ ok: false, error: "internal_status_failed" }, 500);
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

  const callback = update.callback_query;
  if (callback?.message && isPrivate(callback.message)) {
    const decision = await checkInteractionFlood(env.DB, callback.from.id, env.BOT_OWNER_TELEGRAM_ID);
    if (!decision.allowed) {
      if (decision.notify) {
        const language = await languageFor(env.DB, callback.from.id);
        await telegramApi(env, "answerCallbackQuery", {
          callback_query_id: callback.id,
          text: interactionFloodMessage(language, decision.retryMinutes),
          show_alert: true,
        });
      }
      return json({ ok: true });
    }
  }

  const message = update.message;
  if (message?.from && isPrivate(message)) {
    const decision = await checkInteractionFlood(env.DB, message.from.id, env.BOT_OWNER_TELEGRAM_ID);
    if (!decision.allowed) {
      if (decision.notify) {
        const language = await languageFor(env.DB, message.from.id);
        await telegramApi(env, "sendMessage", {
          chat_id: message.chat.id,
          text: interactionFloodMessage(language, decision.retryMinutes),
        });
      }
      return json({ ok: true });
    }
  }

  return app.fetch(request, env);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/internal/v1/status") {
      return handleInternalStatus(request, env);
    }
    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleWebhook(request, env);
    }
    return app.fetch(request, env);
  },

  async scheduled(_controller: ScheduledController, env: Env, _ctx: ExecutionContext): Promise<void> {
    const [, staffSweep] = await Promise.allSettled([
      sweepExpiredHumanControls(env),
      sweepStaffAvailability(env.DB),
    ] as const);
    if (staffSweep.status === "fulfilled") {
      await announceStaffAvailabilityTransitions(env, staffSweep.value);
    }
  },
};
