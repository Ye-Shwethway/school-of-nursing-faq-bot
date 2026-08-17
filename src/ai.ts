export type AiEnv = {
  DB?: D1Database;
  AI_CONFIG_MASTER_KEY?: string;
};

type ProviderId =
  | "openai"
  | "anthropic"
  | "gemini"
  | "openrouter"
  | "groq"
  | "mistral"
  | "nanogpt_subscription"
  | "nanogpt_all"
  | "custom";

type ProviderSpec = {
  id: ProviderId;
  label: string;
  defaultBaseUrl: string;
};

export const AI_PROVIDERS: ProviderSpec[] = [
  { id: "openai", label: "OpenAI", defaultBaseUrl: "https://api.openai.com/v1" },
  { id: "anthropic", label: "Anthropic", defaultBaseUrl: "https://api.anthropic.com/v1" },
  { id: "gemini", label: "Google Gemini", defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta" },
  { id: "openrouter", label: "OpenRouter", defaultBaseUrl: "https://openrouter.ai/api/v1" },
  { id: "groq", label: "Groq", defaultBaseUrl: "https://api.groq.com/openai/v1" },
  { id: "mistral", label: "Mistral", defaultBaseUrl: "https://api.mistral.ai/v1" },
  { id: "nanogpt_subscription", label: "NanoGPT — Subscription only", defaultBaseUrl: "https://nano-gpt.com/api" },
  { id: "nanogpt_all", label: "NanoGPT — Subscription + Paid (all)", defaultBaseUrl: "https://nano-gpt.com/api" },
  { id: "custom", label: "Custom OpenAI-compatible", defaultBaseUrl: "" },
];

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

async function getCryptoKey(masterKey: string): Promise<CryptoKey> {
  const raw = base64ToBytes(masterKey);
  if (raw.byteLength !== 32) {
    throw new Error("AI_CONFIG_MASTER_KEY must be base64 for exactly 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptSecret(masterKey: string, plaintext: string): Promise<{ encrypted: string; iv: string }> {
  const key = await getCryptoKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(plaintext));
  return { encrypted: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv) };
}

async function decryptSecret(masterKey: string, encrypted: string, iv: string): Promise<string> {
  const key = await getCryptoKey(masterKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(iv) },
    key,
    base64ToBytes(encrypted),
  );
  return decoder.decode(plaintext);
}

