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
Production infrastructure, operational data and Telegram webhook cutover are green. Owner commands are visible after exact Telegram read-back verification. The project has now been simplified to a main-only production workflow to eliminate TEST/PRODUCTION cross-talk and workflow duplication.

## Main-only operating model
- `main` is the only active development/canonical/production branch.
- historical `test` is dormant/reference-only.
- TEST deploy/build workflows are retired.
- completed one-time bootstrap/cutover/resync workflows are retired from the live tree.
- `.github/workflows/deploy-production.yml` is the single active workflow.

Relevant `main` pushes automatically validate and deploy production.

## Single production pipeline
The production workflow performs:
- install
- typecheck
- isolated production config generation
- local migration validation
- production Worker dry-run
- production D1 migrations
- Worker deploy with `APP_ENV=production` and current revision
- production health verification
- one-time Owner command resync
- exact Telegram read-back of all 12 Owner commands

A green production workflow therefore proves both runtime health and Owner command registry state.

## Verified production evidence
- isolated production D1 exists
- production Worker is healthy
- production `/health` returns `environment=production`
- production runtime secrets exist
- approved FAQ/manual/admin/staff/settings data was bootstrapped
- Telegram webhook cutover completed green
- `/start` works through production
- Owner commands are visible after verified read-back
- production uses a fresh `AI_CONFIG_MASTER_KEY`

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
7. `secure_entry.ts`
8. `runtime_entry.ts`
9. `index.ts` — fallback + `/health`

## Next exact sequence
1. verify consolidated main-only production workflow green
2. reproduce/fix `/ai` Owner authorization inconsistency if still present
3. configure production AI provider/API key through `/ai`
4. verify grounded AI + fallback/handoff
5. continue directly on `main`

## Current migrations
0001 through 0010; canonical 0010 is `migrations/0010_manual_newline_cleanup.sql`.

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping.
