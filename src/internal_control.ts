import { getHandoffRoute, getStaffInboxChatId } from "./handoff";
import { getMonitoringMode } from "./monitoring";

export type InternalControlEnv = {
  APP_ENV: string;
  DB?: D1Database;
  IANEO_SERVICE_TOKEN?: string;
};

export type InternalCapabilitySafety = "read" | "write" | "sensitive";

export type InternalCapability = {
  id: string;
  label: string;
  description: string;
  safety: InternalCapabilitySafety;
  requiresConfirmation: boolean;
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
    id: "handoff.status",
    label: "Handoff Status",
    description: "Read human-handoff routing and Staff Inbox configuration",
    safety: "read",
    requiresConfirmation: false,
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

  if (actionId === "monitoring.status") {
    return { mode: await getMonitoringMode(env.DB) };
  }

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
      version: 1,
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
    if (capability.safety !== "read") {
      return json({ ok: false, error: "action_not_enabled" }, 403);
    }

    try {
      return json({
        ok: true,
        action: actionId,
        safety: capability.safety,
        data: await executeReadAction(actionId, env),
      });
    } catch (error) {
      console.error("IANEO internal action failed", actionId, error);
      return json({ ok: false, error: String((error as Error)?.message ?? "action_failed") }, 500);
    }
  }

  return json({ ok: false, error: "not_found" }, 404);
}
