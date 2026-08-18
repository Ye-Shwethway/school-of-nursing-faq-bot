# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Development branch: `test`
Canonical branch: `main`

## Startup sequence
Read in order:
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. task-relevant source/docs only

Treat live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Current checkpoint
Production infrastructure, operational data and Telegram webhook cutover are green. Owner commands now appear correctly after a verified Telegram read-back resync. The remaining active issue was misleading TEST deployment status messages appearing in the live Owner chat.

## Production Owner commands
Expected Owner command menu:
`/start`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

Verified resync automation:
- `.github/workflows/production-owner-command-resync.yml`
- production-only one-time D1 nonce
- `setMyCommands` + immediate `getMyCommands`
- workflow fails unless all 12 Owner commands are read back exactly
- latest user evidence confirms commands are now visible

## TEST deployment notice contamination
Observed message:
- `Environment: test`
- `Revision: 69f1434d`

This did not mean production reverted to TEST. Revision `69f1434d` is a TEST-side command-resync commit.

Root cause:
- TEST and PRODUCTION Workers use the same Telegram bot token
- TEST health checks could directly call Telegram `sendMessage`
- webhook location does not prevent the TEST Worker from sending proactive messages with the shared token

Fix:
- `notifyDeploymentOnline()` is now production-only (`APP_ENV === "production"`)
- TEST health/deploy validation remains active
- TEST no longer injects deployment-online notices into the live Owner chat
- `.github/workflows/deploy-test.yml` now states that TEST Telegram online notices are intentionally suppressed

The tagged checkpoint carrying this document uses `[production-command-resync]` so promotion to `main` automatically redeploys PRODUCTION, performs the exact 12-command read-back again, and triggers a fresh production-only online notice for the new revision.

## Verified production evidence
- isolated production D1 exists
- production Worker is healthy
- production `/health` requires `environment=production` in deployment workflows
- production runtime secrets exist
- approved FAQ/manual/admin/staff/settings data was bootstrapped
- Telegram webhook cutover completed green
- `/start` works through production
- Owner commands are visible after verified resync
- production uses a fresh `AI_CONFIG_MASTER_KEY`; encrypted TEST AI credentials were intentionally not copied

## TEST CI contract
- `test-typecheck.yml` is read-only and path-scoped
- no generated artifact push-back
- all migrations included in handoff artifact
- `cancel-in-progress: false`
- docs-only commits do not trigger Test Build

## Canonical Worker stack
Wrangler entrypoint: `src/manual_entry.ts`

1. `manual_entry.ts` — Owner/Admin manuals + command sync
2. `deployment_notice_entry.ts` — production-only deployment notice + production ops endpoints
3. `latest_return_entry.ts`
4. `monitoring_message_entry.ts`
5. `staff_ux_entry.ts`
6. `ux_entry.ts`
7. `secure_entry.ts`
8. `runtime_entry.ts`
9. `index.ts` — fallback + `/health`

## Runtime contract
`Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`

## Next exact sequence
1. promote this tagged checkpoint to `main`
2. production Owner-command resync workflow redeploys current main and proves all 12 commands again
3. production-only online notice should identify `Environment: production`
4. configure production AI provider/API key through `/ai`
5. verify grounded AI + fallback/handoff

## Current migrations
0001 through 0010; canonical 0010 is `migrations/0010_manual_newline_cleanup.sql`.

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping.
