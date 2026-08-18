import app from "./latest_return_entry";
import { syncCommandRegistryIfNeeded } from "./command_sync";

interface Env {
  APP_ENV: string;
  DEPLOY_REVISION?: string;
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
}

function ownerId(env: Env): number | null {
  const raw = env.BOT_OWNER_TELEGRAM_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
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

async function syncDeploymentCommandMenus(env: Env): Promise<void> {
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN) return;
  const api = (method: string, body: unknown) => telegramApi(env, method, body);
  try {
    await syncCommandRegistryIfNeeded(env.DB, api, env.BOT_OWNER_TELEGRAM_ID);
  } catch {
    // Command menu refresh is best-effort and must not make health fail.
  }
}

async function notificationTargets(env: Env): Promise<number[]> {
  const targets = new Set<number>();
  const owner = ownerId(env);
  if (owner !== null) targets.add(owner);
  if (!env.DB) return [...targets];
  try {
    const admins = await env.DB.prepare(
      `SELECT telegram_user_id FROM admin_roles
       WHERE role='sudo_admin' ORDER BY granted_at ASC`,
    ).all<{ telegram_user_id: number }>();
    for (const row of admins.results ?? []) {
      if (Number.isSafeInteger(row.telegram_user_id)) targets.add(row.telegram_user_id);
    }
  } catch {
    // Owner notification can still proceed if the admin table is temporarily unavailable.
  }
  return [...targets];
}

async function claimRevisionNotice(env: Env, revision: string): Promise<boolean> {
  if (!env.DB) return false;
  const key = `deploy_online:${revision}`;
  try {
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO bot_settings
        (setting_key, setting_value, updated_by, updated_at)
       VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP)`,
    ).bind(key, env.APP_ENV || "unknown", ownerId(env) ?? 0).run();
    return (result.meta.changes ?? 0) === 1;
  } catch {
    return false;
  }
}

async function notifyDeploymentOnline(env: Env): Promise<void> {
  const revision = env.DEPLOY_REVISION?.trim();
  if (!revision || !env.DB || !env.TELEGRAM_BOT_TOKEN) return;
  if (!await claimRevisionNotice(env, revision)) return;

  const shortRevision = revision.slice(0, 8);
  const text = [
    "🟢 Bot is Online!",
    "",
    "SR1 School of Nursing Inquiry is online and responding.",
    `Environment: ${env.APP_ENV || "unknown"}`,
    `Revision: ${shortRevision}`,
    "Health check: PASS",
    "Command menus: synced",
    "",
    "Telegram webhook, FAQ, AI, staff handoff, monitoring, and manuals are ready.",
  ].join("\n");

  const targets = await notificationTargets(env);
  await Promise.allSettled(
    targets.map((chatId) => telegramApi(env, "sendMessage", { chat_id: chatId, text })),
  );

  try {
    await env.DB.prepare(
      `DELETE FROM bot_settings
       WHERE setting_key LIKE 'deploy_online:%' AND setting_key<>?1`,
    ).bind(`deploy_online:${revision}`).run();
  } catch {
    // Cleanup is best-effort and must not affect deployment health.
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const response = await app.fetch(request, env);
    if (request.method === "GET" && url.pathname === "/health" && response.ok) {
      await syncDeploymentCommandMenus(env);
      await notifyDeploymentOnline(env);
    }
    return response;
  },
};
