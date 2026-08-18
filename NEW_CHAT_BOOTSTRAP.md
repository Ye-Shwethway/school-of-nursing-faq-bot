# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence
Read in order:
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. task-relevant source/docs only

Treat live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Current checkpoint
Production infrastructure, operational data, Telegram webhook, Owner identity binding and Owner command registry are working under the simplified main-only production model. The current active issue is production AI-provider setup: submitting a Gemini API key previously appeared to stall because malformed `AI_CONFIG_MASTER_KEY` input can throw during encryption.

## Main-only operating model
- `main` is the only active development/canonical/production branch.
- historical `test` is dormant/reference-only.
- TEST deploy/build workflows are retired.
- completed one-time bootstrap/cutover/resync workflows are retired from the live tree.
- `.github/workflows/deploy-production.yml` is the single active workflow.

Relevant `main` pushes automatically validate and deploy production.

## AI master-key contract and recovery
`AI_CONFIG_MASTER_KEY` must be a Cloudflare `secret_text` containing Base64 for exactly 32 random bytes. It is imported directly as the AES-GCM key used to encrypt/decrypt provider API credentials stored in D1.

A fresh master key is valid, but credentials encrypted with an older key cannot be decrypted with the new one and must be entered again through `/ai`.

`src/secure_entry.ts` now catches exceptions from AI credential setup. If encryption/configuration fails, the submitted API-key message is best-effort deleted and the Owner receives an explicit configuration error instead of the webhook path silently stopping.

## Single production pipeline
The production workflow performs:
- production credential/runtime-binding preflight
- install
- typecheck
- isolated production config generation
- local migration validation
- production Worker dry-run
- production D1 migrations
- Worker deploy with `APP_ENV=production` and current revision
- runtime-binding postflight
- production health verification
- one-time Owner command resync
- exact Telegram read-back of all 12 Owner commands

Required production runtime bindings include:
- `DB` (`d1`)
- `TELEGRAM_BOT_TOKEN` (`secret_text`)
- `TELEGRAM_WEBHOOK_SECRET` (`secret_text`)
- `AI_CONFIG_MASTER_KEY` (`secret_text`)
- `BOT_OWNER_TELEGRAM_ID` (`secret_text`)

## Verified production evidence
- isolated production D1 exists
- production Worker is healthy
- production `/health` returns `environment=production`
- approved FAQ/manual/admin/staff/settings data was bootstrapped
- Telegram webhook cutover completed green
- `/start` works through production
- Owner commands are visible after exact read-back verification
- `BOT_OWNER_TELEGRAM_ID` was restored as a Cloudflare secret

## Owner commands
Expected Owner menu:
`/start`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

## Environment isolation
Historical TEST and production used the same Telegram bot token, which previously allowed TEST health checks to send misleading deployment notices to the live Owner chat.

Canonical runtime now suppresses deployment-online notices unless `APP_ENV === "production"`.

## Runtime contract
`Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`

## Canonical Worker stack
Wrangler entrypoint: `src/manual_entry.ts`

1. `manual_entry.ts` — Owner/Admin manuals + command sync
2. `deployment_notice_entry.ts` — production-only notice + production ops endpoints
3. `latest_return_entry.ts`
4. `monitoring_message_entry.ts`
5. `staff_ux_entry.ts`
6. `ux_entry.ts`
7. `secure_entry.ts` — private Owner AI setup interception + setup error handling
8. `runtime_entry.ts`
9. `index.ts` — fallback + `/health`

## Next exact sequence
1. set production `AI_CONFIG_MASTER_KEY` to a valid Base64-encoded 32-byte random secret
2. verify the production pipeline carrying the hardened `secure_entry.ts` is green
3. `/ai` -> Google Gemini -> submit the Gemini API key in Owner private chat
4. verify key-message deletion and encrypted `ai_provider_credentials` save
5. Fetch models, choose/bind model, then verify grounded AI + fallback/handoff

## Current migrations
0001 through 0010; canonical 0010 is `migrations/0010_manual_newline_cleanup.sql`.

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping.
