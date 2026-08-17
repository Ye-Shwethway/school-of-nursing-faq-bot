# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Development branch: `test`
Canonical branch: `main`

## Startup sequence
Read in this order before development:
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant docs/source referenced by those files

Treat the live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Branch contract
- Work on `test`.
- Do not implement directly on `main`.
- Validate on `test`.
- Merge to `main` only when the checkpoint is verified.
- Validation Worker: `school-of-nursing-faq-bot-test`.
- Production Worker after validated merge: `school-of-nursing-faq-bot`.

## Current checkpoint
**Foundation v0.1, Telegram MVP core, Owner/Sudo Admin authorization core, and Telegram-managed AI provider settings core are implemented on `test`. Cloudflare D1 initial schema is live/verified. Test Worker deployment still waits for the UTC-safe compatibility-date retry, and AI migration 0002 has not yet been applied to live D1.**

## Implemented repository surface
- `AGENTS.md`
- `ROADMAP.md`
- `NEW_CHAT_BOOTSTRAP.md`
- `docs/TELEGRAM_DESIGN_RULES.md`
- `docs/ARCHITECTURE.md`
- `docs/CLOUDFLARE_HANDOFF.md`
- `docs/FAQ_CONTENT_POLICY.md`
- `docs/AI_SETTINGS.md`
- `package.json`
- `tsconfig.json`
- `wrangler.jsonc`
- `migrations/0001_initial.sql`
- `migrations/0002_ai_settings.sql`
- `src/index.ts`
- `src/faq.ts`
- `src/admin.ts`
- `src/ai.ts`
- `src/ai_ping.ts`
- `deploy/worker.mjs` (STALE Foundation v0.1 artifact; do not deploy as current build)

## Telegram MVP core
- `/start` and `/language` language selector
- callback-query handling for `lang:my`, `lang:en`, `lang:zh`
- language preference persisted in D1 by immutable Telegram user ID
- 22 canonical FAQ records
- Burmese canonical source facts
- English and Simplified Chinese meaning-preserving translations
- deterministic per-language matching before AI
- canonical answer logging: `resolution=answered`, `matched_faq_key`, `answer_source=canonical_faq`
- unresolved logging: `resolution=pending`, `answer_source=unresolved`
- localized unresolved/human-review response

## Owner / Sudo Admin core
Authority is based on immutable numeric Telegram user ID only.

Implemented:
- Owner config from `BOT_OWNER_TELEGRAM_ID`
- D1-backed `sudo_admin` role lookup
- `/admin` / `/admin status`
- `/admin help`
- `/admins`
- Owner-only `/sudo grant <telegram_user_id>`
- Owner-only `/sudo revoke <telegram_user_id>`
- Owner cannot be revoked/downgraded through Sudo management
- role mutations stored in `admin_audit`
- admin commands are handled before normal FAQ/question logging

## AI provider settings core
Owner-only Telegram command:

`/ai`

Supported providers:
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- Custom OpenAI-compatible HTTPS endpoint

Implemented flow:
1. Owner selects provider.
2. For Custom provider, Owner supplies HTTPS base URL first.
3. Owner sends provider API key.
4. Worker encrypts the key with AES-256-GCM before D1 persistence.
5. Bot makes a best-effort attempt to delete the Telegram message that contained the plaintext key.
6. Owner taps **Fetch models**; models are retrieved from the provider API rather than hard-coded.
7. Model catalog is cached in D1 with short callback tokens.
8. Owner selects a model.
9. Owner runs explicit **Test Ping**; this performs a minimal real generation request appropriate to that provider.
10. Bind buttons are allowed only after a successful ping.
11. Save as Primary or Fallback.
12. Primary and fallback may use different providers.

Required Cloudflare secret:

`AI_CONFIG_MASTER_KEY`

Contract: base64 encoding of exactly 32 random bytes. Never commit it or store it in D1. Provider keys become unreadable if this master key is lost.

