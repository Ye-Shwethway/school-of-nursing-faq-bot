import { buildAgentSystemPrompt, parseAgentDecision, type AgentDecision } from "./agent_policy";
import { getAiAvailability } from "./ai_fail_safe";
import { notifyAiOutage, notifyAiRecovered } from "./ai_outage_alert";
import type { Language } from "./faq";

export type AiRuntimeEnv = {
  DB?: D1Database;
  AI_CONFIG_MASTER_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  BOT_OWNER_TELEGRAM_ID?: string;
};

export type GroundedAiResult = {
  action: "answer" | "handoff";
  answer: string;
  reason: string;
  source: "primary" | "fallback" | "human";
};

type Credential = {
  encrypted_key: string;
  key_iv: string;
  base_url: string | null;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function decryptSecret(masterKey: string, encrypted: string, iv: string): Promise<string> {
  const raw = base64ToBytes(masterKey);
  if (raw.byteLength !== 32) throw new Error("invalid_master_key");
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(encrypted),
  );
  return decoder.decode(plaintext);
}

function credentialProvider(provider: string): string {
  return provider === "nanogpt_subscription" || provider === "nanogpt_all" ? "nanogpt" : provider;
}

async function loadCredential(db: D1Database, provider: string): Promise<Credential | null> {
  return db.prepare(
    `SELECT encrypted_key, key_iv, base_url
     FROM ai_provider_credentials WHERE provider=?1`,
  ).bind(credentialProvider(provider)).first<Credential>();
}

function defaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com/v1",
    anthropic: "https://api.anthropic.com/v1",
    gemini: "https://generativelanguage.googleapis.com/v1beta",
    openrouter: "https://openrouter.ai/api/v1",
    groq: "https://api.groq.com/openai/v1",
    mistral: "https://api.mistral.ai/v1",
  };
  return urls[provider] ?? "";
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function providerText(
  provider: string,
  model: string,
  apiKey: string,
  baseUrl: string | null,
  systemPrompt: string,
  question: string,
): Promise<string> {
  if (provider === "openai") {
    const response = await fetchWithTimeout(`${defaultBaseUrl(provider)}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        instructions: systemPrompt,
        input: question,
        max_output_tokens: 700,
      }),
    });
    if (!response.ok) throw new Error(`openai_http_${response.status}`);
    const body = await response.json<any>();
    if (typeof body.output_text === "string") return body.output_text;
    const pieces = (body.output ?? []).flatMap((item: any) => item.content ?? [])
      .map((part: any) => part.text ?? part.output_text ?? "")
      .filter(Boolean);
    return pieces.join("\n");
  }

  if (provider === "anthropic") {
    const response = await fetchWithTimeout(`${defaultBaseUrl(provider)}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system: systemPrompt,
        messages: [{ role: "user", content: question }],
      }),
    });
    if (!response.ok) throw new Error(`anthropic_http_${response.status}`);
    const body = await response.json<any>();
    return (body.content ?? []).map((part: any) => part.text ?? "").filter(Boolean).join("\n");
  }

  if (provider === "gemini") {
    const base = defaultBaseUrl(provider);
    const response = await fetchWithTimeout(
      `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: question }] }],
          generationConfig: { maxOutputTokens: 700, temperature: 0 },
        }),
      },
    );
    if (!response.ok) throw new Error(`gemini_http_${response.status}`);
    const body = await response.json<any>();
    return (body.candidates?.[0]?.content?.parts ?? [])
      .map((part: any) => part.text ?? "")
      .filter(Boolean)
      .join("\n");
  }

  let endpoint: string;
  if (provider === "nanogpt_subscription") {
    endpoint = "https://nano-gpt.com/api/subscription/v1/chat/completions";
  } else if (provider === "nanogpt_all") {
    endpoint = "https://nano-gpt.com/api/v1/chat/completions";
  } else {
    const base = provider === "custom"
      ? (baseUrl ?? "").trim().replace(/\/+$/, "")
      : defaultBaseUrl(provider);
    if (!base) throw new Error("base_url_missing");
    endpoint = `${base}/chat/completions`;
  }

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 700,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${provider}_http_${response.status}`);
  const body = await response.json<any>();
  return String(body.choices?.[0]?.message?.content ?? "");
}

async function runOne(
  env: AiRuntimeEnv,
  provider: string,
  model: string,
  persona: "male" | "female",
  language: Language,
  approvedContext: string,
  question: string,
): Promise<AgentDecision | null> {
  if (!env.DB || !env.AI_CONFIG_MASTER_KEY) return null;
  const credential = await loadCredential(env.DB, provider);
  if (!credential) return null;
  const apiKey = await decryptSecret(env.AI_CONFIG_MASTER_KEY, credential.encrypted_key, credential.key_iv);
  const systemPrompt = buildAgentSystemPrompt(persona, language, approvedContext);
  const raw = await providerText(provider, model, apiKey, credential.base_url, systemPrompt, question);
  return parseAgentDecision(raw.trim());
}

async function recovered(env: AiRuntimeEnv): Promise<void> {
  await notifyAiRecovered(env);
}

async function outage(env: AiRuntimeEnv, reason: string): Promise<GroundedAiResult> {
  await notifyAiOutage(env, reason);
  return { action: "handoff", answer: "", reason, source: "human" };
}

export async function runGroundedFaqAgent(
  env: AiRuntimeEnv,
  input: {
    persona: "male" | "female";
    language: Language;
    approvedContext: string;
    question: string;
  },
): Promise<GroundedAiResult> {
  try {
    const availability = await getAiAvailability(env);
    if (!availability.ready || !availability.primaryProvider || !availability.primaryModel) {
      return outage(env, `ai_unavailable:${availability.reason}`);
    }

    let primaryDecision: AgentDecision | null = null;
    try {
      primaryDecision = await runOne(
        env,
        availability.primaryProvider,
        availability.primaryModel,
        input.persona,
        input.language,
        input.approvedContext,
        input.question,
      );
    } catch {
      primaryDecision = null;
    }

    if (primaryDecision?.action === "answer" && primaryDecision.answer) {
      await recovered(env);
      return { ...primaryDecision, source: "primary" };
    }

    if (availability.fallbackProvider && availability.fallbackModel) {
      try {
        const fallbackDecision = await runOne(
          env,
          availability.fallbackProvider,
          availability.fallbackModel,
          input.persona,
          input.language,
          input.approvedContext,
          input.question,
        );
        if (fallbackDecision?.action === "answer" && fallbackDecision.answer) {
          await recovered(env);
          return { ...fallbackDecision, source: "fallback" };
        }
        if (fallbackDecision?.action === "handoff") {
          await recovered(env);
          return { ...fallbackDecision, source: "human" };
        }
      } catch {
        // Infrastructure failure falls through to the operational outage alert below.
      }
    }

    if (primaryDecision?.action === "handoff") {
      await recovered(env);
      return { ...primaryDecision, source: "human" };
    }

    return outage(env, "primary_and_fallback_failed");
  } catch {
    return outage(env, "ai_runtime_failure");
  }
}
