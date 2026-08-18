import { getAiAvailability } from "./ai_fail_safe";
import type { Language } from "./faq";

export type FaqAuthoringEnv = {
  DB?: D1Database;
  AI_CONFIG_MASTER_KEY?: string;
};

export type MultilingualFaqDraft = {
  question: Record<Language, string>;
  answer: Record<Language, string>;
};

export type FaqTranslationResult =
  | { ok: true; draft: MultilingualFaqDraft; source: "primary" | "fallback" }
  | { ok: false; reason: string };

type Credential = {
  encrypted_key: string;
  key_iv: string;
  base_url: string | null;
};

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

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function loadCredential(db: D1Database, provider: string): Promise<Credential | null> {
  return db.prepare(
    `SELECT encrypted_key, key_iv, base_url FROM ai_provider_credentials WHERE provider=?1`,
  ).bind(credentialProvider(provider)).first<Credential>();
}

async function providerText(
  provider: string,
  model: string,
  apiKey: string,
  baseUrl: string | null,
  systemPrompt: string,
  input: string,
): Promise<string> {
  if (provider === "openai") {
    const response = await fetchWithTimeout(`${defaultBaseUrl(provider)}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, instructions: systemPrompt, input, max_output_tokens: 1200 }),
    });
    if (!response.ok) throw new Error(`openai_http_${response.status}`);
    const body = await response.json<any>();
    if (typeof body.output_text === "string") return body.output_text;
    return (body.output ?? []).flatMap((item: any) => item.content ?? [])
      .map((part: any) => part.text ?? part.output_text ?? "").filter(Boolean).join("\n");
  }

  if (provider === "anthropic") {
    const response = await fetchWithTimeout(`${defaultBaseUrl(provider)}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({ model, max_tokens: 1200, system: systemPrompt, messages: [{ role: "user", content: input }] }),
    });
    if (!response.ok) throw new Error(`anthropic_http_${response.status}`);
    const body = await response.json<any>();
    return (body.content ?? []).map((part: any) => part.text ?? "").filter(Boolean).join("\n");
  }

  if (provider === "gemini") {
    const response = await fetchWithTimeout(
      `${defaultBaseUrl(provider)}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: input }] }],
          generationConfig: { maxOutputTokens: 1200, temperature: 0 },
        }),
      },
    );
    if (!response.ok) throw new Error(`gemini_http_${response.status}`);
    const body = await response.json<any>();
    return (body.candidates?.[0]?.content?.parts ?? []).map((part: any) => part.text ?? "").filter(Boolean).join("\n");
  }

  let endpoint: string;
  if (provider === "nanogpt_subscription") {
    endpoint = "https://nano-gpt.com/api/subscription/v1/chat/completions";
  } else if (provider === "nanogpt_all") {
    endpoint = "https://nano-gpt.com/api/v1/chat/completions";
  } else {
    const base = provider === "custom" ? (baseUrl ?? "").trim().replace(/\/+$/, "") : defaultBaseUrl(provider);
    if (!base) throw new Error("base_url_missing");
    endpoint = `${base}/chat/completions`;
  }

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 1200,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: input },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${provider}_http_${response.status}`);
  const body = await response.json<any>();
  return String(body.choices?.[0]?.message?.content ?? "");
}

function parseDraft(raw: string, sourceLanguage: Language, sourceQuestion: string, sourceAnswer: string): MultilingualFaqDraft | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(cleaned.slice(start, end + 1)) as any;
    const question = {
      my: String(value?.my?.question ?? "").trim(),
      en: String(value?.en?.question ?? "").trim(),
      zh: String(value?.zh?.question ?? "").trim(),
    };
    const answer = {
      my: String(value?.my?.answer ?? "").trim(),
      en: String(value?.en?.answer ?? "").trim(),
      zh: String(value?.zh?.answer ?? "").trim(),
    };
    question[sourceLanguage] = sourceQuestion.trim();
    answer[sourceLanguage] = sourceAnswer.trim();
    if (!question.my || !question.en || !question.zh || !answer.my || !answer.en || !answer.zh) return null;
    return { question, answer };
  } catch {
    return null;
  }
}

async function runProvider(
  env: FaqAuthoringEnv,
  provider: string,
  model: string,
  sourceLanguage: Language,
  question: string,
  answer: string,
): Promise<MultilingualFaqDraft | null> {
  if (!env.DB || !env.AI_CONFIG_MASTER_KEY) return null;
  const credential = await loadCredential(env.DB, provider);
  if (!credential) return null;
  const apiKey = await decryptSecret(env.AI_CONFIG_MASTER_KEY, credential.encrypted_key, credential.key_iv);
  const systemPrompt = [
    "You are a translation assistant for an official university School of Nursing FAQ editor.",
    "Translate the supplied question and answer into Burmese (my), English (en), and Simplified Chinese (zh).",
    "The supplied source-language text is authoritative. Preserve its meaning exactly.",
    "Do not add, remove, infer, improve, or invent policy facts, dates, fees, eligibility rules, accreditation claims, contacts, URLs, scholarship/loan/bond terms, or promises.",
    "Preserve numbers, proper names, official terms, and URLs accurately.",
    "Use natural professional language, but do not change the substance.",
    "Return JSON only in exactly this shape: {\"my\":{\"question\":\"...\",\"answer\":\"...\"},\"en\":{\"question\":\"...\",\"answer\":\"...\"},\"zh\":{\"question\":\"...\",\"answer\":\"...\"}}",
  ].join("\n");
  const input = `Source language: ${sourceLanguage}\nQuestion: ${question}\nAnswer: ${answer}`;
  const raw = await providerText(provider, model, apiKey, credential.base_url, systemPrompt, input);
  return parseDraft(raw, sourceLanguage, question, answer);
}

export async function generateFaqTranslations(
  env: FaqAuthoringEnv,
  input: { sourceLanguage: Language; question: string; answer: string },
): Promise<FaqTranslationResult> {
  try {
    const availability = await getAiAvailability(env);
    if (!availability.ready || !availability.primaryProvider || !availability.primaryModel) {
      return { ok: false, reason: `AI unavailable: ${availability.reason}` };
    }

    try {
      const primary = await runProvider(
        env,
        availability.primaryProvider,
        availability.primaryModel,
        input.sourceLanguage,
        input.question,
        input.answer,
      );
      if (primary) return { ok: true, draft: primary, source: "primary" };
    } catch {
      // Try fallback below.
    }

    if (availability.fallbackProvider && availability.fallbackModel) {
      try {
        const fallback = await runProvider(
          env,
          availability.fallbackProvider,
          availability.fallbackModel,
          input.sourceLanguage,
          input.question,
          input.answer,
        );
        if (fallback) return { ok: true, draft: fallback, source: "fallback" };
      } catch {
        // Manual authoring remains available.
      }
    }

    return { ok: false, reason: "Primary and fallback AI could not generate a valid multilingual draft." };
  } catch {
    return { ok: false, reason: "AI translation is temporarily unavailable." };
  }
}