Migration `0002_ai_settings.sql` adds:
- `ai_provider_credentials`
- `ai_model_cache`
- `ai_model_tests`
- `ai_model_bindings`
- `admin_sessions`
- model-cache provider index

Current model ping paths:
- OpenAI: Responses API
- Anthropic: Messages API
- Gemini: `generateContent`
- OpenRouter/Groq/Mistral/Custom OpenAI-compatible: chat-completions style endpoint

AI settings remain Owner-only; Sudo Admin does not inherit API credential-management rights.

## Canonical FAQ source
Creator-provided document: `SCHOOL of Nursing FAQ.docx`.

It contains 22 FAQ items. Burmese facts are authoritative. EN/ZH are translation layers. See `docs/FAQ_CONTENT_POLICY.md`.

## Verified Cloudflare infrastructure
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- Binding: `DB`
- Live schema currently verified from migration 0001: `users`, `questions`, `admin_roles`, `admin_audit`
- verified indexes: `idx_questions_user_created`, `idx_questions_resolution_created`
- migration 0002 is repository-only and NOT yet applied live
- workers.dev account subdomain: `ye-shwethway13`
- no production Worker
- no test Worker yet
- no KV, Durable Objects, Queues; R2 not enabled

## Cloudflare upload attempt evidence
The first Foundation v0.1 upload was rejected before Worker creation with:

`10021: Can't set compatibility date in the future: 2026-08-18`

Cloudflare was still on UTC 2026-08-17. No infrastructure drift occurred.

Compatibility-date rule: use a UTC-safe date. Once accepted, keep it fixed until a deliberate compatibility upgrade.

## Important deployment-artifact state
`deploy/worker.mjs` belongs to the earlier Foundation v0.1 source and is now stale.

Current source imports `faq.ts`, `admin.ts`, `ai.ts`, and `ai_ping.ts`. **Do not deploy the old `deploy/worker.mjs` as the current application build.** Build/regenerate a current bundled Worker artifact before the next Cloudflare deployment attempt.

## Validation state
- GitHub read/write on `test`: verified.
- D1 migration 0001: live and verified.
- migration 0002: not applied live yet.
- full npm/type validation: pending because the GitHub-side execution container cannot directly check out the repository over external GitHub DNS, although local `tsc` exists.
- Telegram MVP runtime behavior: not yet live-validated.
- Owner/Sudo runtime behavior: not yet live-validated.
- AI encrypted credential/model fetch/ping/binding flow: not yet live-validated.
- do not merge to `main` yet.

## Security notes
- repository is public; never commit provider keys, Telegram secrets, Cloudflare credentials, or D1 exports
- provider keys are encrypted before D1 storage
- `AI_CONFIG_MASTER_KEY` exists only as a Cloudflare secret
- API keys are never echoed back through settings
- Telegram deletion of plaintext key messages is best-effort; credential setup should be performed in the private bot chat
- AI remains downstream of canonical FAQ matching and may not invent policy facts

## Current known gaps
- current build/type validation
- regenerate/build current deployable Worker artifact
- apply D1 migration 0002
- Cloudflare test Worker deployment/runtime checks
- Telegram bot token/webhook secret installation
- live language callback/persistence test
- live FAQ answer and unresolved logging test
- EN/ZH wording review
- live Owner/Sudo authorization tests
- admin unresolved-question/user lookup tooling
- live AI provider model-list tests
- live model Test Ping tests
- actual grounded AI fallback orchestration using primary + fallback model binding
- fallback/escalation semantics when provider/model calls fail

## Recommended next slice
Stabilize and validate the combined current source on `test`, prepare a current Worker build, then return to the Cloudflare MCP session. Apply `migrations/0002_ai_settings.sql`, deploy `school-of-nursing-faq-bot-test` with `DB` and `APP_ENV=test`, provision only the required test secrets (`AI_CONFIG_MASTER_KEY`, then Telegram/Owner secrets when ready), and validate foundation + FAQ + admin + AI settings behavior. Do not create/deploy the production Worker or merge to `main` until the test checkpoint is green.
