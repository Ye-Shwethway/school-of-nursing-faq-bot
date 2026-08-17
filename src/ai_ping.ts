type AiPingEnv = {
  DB?: D1Database;
  AI_CONFIG_MASTER_KEY?: string;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getCryptoKey(masterKey: string): Promise<CryptoKey> {
  const raw = base64ToBytes(masterKey);
  if (raw.byteLength !== 32) throw new Error("AI_CONFIG_MASTER_KEY must be base64 for exactly 32 bytes");
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
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

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

function providerBaseUrl(provider: string, customBaseUrl?: string | null): string {
  switch (provider) {
    case "openai": return "https://api.openai.com/v1";
    case "anthropic": return "https://api.anthropic.com/v1";
    case "gemini": return "https://generativelanguage.googleapis.com/v1beta";
    case "openrouter": return "https://openrouter.ai/api/v1";
    case "groq": return "https://api.groq.com/openai/v1";
    case "mistral": return "https://api.mistral.ai/v1";
    case "custom": return normalizeBaseUrl(customBaseUrl ?? "");
    default: return "";
  }
}

async function modelPing(provider: string, modelId: string, apiKey: string, customBaseUrl?: string | null): Promise<void> {
  const baseUrl = providerBaseUrl(provider, customBaseUrl);
  if (!baseUrl) throw new Error("Provider base URL is unavailable");

  let url: string;
  let headers: Record<string, string> = { "content-type": "application/json" };
  let body: unknown;

  if (provider === "openai") {
    url = `${baseUrl}/responses`;
    headers.authorization = `Bearer ${apiKey}`;
    body = { model: modelId, input: "Reply only with OK.", max_output_tokens: 8, store: false };
  } else if (provider === "anthropic") {
    url = `${baseUrl}/messages`;
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    body = { model: modelId, max_tokens: 8, messages: [{ role: "user", content: "Reply only with OK." }] };
  } else if (provider === "gemini") {
    url = `${baseUrl}/models/${encodeURIComponent(modelId)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    body = { contents: [{ parts: [{ text: "Reply only with OK." }] }], generationConfig: { maxOutputTokens: 8 } };
  } else {
    url = `${baseUrl}/chat/completions`;
    headers.authorization = `Bearer ${apiKey}`;
    body = { model: modelId, messages: [{ role: "user", content: "Reply only with OK." }], max_tokens: 8 };
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 180)}`);
  }
}

export async function chooseModelForPing(
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
     ON CONFLICT(telegram_user_id) DO UPDATE SET
       state='awaiting_ai_binding_choice', provider=excluded.provider, payload=excluded.payload, updated_at=CURRENT_TIMESTAMP`,
  ).bind(ownerId, providerId, row.model_id).run();

  return {
    text: `Selected: ${row.display_name ?? row.model_id}\nRun Test Ping before binding this model.`,
    keyboard: {
      inline_keyboard: [
        [{ text: "Test Ping", callback_data: "ai:ping" }],
        [{ text: "Back", callback_data: `ai:fetch:${providerId}` }],
      ],
    },
  };
}

export async function testSelectedModel(
  env: AiPingEnv,
  ownerId: number,
): Promise<{ text: string; keyboard?: unknown }> {
  if (!env.DB) return { text: "D1 is not bound." };
  if (!env.AI_CONFIG_MASTER_KEY) return { text: "AI_CONFIG_MASTER_KEY is not configured." };

  const session = await env.DB.prepare(
    `SELECT provider, payload FROM admin_sessions
     WHERE telegram_user_id=?1 AND state='awaiting_ai_binding_choice'`,
  ).bind(ownerId).first<{ provider: string | null; payload: string | null }>();

  if (!session?.provider || !session.payload) return { text: "No model is selected for ping." };

  const credential = await env.DB.prepare(
    `SELECT encrypted_key, key_iv, base_url FROM ai_provider_credentials WHERE provider=?1`,
  ).bind(session.provider).first<{ encrypted_key: string; key_iv: string; base_url: string | null }>();

  if (!credential) return { text: "Provider credential is missing." };

  try {
    const apiKey = await decryptSecret(env.AI_CONFIG_MASTER_KEY, credential.encrypted_key, credential.key_iv);
    await modelPing(session.provider, session.payload, apiKey, credential.base_url);

    await env.DB.prepare(
      `INSERT INTO ai_model_tests (provider, model_id, tested_by, tested_at, ok)
       VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP, 1)
       ON CONFLICT(provider, model_id) DO UPDATE SET tested_by=excluded.tested_by, tested_at=CURRENT_TIMESTAMP, ok=1`,
    ).bind(session.provider, session.payload, ownerId).run();

    return {
      text: `Test Ping PASS\n${session.provider} / ${session.payload}\nChoose where to bind it.`,
      keyboard: {
        inline_keyboard: [[
          { text: "Save as Primary", callback_data: "ai:bind:primary" },
          { text: "Save as Fallback", callback_data: "ai:bind:fallback" },
        ], [{ text: "Cancel", callback_data: "ai:menu" }]],
      },
    };
  } catch (error) {
    await env.DB.prepare(
      `INSERT INTO ai_model_tests (provider, model_id, tested_by, tested_at, ok)
       VALUES (?1, ?2, ?3, CURRENT_TIMESTAMP, 0)
       ON CONFLICT(provider, model_id) DO UPDATE SET tested_by=excluded.tested_by, tested_at=CURRENT_TIMESTAMP, ok=0`,
    ).bind(session.provider, session.payload, ownerId).run();

    return {
      text: `Test Ping FAILED\n${session.provider} / ${session.payload}\n${error instanceof Error ? error.message : "Unknown error"}`,
      keyboard: { inline_keyboard: [[{ text: "Retry Ping", callback_data: "ai:ping" }], [{ text: "Back", callback_data: "ai:menu" }]] },
    };
  }
}

export async function selectedModelPassedPing(db: D1Database | undefined, ownerId: number): Promise<boolean> {
  if (!db) return false;
  const session = await db.prepare(
    `SELECT provider, payload FROM admin_sessions
     WHERE telegram_user_id=?1 AND state='awaiting_ai_binding_choice'`,
  ).bind(ownerId).first<{ provider: string | null; payload: string | null }>();
  if (!session?.provider || !session.payload) return false;

  const test = await db.prepare(
    `SELECT ok FROM ai_model_tests WHERE provider=?1 AND model_id=?2`,
  ).bind(session.provider, session.payload).first<{ ok: number }>();
  return test?.ok === 1;
}
