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
Provider registry:

- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- NanoGPT — Subscription only
- NanoGPT — Subscription + Paid (all visible)
- Custom OpenAI-compatible HTTPS endpoint

Model catalogs are fetched from provider APIs rather than hard-coding model IDs.

## NanoGPT catalog modes
NanoGPT uses one saved encrypted API credential with two selectable catalog/routing modes.

### Subscription only
Telegram label:

`NanoGPT — Subscription only`

Model list endpoint:

`GET https://nano-gpt.com/api/subscription/v1/models?detailed=true`

Test Ping endpoint:

`POST https://nano-gpt.com/api/subscription/v1/chat/completions`

This mode is intended to remain within NanoGPT subscription-included text models.

### Subscription + Paid (all)
Telegram label:

`NanoGPT — Subscription + Paid (all)`

Model list endpoint:

`GET https://nano-gpt.com/api/v1/models?detailed=true`

Test Ping endpoint:

`POST https://nano-gpt.com/api/v1/chat/completions`

The canonical NanoGPT catalog respects the account's model-visibility settings. When the NanoGPT account is configured to also show paid models, this mode exposes the combined subscription + paid catalog.

The two NanoGPT modes use distinct model-cache/provider IDs (`nanogpt_subscription` and `nanogpt_all`) so a bound model preserves the selected billing/catalog route, while the encrypted credential itself is shared under one `nanogpt` credential record.

## Telegram flow
Entry command:

`/ai`

Flow:

1. Owner opens AI Agent Settings.
2. Select provider/catalog mode.
3. Send API key in the private bot chat when no reusable credential exists.
4. Worker encrypts the key before D1 storage.
5. Bot attempts to delete the Telegram message containing the plaintext key.
6. Owner selects **Fetch models**.
7. Models are fetched and cached in D1 with short callback tokens.
8. Owner selects a model.
9. Owner runs **Test Ping** against that exact provider/mode/model.
10. Only after Test Ping PASS may the Owner choose **Save as Primary** or **Save as Fallback**.
11. `/ai` → Current binding shows the active configuration.

Primary and fallback may use different providers or NanoGPT modes.

## Custom provider flow
For `Custom OpenAI-compatible`:

1. Owner selects Custom provider.
2. Send an HTTPS base URL such as `https://example.com/v1`.
3. Send API key.
4. The Worker calls `<base-url>/models` using Bearer authentication.
5. Selected models are pinged through `<base-url>/chat/completions`.

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
- `ai_model_tests`
- `ai_model_bindings`
- `admin_sessions`

Model binding key used by the FAQ agent:

`faq_agent`

## Validation semantics
`Fetch models` validates credential/catalog access and refreshes the model cache.

`Test Ping` performs a minimal generation request against the exact selected model. A model cannot be saved as Primary or Fallback until that model has a successful ping record.

NanoGPT ping routing follows the selected mode: subscription-only bindings use the subscription chat endpoint; all-mode bindings use the canonical chat endpoint.

## Safety
- Never echo saved API keys back to Telegram.
- Never include provider keys in logs, GitHub, Cloudflare reports, or D1 exports.
- Provider error responses shown to the Owner are truncated.
- AI is downstream of deterministic canonical FAQ matching.
- Policy-sensitive facts remain grounded in approved FAQ content; model binding does not authorize free-form invention.