async function shortToken(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
  return bytesToBase64(digest.slice(0, 9)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function providerSpec(id: string): ProviderSpec | null {
  return AI_PROVIDERS.find((provider) => provider.id === id) ?? null;
}

function credentialProviderId(providerId: string): string {
  if (providerId === "nanogpt_subscription" || providerId === "nanogpt_all") return "nanogpt";
  return providerId;
}

async function loadCredential(db: D1Database, provider: string) {
  return db.prepare(
    `SELECT provider, encrypted_key, key_iv, base_url, last_tested_at, last_test_ok
     FROM ai_provider_credentials WHERE provider = ?1`,
  ).bind(credentialProviderId(provider)).first<{
    provider: string;
    encrypted_key: string;
    key_iv: string;
    base_url: string | null;
    last_tested_at: string | null;
    last_test_ok: number | null;
  }>();
}

async function fetchModels(
  provider: ProviderSpec,
  apiKey: string,
  customBaseUrl?: string | null,
): Promise<Array<{ id: string; name: string }>> {
  const headers: Record<string, string> = { accept: "application/json" };
  let url: string;

  if (provider.id === "nanogpt_subscription") {
    url = "https://nano-gpt.com/api/subscription/v1/models?detailed=true";
    headers.authorization = `Bearer ${apiKey}`;
  } else if (provider.id === "nanogpt_all") {
    url = "https://nano-gpt.com/api/v1/models?detailed=true";
    headers.authorization = `Bearer ${apiKey}`;
  } else {
    const baseUrl = provider.id === "custom"
      ? normalizeBaseUrl(customBaseUrl ?? "")
      : provider.defaultBaseUrl;
    if (!baseUrl) throw new Error("Custom provider base URL is not configured");

    url = `${baseUrl}/models`;
    if (provider.id === "gemini") {
      url = `${baseUrl}/models?key=${encodeURIComponent(apiKey)}`;
    } else if (provider.id === "anthropic") {
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
    } else {
      headers.authorization = `Bearer ${apiKey}`;
    }
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Provider returned HTTP ${response.status}: ${text.slice(0, 180)}`);
  }

  const body = await response.json<any>();

  if (provider.id === "gemini") {
    return (body.models ?? [])
      .filter((model: any) => !Array.isArray(model.supportedGenerationMethods) || model.supportedGenerationMethods.includes("generateContent"))
      .map((model: any) => ({
        id: String(model.baseModelId ?? model.name ?? "").replace(/^models\//, ""),
        name: String(model.displayName ?? model.baseModelId ?? model.name ?? ""),
      }))
      .filter((model: { id: string }) => model.id);
  }

  const models = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];
  return models
    .map((model: any) => ({
      id: String(model.id ?? ""),
      name: String(model.name ?? model.display_name ?? model.id ?? ""),
    }))
    .filter((model: { id: string }) => model.id);
}

async function replaceModelCache(db: D1Database, provider: string, models: Array<{ id: string; name: string }>) {
  await db.prepare(`DELETE FROM ai_model_cache WHERE provider = ?1`).bind(provider).run();
  for (const model of models.slice(0, 250)) {
    const token = await shortToken(`${provider}:${model.id}`);
    await db.prepare(
      `INSERT INTO ai_model_cache (provider, token, model_id, display_name, fetched_at)
       VALUES (?1, ?2, ?3, ?4, CURRENT_TIMESTAMP)`,
    ).bind(provider, token, model.id, model.name || model.id).run();
  }
}

export function aiSettingsKeyboard() {
  return {
    inline_keyboard: [
      ...AI_PROVIDERS.map((provider) => [{ text: provider.label, callback_data: `ai:provider:${provider.id}` }]),
      [{ text: "Current binding", callback_data: "ai:status" }],
    ],
  };
}

export async function aiStatus(db: D1Database | undefined): Promise<string> {
  if (!db) return "AI settings are unavailable because D1 is not bound.";
  const binding = await db.prepare(
    `SELECT primary_provider, primary_model, fallback_provider, fallback_model, updated_at
     FROM ai_model_bindings WHERE binding_key = 'faq_agent'`,
  ).first<{
    primary_provider: string | null;
    primary_model: string | null;
    fallback_provider: string | null;
    fallback_model: string | null;
    updated_at: string;
  }>();

  if (!binding) return "AI agent is not bound yet.";
  return [
    "AI agent binding",
    `Primary: ${binding.primary_provider ?? "—"} / ${binding.primary_model ?? "—"}`,
    `Fallback: ${binding.fallback_provider ?? "—"} / ${binding.fallback_model ?? "—"}`,
    `Updated: ${binding.updated_at}`,
  ].join("\n");
}

export async function startProviderSetup(
  db: D1Database | undefined,
  ownerId: number,
  providerId: string,
): Promise<{ text: string; keyboard?: unknown }> {
  if (!db) return { text: "D1 is not bound." };
  const provider = providerSpec(providerId);
  if (!provider) return { text: "Unknown provider." };

  if (provider.id === "custom") {
    await db.prepare(
      `INSERT INTO admin_sessions (telegram_user_id, state, provider, updated_at)
       VALUES (?1, 'awaiting_ai_base_url', ?2, CURRENT_TIMESTAMP)
       ON CONFLICT(telegram_user_id) DO UPDATE SET state='awaiting_ai_base_url', provider=excluded.provider, payload=NULL, updated_at=CURRENT_TIMESTAMP`,
    ).bind(ownerId, provider.id).run();
    return { text: "Send the Custom OpenAI-compatible base URL (for example https://example.com/v1)." };
  }

  if (provider.id === "nanogpt_subscription" || provider.id === "nanogpt_all") {
    const existing = await loadCredential(db, provider.id);
    if (existing) {
      return {
        text: `${provider.label}\nNanoGPT key is already saved. Reuse it or replace it by sending a new key after selecting this provider again from a fresh /ai setup if needed.`,
        keyboard: {
          inline_keyboard: [
            [{ text: "Fetch models", callback_data: `ai:fetch:${provider.id}` }],
            [{ text: "Back", callback_data: "ai:menu" }],
          ],
        },
      };
    }
  }

  await db.prepare(
    `INSERT INTO admin_sessions (telegram_user_id, state, provider, updated_at)
     VALUES (?1, 'awaiting_ai_key', ?2, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET state='awaiting_ai_key', provider=excluded.provider, payload=NULL, updated_at=CURRENT_TIMESTAMP`,
  ).bind(ownerId, provider.id).run();
  return { text: `Send the ${provider.label} API key. It will be encrypted before storage.` };
}

export async function consumeAiSetupText(
  env: AiEnv,
  ownerId: number,
  text: string,
): Promise<{ handled: boolean; secretInput?: boolean; text?: string; keyboard?: unknown }> {
  if (!env.DB) return { handled: false };
  const session = await env.DB.prepare(
    `SELECT state, provider, payload FROM admin_sessions WHERE telegram_user_id = ?1`,
  ).bind(ownerId).first<{ state: string; provider: string | null; payload: string | null }>();
  if (!session || !session.state.startsWith("awaiting_ai_")) return { handled: false };

  const provider = providerSpec(session.provider ?? "");
  if (!provider) return { handled: true, text: "Provider setup state is invalid. Start again with /ai." };

  if (session.state === "awaiting_ai_base_url") {
    const baseUrl = normalizeBaseUrl(text);
    if (!/^https:\/\//i.test(baseUrl)) return { handled: true, text: "Base URL must start with https://" };
    await env.DB.prepare(
      `UPDATE admin_sessions SET state='awaiting_ai_key', payload=?2, updated_at=CURRENT_TIMESTAMP WHERE telegram_user_id=?1`,
    ).bind(ownerId, baseUrl).run();
    return { handled: true, text: "Base URL saved for this setup. Now send the API key; it will be encrypted before storage." };
  }

  if (session.state === "awaiting_ai_key") {
    if (!env.AI_CONFIG_MASTER_KEY) {
      return { handled: true, secretInput: true, text: "AI_CONFIG_MASTER_KEY is not configured in Cloudflare secrets, so the API key was not stored." };
    }
    const apiKey = text.trim();
    if (apiKey.length < 8) return { handled: true, secretInput: true, text: "That API key looks too short. Please try again." };
    const encrypted = await encryptSecret(env.AI_CONFIG_MASTER_KEY, apiKey);
    const baseUrl = provider.id === "custom" ? session.payload : null;
    const credentialId = credentialProviderId(provider.id);

    await env.DB.prepare(
      `INSERT INTO ai_provider_credentials
        (provider, encrypted_key, key_iv, base_url, updated_by, updated_at, last_tested_at, last_test_ok)
       VALUES (?1, ?2, ?3, ?4, ?5, CURRENT_TIMESTAMP, NULL, NULL)
       ON CONFLICT(provider) DO UPDATE SET
         encrypted_key=excluded.encrypted_key,
         key_iv=excluded.key_iv,
         base_url=excluded.base_url,
         updated_by=excluded.updated_by,
         updated_at=CURRENT_TIMESTAMP,
         last_tested_at=NULL,
         last_test_ok=NULL`,
    ).bind(credentialId, encrypted.encrypted, encrypted.iv, baseUrl, ownerId).run();

    await env.DB.prepare(`DELETE FROM admin_sessions WHERE telegram_user_id=?1`).bind(ownerId).run();
    return {
      handled: true,
      secretInput: true,
      text: `${provider.label} key encrypted and saved. Choose Fetch models to validate the key and load available models.`,
      keyboard: {
        inline_keyboard: [
          [{ text: "Fetch models", callback_data: `ai:fetch:${provider.id}` }],
          [{ text: "Back", callback_data: "ai:menu" }],
        ],
      },
    };
  }

  return { handled: false };
}

export async function fetchProviderModels(
  env: AiEnv,
  ownerId: number,
  providerId: string,
): Promise<{ text: string; keyboard?: unknown }> {
  if (!env.DB) return { text: "D1 is not bound." };
  if (!env.AI_CONFIG_MASTER_KEY) return { text: "AI_CONFIG_MASTER_KEY is not configured." };
  const provider = providerSpec(providerId);
  if (!provider) return { text: "Unknown provider." };
  const credential = await loadCredential(env.DB, provider.id);
  if (!credential) return { text: `${provider.label} has no saved key.` };

  try {
    const apiKey = await decryptSecret(env.AI_CONFIG_MASTER_KEY, credential.encrypted_key, credential.key_iv);
    const models = await fetchModels(provider, apiKey, credential.base_url);
    await replaceModelCache(env.DB, provider.id, models);
    await env.DB.prepare(
      `UPDATE ai_provider_credentials SET last_tested_at=CURRENT_TIMESTAMP, last_test_ok=1 WHERE provider=?1`,
    ).bind(credentialProviderId(provider.id)).run();

    const rows = await env.DB.prepare(
      `SELECT token, model_id, display_name FROM ai_model_cache WHERE provider=?1 ORDER BY display_name LIMIT 12`,
    ).bind(provider.id).all<{ token: string; model_id: string; display_name: string | null }>();

    const keyboard = {
      inline_keyboard: [
        ...(rows.results ?? []).map((row) => [{
          text: (row.display_name ?? row.model_id).slice(0, 48),
          callback_data: `ai:model:${provider.id}:${row.token}`,
        }]),
        [{ text: "Refresh", callback_data: `ai:fetch:${provider.id}` }, { text: "Back", callback_data: "ai:menu" }],
      ],
    };
    return {
      text: `${provider.label} connection OK. Fetched ${models.length} model(s). Select a model, then run Test Ping before binding.`,
      keyboard,
    };
  } catch (error) {
    await env.DB.prepare(
      `UPDATE ai_provider_credentials SET last_tested_at=CURRENT_TIMESTAMP, last_test_ok=0 WHERE provider=?1`,
    ).bind(credentialProviderId(provider.id)).run();
    return { text: `${provider.label} test failed: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

export async function chooseModel(
  db: D1Database | undefined,
  ownerId: number,
  providerId: string,
  token: string,
): Promise<{ text: string; keyboard?: unknown }> {
  if (!db) return { text: "D1 is not bound." };
  const row = await db.prepare(
    `SELECT model_id, display_name FROM ai_model_cache WHERE provider=?1 AND token=?2`,
  ).bind(providerId, token).first<{ model_id: string; display_name: string | null }>();
  if (!row) return { text: "That cached model is no longer available. Fetch models again." };

  await db.prepare(
    `INSERT INTO admin_sessions (telegram_user_id, state, provider, payload, updated_at)
     VALUES (?1, 'awaiting_ai_binding_choice', ?2, ?3, CURRENT_TIMESTAMP)
     ON CONFLICT(telegram_user_id) DO UPDATE SET state='awaiting_ai_binding_choice', provider=excluded.provider, payload=excluded.payload, updated_at=CURRENT_TIMESTAMP`,
  ).bind(ownerId, providerId, row.model_id).run();

  return {
    text: `Selected: ${row.display_name ?? row.model_id}\nBind it as primary or fallback?`,
    keyboard: {
      inline_keyboard: [[
        { text: "Primary", callback_data: "ai:bind:primary" },
        { text: "Fallback", callback_data: "ai:bind:fallback" },
      ], [{ text: "Cancel", callback_data: "ai:menu" }]],
    },
  };
}

export async function bindSelectedModel(
  db: D1Database | undefined,
  ownerId: number,
  role: "primary" | "fallback",
): Promise<string> {
  if (!db) return "D1 is not bound.";
  const session = await db.prepare(
    `SELECT provider, payload FROM admin_sessions WHERE telegram_user_id=?1 AND state='awaiting_ai_binding_choice'`,
  ).bind(ownerId).first<{ provider: string | null; payload: string | null }>();
  if (!session?.provider || !session.payload) return "No model is awaiting binding.";

  if (role === "primary") {
    await db.prepare(
      `INSERT INTO ai_model_bindings (binding_key, primary_provider, primary_model, updated_by, updated_at)
       VALUES ('faq_agent', ?1, ?2, ?3, CURRENT_TIMESTAMP)
       ON CONFLICT(binding_key) DO UPDATE SET primary_provider=excluded.primary_provider, primary_model=excluded.primary_model, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`,
    ).bind(session.provider, session.payload, ownerId).run();
  } else {
    await db.prepare(
      `INSERT INTO ai_model_bindings (binding_key, fallback_provider, fallback_model, updated_by, updated_at)
       VALUES ('faq_agent', ?1, ?2, ?3, CURRENT_TIMESTAMP)
       ON CONFLICT(binding_key) DO UPDATE SET fallback_provider=excluded.fallback_provider, fallback_model=excluded.fallback_model, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`,
    ).bind(session.provider, session.payload, ownerId).run();
  }

  await db.prepare(`DELETE FROM admin_sessions WHERE telegram_user_id=?1`).bind(ownerId).run();
  return `${role === "primary" ? "Primary" : "Fallback"} model bound: ${session.provider} / ${session.payload}`;
}
