# Cloudflare Handoff

Last updated: 2026-08-18

## Verified live Cloudflare state
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1 database: `school-of-nursing-faq-bot-db`
- D1 database ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- binding name: `DB`
- live schema currently includes migration 0001 only
- verified live tables: `users`, `questions`, `admin_roles`, `admin_audit`
- verified live indexes: `idx_questions_user_created`, `idx_questions_resolution_created`
- Worker `school-of-nursing-faq-bot-test`: not yet created
- production Worker `school-of-nursing-faq-bot`: not yet created
- no Telegram/AI secrets configured

The first Worker creation attempt was rejected before creation with Cloudflare error `10021` because compatibility date `2026-08-18` was still future in Cloudflare UTC. No Worker, binding, secret, schema, DNS, KV, R2, Queue, or Durable Object drift occurred.

Do not silently change the compatibility date merely to bypass that error. Retry after Cloudflare UTC has reached `2026-08-18`, or deliberately update the repository compatibility date under the normal `test` validation workflow.

## Branch/environment rule
- `test` = active validation/development
- `main` = verified canonical/production
- deploy only `test` to `school-of-nursing-faq-bot-test` during this handoff
- do not create/deploy `school-of-nursing-faq-bot` until the validated checkpoint is merged to `main`

## Current application entrypoint
Wrangler entrypoint:

`src/runtime_entry.ts`

The older `src/entry.ts` has been removed. `src/index.ts` remains an intentionally retained legacy/fallback runtime used by the migration-aware wrapper during transitional states.

## Repository-side validation evidence
The current `test` application has passed the focused GitHub build workflow with:

1. Node 22 dependency installation
2. `npm run typecheck`
3. local Wrangler D1 migration application for migrations 0001 through 0005
4. `wrangler deploy --dry-run --env test`
5. generation of the deployment bundle

Latest validated dry-run characteristics at this checkpoint:
- total upload approximately `182.21 KiB`
- gzip approximately `39.71 KiB`
- expected D1 binding: `DB` → `school-of-nursing-faq-bot-db`
- expected plain variable: `APP_ENV=test`

## Exact deployment artifact
For direct Cloudflare API/MCP upload when Wrangler cannot be run in the Cloudflare-side conversation, use the exact file from the current `test` branch:

`deploy/worker.mjs`

Do not manually rewrite, reformat, summarize, or reconstruct this generated module.

SHA-256 is stored alongside it in:

`deploy/worker.sha256`

Current expected SHA-256:

`2f15bd2d97ec86917741603b41eccf6c0a49f88172283ed5fc10021925cddff0`

The GitHub Test Build workflow regenerates the artifact from the current Wrangler build and refreshes the checksum whenever the generated module changes.

## Repository-only migrations to apply
Live Cloudflare currently has 0001 only. Apply the remaining migrations in order:

1. `migrations/0002_ai_settings.sql`
2. `migrations/0003_handoff_persona.sql`
3. `migrations/0004_shadow_monitoring.sql`
4. `migrations/0005_dynamic_faq.sql`

These migrations have already passed local Wrangler D1 migration validation in GitHub Actions. Do not re-author or combine them on the Cloudflare side; use the exact repository SQL.

After migrations, verify at minimum that the expected new tables exist:
- `ai_provider_credentials`
- `ai_model_cache`
- `ai_model_tests`
- `ai_model_bindings`
- `admin_sessions`
- `bot_settings`
- `staff_members`
- `escalation_cases`
- `escalation_messages`
- `conversation_control`
- `monitoring_topics`
- `faq_entries`
- `faq_revisions`

The original 22 FAQs are seeded by application runtime when `faq_entries` is empty; migration 0005 itself intentionally creates schema only.

## Test Worker creation/deployment
Create/upload only:

- Worker name: `school-of-nursing-faq-bot-test`
- module: exact current `deploy/worker.mjs`
- compatibility date: `2026-08-18`
- D1 binding: `DB` → `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- plain variable: `APP_ENV=test`

First validate without Telegram or AI credentials:

1. Worker exists and deployment/version ID is recorded.
2. `DB` binding resolves to the expected D1 ID.
3. `APP_ENV=test` is present.
4. `GET /health` returns HTTP 200.
5. Expected body is equivalent to:

```json
{
  "ok": true,
  "service": "school-of-nursing-faq-bot",
  "environment": "test"
}
```

6. Unknown route returns HTTP 404 / `Not Found`.
7. Malformed JSON to `/telegram/webhook` returns the canonical invalid-JSON response rather than crashing.
8. Recheck D1 integrity after deployment.

## Secrets/configuration after foundation health passes
Cloudflare Worker secrets required for Telegram/runtime configuration:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `BOT_OWNER_TELEGRAM_ID`
- `AI_CONFIG_MASTER_KEY`

`AI_CONFIG_MASTER_KEY` must be the base64 encoding of exactly 32 random bytes.

Provider API keys are **not** separate Cloudflare secrets in this design. The Owner enters provider keys through the Telegram `/ai` settings flow; the Worker encrypts them with `AI_CONFIG_MASTER_KEY` and stores ciphertext in D1.

Never expose any secret value in GitHub, Cloudflare reports, Telegram Staff Inbox, or handoff transcripts.

## Live Telegram validation after secrets are configured
Validate in focused order:

1. `/start` public-only UX and language persistence
2. `/whoami` name/username + immutable Telegram ID
3. scoped command menus for normal user, Sudo Admin, and Owner
4. Sudo grant/revoke and target command-scope refresh
5. `/faq` dynamic CRUD, revision history, disable/restore, notification fan-out, and immediate knowledge update
6. AI provider key save → model fetch → Test Ping → Primary/Fallback binding
7. Male/Female persona
8. deterministic FAQ → Primary AI → Fallback AI → Human fail-safe
9. no-AI/no-key/provider-failure path directly to human handoff without crash
10. group and dedicated responder routes
11. Staff Inbox forum-topic shadow monitoring / silent messages
12. atomic Take Over, claimant-only anonymous reply, Resolve, and Return to AI

## Stop boundary
Do not merge `test` into `main` and do not deploy the production Worker during this handoff. Return the exact migration evidence, Worker deployment/version, health responses, binding state, secret-presence state (never values), FAQ seed count, and focused Telegram validation results to the GitHub-side development conversation first.
