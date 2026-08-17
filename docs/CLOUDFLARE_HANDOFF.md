# Cloudflare Handoff

Last updated: 2026-08-18

## Verified Cloudflare state
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1 database: `school-of-nursing-faq-bot-db`
- D1 database ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- D1 schema migration: applied and verified
- Verified tables: `users`, `questions`, `admin_roles`, `admin_audit`
- Verified indexes: `idx_questions_user_created`, `idx_questions_resolution_created`
- Worker deployment: not yet deployed at this checkpoint

## Branch/environment rule
- `test` is the active validation branch.
- `main` is canonical/production.
- Deploy `test` to Worker `school-of-nursing-faq-bot-test`.
- Deploy canonical `main` to Worker `school-of-nursing-faq-bot` only after validation and merge.

## D1 binding
Binding name: `DB`

Database ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`

`wrangler.jsonc` on `test` contains both the production/default configuration and a `test` environment targeting `school-of-nursing-faq-bot-test`.

## Exact test deployment artifact
Use `deploy/worker.mjs` from the current `test` branch for direct Cloudflare API upload when Wrangler is unavailable.

The artifact is derived from `src/index.ts` source blob:

`1b5a5772d799e165fa9f8449cd333d02dc6fdd58`

Local syntax validation:

`node --check deploy/worker.mjs` equivalent passed before commit.

Expected SHA-256 for the committed payload content:

`05c2a5ba086469a559bc5a9d6eddd0c65c334e93a11d6fd89cd79e3475dbde98`

## Test Worker deployment requirements
Upload the exact `deploy/worker.mjs` module without independently rewriting application behavior.

Attach:
- Worker name: `school-of-nursing-faq-bot-test`
- D1 binding `DB` → `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- plain variable `APP_ENV=test`

Do not configure Telegram or Gemini secrets for the first `/health` validation.

After upload, verify:
1. Worker exists.
2. D1 binding exists.
3. `GET /health` returns HTTP 200.
4. JSON reports `ok: true`, service `school-of-nursing-faq-bot`, and environment `test`.

## Secrets for later slices
Store only as Cloudflare secrets when provided:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `BOT_OWNER_TELEGRAM_ID`
- `GEMINI_API_KEY` (later)

Do not invent values and do not expose secret values in GitHub or reports.
