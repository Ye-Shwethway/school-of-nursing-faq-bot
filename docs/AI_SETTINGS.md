# Telegram AI Provider Settings

Last updated: 2026-08-18

## Goal
Allow the Bot Owner to configure the FAQ agent's AI provider from Telegram without committing provider API keys to GitHub or storing plaintext keys in D1.

## Authority
AI provider credentials and model bindings are Bot Owner settings.

- Authority key: immutable numeric Telegram user ID from `BOT_OWNER_TELEGRAM_ID`.
- Sudo Admins do not receive API credential-management rights.
- Usernames are metadata only and are never authority.

## Supported providers
Initial provider registry:

- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- Custom OpenAI-compatible HTTPS endpoint

Model catalogs are fetched from each provider's models API rather than hard-coding model IDs.

## Telegram flow
Entry command:

`/ai`

Flow:

1. Owner opens AI Agent Settings.
2. Select provider.
3. Send API key in the private bot chat.
4. Worker encrypts the key before D1 storage.
5. Bot attempts to delete the Telegram message containing the plaintext key.
6. Owner selects **Fetch models**.
7. A successful model-list request acts as the first connection/authentication test.
8. Models are cached in D1 with short callback tokens.
9. Owner selects a model.
10. Bind as **Primary** or **Fallback**.
11. `/ai` → Current binding shows the active configuration.

Primary and fallback may use different providers.

## Custom provider flow
For `Custom OpenAI-compatible`:

1. Owner selects Custom provider.
2. Send an HTTPS base URL such as `https://example.com/v1`.
3. Send API key.
4. The Worker calls `<base-url>/models` using Bearer authentication.

Only HTTPS base URLs are accepted by the current setup flow.

## Encryption
Provider keys are encrypted with AES-256-GCM before D1 storage.

Required Cloudflare secret:

`AI_CONFIG_MASTER_KEY`

Contract:

- value must be base64 for exactly 32 random bytes
- never commit this value to GitHub
- never store this master key in D1
- loss of the master key makes existing encrypted provider credentials unreadable
- rotating it requires a controlled credential re-entry/re-encryption process

D1 stores only:

- encrypted ciphertext
- AES-GCM IV
- provider ID
- optional custom base URL
- updater Telegram ID
- timestamps/test status

## D1 schema
Migration: `migrations/0002_ai_settings.sql`

Tables:

- `ai_provider_credentials`
- `ai_model_cache`
- `ai_model_bindings`
- `admin_sessions`

Model binding key used by the FAQ agent:

`faq_agent`

## Current test semantics
`Fetch models` performs a real authenticated provider request and updates `last_test_ok` / `last_tested_at`.

This is currently the connection/authentication test. A separate generation-level model ping can be added after the provider abstraction and AI fallback runtime are stabilized.

## Safety
- Never echo saved API keys back to Telegram.
- Never include provider keys in logs, GitHub, Cloudflare reports, or D1 exports.
- Provider error responses shown to the Owner are truncated.
- AI is downstream of deterministic canonical FAQ matching.
- Policy-sensitive facts remain grounded in approved FAQ content; model binding does not authorize free-form invention.
