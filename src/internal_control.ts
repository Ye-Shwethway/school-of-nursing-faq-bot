import {
  getDedicatedStaffId,
  getHandoffRoute,
  getStaffInboxChatId,
  setHandoffRoute,
  type HandoffRoute,
} from "./handoff";
import {
  getMonitoringMode,
  setMonitoringMode,
  type MonitoringMode,
} from "./monitoring";

export type InternalControlEnv = {
  APP_ENV: string;
  DB?: D1Database;
  IANEO_SERVICE_TOKEN?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
};

export type InternalCapabilitySafety = "read" | "write" | "sensitive";

export type InternalCapabilityChoice = {
  value: string;
  label: string;
};

export type InternalCapabilityInput = {
  name: string;
  label: string;
  type: "choice";
  choices: InternalCapabilityChoice[];
};

export type InternalCapability = {
  id: string;
  label: string;
  description: string;
  safety: InternalCapabilitySafety;
  requiresConfirmation: boolean;
  input?: InternalCapabilityInput;
};

const CAPABILITIES: InternalCapability[] = [
  {
    id: "operations.status",
    label: "Operational Summary",
    description: "Read aggregate FAQ runtime and workload status",
    safety: "read",
    requiresConfirmation: false,
  },
  {
    id: "monitoring.status",
    label: "Monitoring Status",
    description: "Read the current shadow-monitoring mode",
    safety: "read",
    requiresConfirmation: false,
  },
  {
    id: "monitoring.set",
    label: "Set Monitoring Mode",
    description: "Change the FAQ shadow-monitoring mode",
    safety: "write",
    requiresConfirmation: true,
    input: {
      name: "mode",
      label: "Monitoring mode",
      type: "choice",
      choices: [
        { value: "all_alerts", label: "All alerts" },
        { value: "silent_all", label: "Silent all" },
        { value: "alerts_only", label: "Alerts only" },
        { value: "off", label: "Off" },
      ],
    },
  },
  {
    id: "handoff.status",
    label: "Handoff Status",
    description: "Read human-handoff routing and Staff Inbox configuration",
    safety: "read",
    requiresConfirmation: false,
  },
  {
    id: "handoff.set",
    label: "Set Handoff Route",
    description: "Change the FAQ human-handoff routing mode",
    safety: "write",
    requiresConfirmation: true,
    input: {
      name: "route",
      label: "Handoff route",
      type: "choice",
      choices: [
        { value: "auto", label: "Auto" },
        { value: "group", label: "Staff Inbox group" },
        { value: "dedicated", label: "Dedicated staff" },
      ],
    },
  },
  {
    id: "admins.summary",
    label: "Admin Summary",
    description: "Read aggregate Owner/Sudo Admin configuration",
    safety: "read",
    requiresConfirmation: false,
  },
  {
    id: "cases.summary",
    label: "Cases Summary",
    description: "Read aggregate escalation-case counts",
    safety: "read",
    requiresConfirmation: false,
  },
];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function authorized(request: Request, env: InternalControlEnv): boolean {
  return Boolean(
    env.IANEO_SERVICE_TOKEN &&
    request.headers.get("authorization") === `Bearer ${env.IANEO_SERVICE_TOKEN}`,
  );
}

function ownerId(env: InternalControlEnv): number {
  const raw = env.BOT_OWNER_TELEGRAM_ID?.trim();
  if (!raw || !/^\d+$/.test(raw)) throw new Error("owner_unconfigured");
  const id = Number(raw);
  if (!Number.isSafeInteger(id)) throw new Error("owner_unconfigured");
  return id;
}

async function countQuery(db: D1Database, sql: string): Promise<number> {
  const row = await db.prepare(sql).first<{ count: number }>();
  const count = Number(row?.count ?? 0);
  return Number.isFinite(count) ? count : 0;
}

async function operationsStatus(env: InternalControlEnv): Promise<unknown> {
  if (!env.DB) throw new Error("storage_unavailable");
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

  return {
    service: "school-of-nursing-faq-bot",
    environment: env.APP_ENV,
    monitoring: { mode: monitoringMode },
    handoff: { route: handoffRoute, staffInboxConfigured: staffInboxId !== null },
    stats: {
      users,
      questions,
      pendingQuestions,
      activeCases,
      activeStaff,
      sudoAdmins,
      humanControlledConversations,
    },
  };
}

