export type MonitoringTelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export function monitoringUserHeader(user: MonitoringTelegramUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim() || "Unknown name";
  const username = user.username ? ` (@${user.username})` : "";
  return `USER · ${name}${username} · ID ${user.id}`;
}

export async function monitoringAiHeader(
  db: D1Database | undefined,
  source: "primary" | "fallback" | string,
): Promise<string> {
  if (!db) return "AI · model unavailable";
  try {
    const row = await db.prepare(
      `SELECT primary_provider, primary_model, fallback_provider, fallback_model
       FROM ai_model_bindings WHERE binding_key='faq_agent'`,
    ).first<{
      primary_provider: string | null;
      primary_model: string | null;
      fallback_provider: string | null;
      fallback_model: string | null;
    }>();

    const fallback = source === "fallback";
    const provider = fallback ? row?.fallback_provider : row?.primary_provider;
    const model = fallback ? row?.fallback_model : row?.primary_model;
    if (!provider && !model) return "AI · model unavailable";
    if (!provider) return `AI · ${model}`;
    if (!model) return `AI · ${provider}`;
    return `AI · ${provider}/${model}`;
  } catch {
    return "AI · model unavailable";
  }
}

export function monitoringBotHeader(kind: "faq" | "handoff" = "faq"): string {
  return kind === "handoff" ? "BOT · Human handoff" : "BOT · FAQ";
}
