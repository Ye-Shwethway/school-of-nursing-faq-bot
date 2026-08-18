# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch policy
- `test` = active development / live TEST validation
- `main` = canonical production source
- no direct feature implementation on `main`
- normal production deployment remains explicit and guarded

## Current foundation
Status: PRODUCTION LIVE; OWNER COMMAND REGISTRY UNDER VERIFIED RESYNC

Implemented:
- multilingual FAQ + dynamic CRUD/revisions
- Owner/Sudo roles and scoped commands
- configurable encrypted AI Primary/Fallback
- grounded AI + human handoff
- Staff Inbox per-user topics and monitoring
- Take Over / Return to AI + stale-AI suppression
- TEST deployment automation
- guarded PRODUCTION deployment automation
- deployment-online notice
- editable/addable Owner/Admin manuals
- same-user first-message topic provisioning lock
- approved operational-data bootstrap from TEST D1 to isolated PRODUCTION D1
- nonce-gated Telegram production cutover automation

## Verified production checkpoint
Verified by live workflow/user evidence:
- isolated production D1 `school-of-nursing-faq-bot-prod-db` exists
- production Worker `school-of-nursing-faq-bot` is deployed and healthy
- production operational-data bootstrap completed green
- Telegram webhook cutover workflow completed green
- `/start` works through production
- deterministic FAQ/runtime paths work
- production uses a fresh `AI_CONFIG_MASTER_KEY`; AI provider credentials still need production `/ai` configuration

## Owner command-menu issue
Observed after cutover: Owner account displayed only the two public commands (`/start`, `/whoami`) and later no expanded Owner menu appeared.

First hotfix in `src/command_sync.ts`:
- per-user `setMyCommands` failures now return failure
- Owner/Sudo failure prevents command-schema fingerprint persistence
- later request/health sync can retry
- command sync revision was bumped

Remaining gap discovered:
- ordinary health/cutover command synchronization was still best-effort
- production workflows could be green without proving Telegram actually stored the Owner-specific command scope

Verified resync slice:
- production-only nonce-gated endpoint `POST /ops/telegram/owner-command-resync`
- validates `BOT_OWNER_TELEGRAM_ID`
- directly calls Telegram `setMyCommands` for the Owner private-chat scope
- immediately calls Telegram `getMyCommands` for the same scope
- requires exact ordered read-back of all 12 Owner commands
- mismatch returns failure instead of reporting green
- `.github/workflows/production-owner-command-resync.yml` deploys current main, arms a one-time D1 nonce, calls the endpoint, and fails unless command count/read-back is exactly 12

Expected Owner menu:
`/start`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

## TEST CI cleanup
Observed run `32123681126` / job `95669489898`: validation passed through Wrangler dry-run; generated artifact self-push lost a non-fast-forward race.

Observed run `32124026795` / job `95670512070`: typecheck passed; D1 validation was cancelled only because a newer `test` push arrived while cancellation was enabled.

Current `.github/workflows/test-typecheck.yml`:
- read-only repository permission
- no CI write-back to `test`
- generated Worker/checksum only in runner artifact
- all `migrations/*.sql` included
- push trigger path-scoped to source/config/migrations/workflow files
- docs-only continuity commits do not trigger Test Build
- `cancel-in-progress: false`

## Production operational-data bootstrap
Workflow: `.github/workflows/bootstrap-production-data.yml`

Copied allow-list: current FAQ entries, manuals, Sudo roles, staff membership, operator identity metadata, persona/monitoring/Staff Inbox/handoff settings.

Not copied: ordinary user history, escalation history, conversation-control state, monitoring-topic mappings, setup sessions, encrypted AI credentials, AI cache/tests/model bindings.

## Canonical Worker stack
Wrangler enters `src/manual_entry.ts`.

1. manual pager/edit/add + command sync
2. deployment online notice + production ops endpoints
3. latest Return-to-AI control
4. monitoring presentation / isolated handoff
5. Staff Inbox UX
6. Telegram UX polish
7. secure AI setup interception
8. dynamic FAQ/AI runtime
9. compatibility fallback + `/health`

## Next exact work
1. promote the verified Owner-command resync slice to `main`
2. automation must prove Telegram read-back has exactly 12 Owner commands
3. only after that, continue with production `/ai` provider credential setup
4. verify grounded AI, fallback and human handoff

## Current migrations
- 0001 initial
- 0002 AI settings
- 0003 handoff/persona
- 0004 shadow monitoring
- 0005 dynamic FAQ
- 0006 conversation control version
- 0007 latest control message
- 0008 monitoring topic provision lock
- 0009 editable manuals
- 0010 manual newline cleanup

Canonical 0010: `migrations/0010_manual_newline_cleanup.sql`.

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