async function executeReadAction(actionId: string, env: InternalControlEnv): Promise<unknown> {
  if (!env.DB) throw new Error("storage_unavailable");

  if (actionId === "operations.status") return operationsStatus(env);
  if (actionId === "monitoring.status") return { mode: await getMonitoringMode(env.DB) };

  if (actionId === "handoff.status") {
    const [route, staffInboxId] = await Promise.all([
      getHandoffRoute(env.DB),
      getStaffInboxChatId(env.DB),
    ]);
    return { route, staffInboxConfigured: staffInboxId !== null };
  }

  if (actionId === "admins.summary") {
    const [sudoAdmins, activeStaff] = await Promise.all([
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM admin_roles WHERE role='sudo_admin'"),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM staff_members WHERE active=1"),
    ]);
    return { ownerConfigured: true, sudoAdmins, activeStaff };
  }

  if (actionId === "cases.summary") {
    const [open, claimed, resolved] = await Promise.all([
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM escalation_cases WHERE status='open'"),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM escalation_cases WHERE status='claimed'"),
      countQuery(env.DB, "SELECT COUNT(*) AS count FROM escalation_cases WHERE status='resolved'"),
    ]);
    return { open, claimed, resolved, active: open + claimed };
  }

  throw new Error("unsupported_action");
}

function paramString(params: Record<string, unknown> | undefined, key: string): string | null {
  const value = params?.[key];
  return typeof value === "string" ? value : null;
}

async function executeWriteAction(
  actionId: string,
  env: InternalControlEnv,
  params: Record<string, unknown> | undefined,
): Promise<unknown> {
  if (!env.DB) throw new Error("storage_unavailable");
  const actorId = ownerId(env);

  if (actionId === "monitoring.set") {
    const mode = paramString(params, "mode");
    if (!mode || !["all_alerts", "silent_all", "alerts_only", "off"].includes(mode)) {
      throw new Error("invalid_monitoring_mode");
    }
    await setMonitoringMode(env.DB, actorId, mode as MonitoringMode);
    return { mode: await getMonitoringMode(env.DB) };
  }

  if (actionId === "handoff.set") {
    const route = paramString(params, "route");
    if (!route || !["auto", "group", "dedicated"].includes(route)) {
      throw new Error("invalid_handoff_route");
    }

    if (route === "group" && (await getStaffInboxChatId(env.DB)) === null) {
      throw new Error("staff_inbox_not_configured");
    }
    if (route === "dedicated" && (await getDedicatedStaffId(env.DB)) === null) {
      throw new Error("dedicated_staff_not_configured");
    }

    await setHandoffRoute(env.DB, actorId, route as HandoffRoute);
    return { route: await getHandoffRoute(env.DB) };
  }

  throw new Error("unsupported_action");
}

export async function handleInternalControl(request: Request, env: InternalControlEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/internal/v1/")) return null;

  if (!env.IANEO_SERVICE_TOKEN) {
    return json({ ok: false, error: "internal_control_unconfigured" }, 503);
  }
  if (!authorized(request, env)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  if (request.method === "GET" && url.pathname === "/internal/v1/capabilities") {
    return json({
      ok: true,
      service: "school-of-nursing-faq-bot",
      version: 2,
      capabilities: CAPABILITIES,
    });
  }

  if (request.method === "GET" && url.pathname === "/internal/v1/status") {
    try {
      return json({ ok: true, ...(await operationsStatus(env) as Record<string, unknown>) });
    } catch (error) {
      console.error("IANEO internal status failed", error);
      return json({ ok: false, error: "internal_status_failed" }, 500);
    }
  }

  const actionMatch = url.pathname.match(/^\/internal\/v1\/actions\/([a-z0-9._-]+)$/);
  if (request.method === "POST" && actionMatch) {
    const actionId = actionMatch[1];
    const capability = CAPABILITIES.find((item) => item.id === actionId);
    if (!capability) return json({ ok: false, error: "unsupported_action" }, 404);

    let body: { confirmed?: boolean; params?: Record<string, unknown> } = {};
    try {
      body = (await request.json()) as typeof body;
    } catch {
      body = {};
    }

    if (capability.safety !== "read" && capability.requiresConfirmation && body.confirmed !== true) {
      return json({ ok: false, error: "confirmation_required" }, 409);
    }
    if (capability.safety === "sensitive") {
      return json({ ok: false, error: "action_not_enabled" }, 403);
    }

    try {
      const data = capability.safety === "read"
        ? await executeReadAction(actionId, env)
        : await executeWriteAction(actionId, env, body.params);
      return json({
        ok: true,
        action: actionId,
        safety: capability.safety,
        data,
      });
    } catch (error) {
      const message = String((error as Error)?.message ?? "action_failed");
      console.error("IANEO internal action failed", actionId, error);
      const status = message.startsWith("invalid_") || message.endsWith("_not_configured") ? 400 : 500;
      return json({ ok: false, error: message }, status);
    }
  }

  return json({ ok: false, error: "not_found" }, 404);
}
