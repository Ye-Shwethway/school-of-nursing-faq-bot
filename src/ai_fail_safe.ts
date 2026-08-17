export type AiAvailabilityReason =
  | "ready"
  | "d1_unavailable"
  | "master_key_missing"
  | "binding_missing"
  | "primary_missing"
  | "primary_credential_missing";

export type AiAvailability = {
  ready: boolean;
  reason: AiAvailabilityReason;
  primaryProvider?: string;
  primaryModel?: string;
  fallbackProvider?: string | null;
  fallbackModel?: string | null;
};

type FailSafeEnv = {
  DB?: D1Database;
  AI_CONFIG_MASTER_KEY?: string;
};

function credentialProvider(provider: string): string {
  return provider === "nanogpt_subscription" || provider === "nanogpt_all"
    ? "nanogpt"
    : provider;
}

export async function getAiAvailability(env: FailSafeEnv): Promise<AiAvailability> {
  if (!env.DB) return { ready: false, reason: "d1_unavailable" };
  if (!env.AI_CONFIG_MASTER_KEY) return { ready: false, reason: "master_key_missing" };

  const binding = await env.DB.prepare(
    `SELECT primary_provider, primary_model, fallback_provider, fallback_model
     FROM ai_model_bindings WHERE binding_key='faq_agent'`,
  ).first<{
    primary_provider: string | null;
    primary_model: string | null;
    fallback_provider: string | null;
    fallback_model: string | null;
  }>();

  if (!binding) return { ready: false, reason: "binding_missing" };
  if (!binding.primary_provider || !binding.primary_model) {
    return { ready: false, reason: "primary_missing" };
  }

  const credential = await env.DB.prepare(
    `SELECT provider FROM ai_provider_credentials WHERE provider=?1`,
  ).bind(credentialProvider(binding.primary_provider)).first<{ provider: string }>();

  if (!credential) {
    return {
      ready: false,
      reason: "primary_credential_missing",
      primaryProvider: binding.primary_provider,
      primaryModel: binding.primary_model,
      fallbackProvider: binding.fallback_provider,
      fallbackModel: binding.fallback_model,
    };
  }

  return {
    ready: true,
    reason: "ready",
    primaryProvider: binding.primary_provider,
    primaryModel: binding.primary_model,
    fallbackProvider: binding.fallback_provider,
    fallbackModel: binding.fallback_model,
  };
}

/**
 * AI infrastructure failures are fail-closed for automated answering.
 * Callers must route to human handoff instead of surfacing provider errors
 * to end users or attempting an ungrounded answer.
 */
export function shouldHandoffForAiFailure(error: unknown): true {
  void error;
  return true;
}
