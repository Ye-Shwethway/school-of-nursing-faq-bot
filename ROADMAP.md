# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch policy
- `test` = active development / live TEST validation
- `main` = canonical production source
- no direct feature implementation on `main`
- production deployment remains guarded

## Current foundation
Status: PRODUCTION LIVE; OWNER COMMANDS VERIFIED; TEST TELEGRAM DEPLOYMENT NOTICES SUPPRESSED

Implemented:
- multilingual dynamic FAQ
- Owner/Sudo roles and scoped commands
- encrypted configurable AI Primary/Fallback
- grounded AI + human handoff
- Staff Inbox monitoring and Take Over / Return to AI
- TEST + guarded PRODUCTION deployment automation
- editable/addable Owner/Admin manuals
- production D1 bootstrap and Telegram webhook cutover
- verified Owner command resync with Telegram read-back

## Verified production checkpoint
- production D1 and Worker are healthy
- production operational-data bootstrap completed green
- production Telegram webhook cutover completed green
- `/start` works through production
- Owner command resync completed green and the Owner menu now shows the expected commands
- production uses a fresh `AI_CONFIG_MASTER_KEY`; production AI provider credentials still need `/ai` setup

## Owner command registry
Expected Owner commands:
`/start`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

Verified resync contract:
- `POST /ops/telegram/owner-command-resync`
- production-only, one-time D1 nonce gated
- calls Telegram `setMyCommands`
- immediately calls `getMyCommands`
- requires exact ordered read-back of all 12 commands
- `.github/workflows/production-owner-command-resync.yml` fails unless read-back is exact

## TEST deployment-notice pollution fix
Observed live symptom after production was already working:
- Telegram showed `Environment: test` / revision `69f1434d`
- that revision is a TEST-side command-resync commit, not the production revision

Root cause:
- TEST and PRODUCTION Workers use the same Telegram bot token
- TEST `/health` invoked `notifyDeploymentOnline()` and could call Telegram `sendMessage` directly even though the bot webhook already pointed to PRODUCTION
- therefore TEST deployment status messages polluted the live Owner chat and looked like production state

Fix:
- `notifyDeploymentOnline()` now returns immediately unless `APP_ENV === "production"`
- TEST deployment still performs typecheck, migrations, deploy and `/health` verification
- TEST no longer sends Owner/Admin online notices
- `.github/workflows/deploy-test.yml` explicitly documents that Telegram online notices are suppressed in TEST
- the next production deployment should emit a fresh `Environment: production` notice for its own revision

## TEST CI cleanup
`.github/workflows/test-typecheck.yml` is read-only, path-scoped, does not push generated artifacts back to `test`, includes all migrations in the handoff artifact, and uses `cancel-in-progress: false`.

## Production operational-data bootstrap
Copied allow-list: current FAQ entries, manuals, Sudo roles, staff membership, operator identity metadata, persona/monitoring/Staff Inbox/handoff settings.

Not copied: ordinary user history, escalation history, conversation-control state, monitoring-topic mappings, setup sessions, encrypted AI credentials, AI cache/tests/model bindings.

## Canonical Worker stack
Wrangler enters `src/manual_entry.ts`.

1. manual pager/edit/add + command sync
2. deployment notice + production ops endpoints
3. latest Return-to-AI control
4. monitoring presentation / isolated handoff
5. Staff Inbox UX
6. Telegram UX polish
7. secure AI setup interception
8. dynamic FAQ/AI runtime
9. compatibility fallback + `/health`

## Next exact work
1. promote the production-only notice fix to `main`
2. production resync workflow redeploys current main and verifies all 12 Owner commands again
3. confirm the new online notice is `Environment: production`
4. configure production AI provider/API key through `/ai`
5. verify grounded AI, fallback and human handoff

## Current migrations
0001 through 0010. Canonical 0010: `migrations/0010_manual_newline_cleanup.sql`.

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
