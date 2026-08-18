import app from "./latest_return_entry";
import { syncCommandRegistryIfNeeded } from "./command_sync";
import { commandScopeForPrivateChat, commandsForRole } from "./command_menu";

interface Env {
  APP_ENV: string;
  DEPLOY_REVISION?: string;
  DB?: D1Database;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
}

function ownerId(env: Env): number | null {
  const raw = env.BOT_OWNER_TELEGRAM_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
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
    // Command menu refresh is best-effort on ordinary health requests.
  }
}

async function consumeOpsNonce(request: Request, env: Env, settingKey: string): Promise<Response | null> {
  if (env.APP_ENV !== "production") return json({ ok: false, error: "production_only" }, 404);
  if (!env.DB) return json({ ok: false, error: "production_database_not_ready" }, 503);

  const suppliedNonce = request.headers.get("x-ops-nonce")?.trim()
    ?? request.headers.get("x-cutover-nonce")?.trim();
  if (!suppliedNonce) return json({ ok: false, error: "missing_nonce" }, 401);

  const row = await env.DB.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key=?1`,
  ).bind(settingKey).first<{ setting_value: string }>();
  if (!row?.setting_value || row.setting_value !== suppliedNonce) {
    return json({ ok: false, error: "invalid_nonce" }, 403);
  }

  const consumed = await env.DB.prepare(
    `DELETE FROM bot_settings WHERE setting_key=?1 AND setting_value=?2`,
  ).bind(settingKey, suppliedNonce).run();
  if ((consumed.meta.changes ?? 0) !== 1) {
    return json({ ok: false, error: "nonce_already_consumed" }, 409);
  }
  return null;
}

async function handleProductionOwnerCommandResync(request: Request, env: Env): Promise<Response> {
  if (!env.TELEGRAM_BOT_TOKEN) return json({ ok: false, error: "telegram_token_missing" }, 503);
  const owner = ownerId(env);
  if (owner === null) return json({ ok: false, error: "owner_id_missing_or_invalid" }, 503);

  const nonceError = await consumeOpsNonce(request, env, "owner_command_resync_nonce");
  if (nonceError) return nonceError;

  const expected = commandsForRole("owner");
  const scope = commandScopeForPrivateChat(owner);
  const setResult = await telegramApi(env, "setMyCommands", { commands: expected, scope });
  if (setResult !== true) {
    return json({ ok: false, error: "telegram_set_owner_commands_failed" }, 502);
  }

  const actual = await telegramApi(env, "getMyCommands", { scope });
  if (!Array.isArray(actual)) {
    return json({ ok: false, error: "telegram_get_owner_commands_failed" }, 502);
  }

  const expectedNames = expected.map((item) => item.command);
  const actualNames = actual.map((item: any) => String(item?.command ?? ""));
  const exactMatch = expectedNames.length === actualNames.length
    && expectedNames.every((name, index) => actualNames[index] === name);
  if (!exactMatch) {
    return json({
      ok: false,
      error: "owner_command_readback_mismatch",
      expected_commands: expectedNames,
      actual_commands: actualNames,
    }, 502);
  }

  if (env.DB) {
    try {
      await env.DB.prepare(
        `DELETE FROM bot_settings WHERE setting_key='command_schema_version'`,
      ).run();
    } catch {
      // Read-back verification above is authoritative for this operation.
    }
  }

  return json({
    ok: true,
    environment: "production",
    owner_commands: actualNames,
    command_count: actualNames.length,
  });
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

async function releaseRevisionNotice(env: Env, revision: string): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare(
      `DELETE FROM bot_settings WHERE setting_key=?1`,
    ).bind(`deploy_online:${revision}`).run();
  } catch {
    // A later health request can still retry if cleanup succeeds then.
  }
}

async function notifyDeploymentOnline(env: Env): Promise<void> {
  // TEST and PRODUCTION share the same Telegram bot token. TEST deployments must
  // never inject operational status messages into the live Owner chat.
  if (env.APP_ENV !== "production") return;

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
    "Command menus: sync requested",
    "",
    "Telegram webhook, FAQ, AI, staff handoff, monitoring, and manuals are ready.",
  ].join("\n");

  const targets = await notificationTargets(env);
  const deliveries = await Promise.allSettled(
    targets.map((chatId) => telegramApi(env, "sendMessage", { chat_id: chatId, text })),
  );
  const delivered = deliveries.some(
    (result) => result.status === "fulfilled" && result.value !== null,
  );

  // The revision claim is only durable when at least one operational recipient
  // actually received the notice. If Telegram delivery fails completely, release
  // the claim so the next successful /health request can retry the same revision.
  if (!delivered) {
    await releaseRevisionNotice(env, revision);
    return;
  }

  try {
    await env.DB.prepare(
      `DELETE FROM bot_settings
       WHERE setting_key LIKE 'deploy_online:%' AND setting_key<>?1`,
    ).bind(`deploy_online:${revision}`).run();
  } catch {
    // Cleanup is best-effort and must not affect deployment health.
  }
}

async function handleProductionTelegramCutover(request: Request, env: Env): Promise<Response> {
  if (env.APP_ENV !== "production") return json({ ok: false, error: "production_only" }, 404);
  if (!env.DB || !env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_WEBHOOK_SECRET) {
    return json({ ok: false, error: "production_runtime_not_ready" }, 503);
  }

  const suppliedNonce = request.headers.get("x-cutover-nonce")?.trim();
  if (!suppliedNonce) return json({ ok: false, error: "missing_nonce" }, 401);

  const row = await env.DB.prepare(
    `SELECT setting_value FROM bot_settings WHERE setting_key='telegram_cutover_nonce'`,
  ).first<{ setting_value: string }>();
  if (!row?.setting_value || row.setting_value !== suppliedNonce) {
    return json({ ok: false, error: "invalid_nonce" }, 403);
  }

  const consumed = await env.DB.prepare(
    `DELETE FROM bot_settings
     WHERE setting_key='telegram_cutover_nonce' AND setting_value=?1`,
  ).bind(suppliedNonce).run();
  if ((consumed.meta.changes ?? 0) !== 1) {
    return json({ ok: false, error: "nonce_already_consumed" }, 409);
  }

  const origin = new URL(request.url).origin;
  const webhookUrl = `${origin}/telegram/webhook`;
  const setResult = await telegramApi(env, "setWebhook", {
    url: webhookUrl,
    secret_token: env.TELEGRAM_WEBHOOK_SECRET,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
  if (setResult !== true) {
    return json({ ok: false, error: "telegram_set_webhook_failed" }, 502);
  }

  const info = await telegramApi(env, "getWebhookInfo", {});
  if (!info || info.url !== webhookUrl) {
    return json({ ok: false, error: "telegram_webhook_readback_failed" }, 502);
  }

  await syncDeploymentCommandMenus(env);
  return json({
    ok: true,
    environment: "production",
    webhook_url: webhookUrl,
    pending_update_count: Number(info.pending_update_count ?? 0),
    last_error_message: info.last_error_message ?? null,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/ops/telegram/cutover") {
      return handleProductionTelegramCutover(request, env);
    }
    if (request.method === "POST" && url.pathname === "/ops/telegram/owner-command-resync") {
      return handleProductionOwnerCommandResync(request, env);
    }

    const response = await app.fetch(request, env);
    if (request.method === "GET" && url.pathname === "/health" && response.ok) {
      await syncDeploymentCommandMenus(env);
      await notifyDeploymentOnline(env);
    }
    return response;
  },
};
