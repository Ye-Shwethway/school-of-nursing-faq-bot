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
Status: PRODUCTION LIVE; OWNER COMMAND-MENU HOTFIX DEPLOYED; TEST CI CANCELLATION NOISE FIXED

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

## Owner command-menu issue and hotfix
Observed after cutover: Owner account displayed only the two public commands (`/start`, `/whoami`).

Root cause in `src/command_sync.ts`:
- per-user `setMyCommands` failures were swallowed
- registry synchronization could still persist `command_schema_version` even if Owner/Sudo scoped command registration failed
- subsequent health/runtime syncs could therefore skip retrying the broken role-specific menu

Hotfix:
- `syncUserCommandScope()` now returns success/failure
- Owner or Sudo scope failure prevents command-schema fingerprint persistence
- later requests/health checks can self-heal by retrying
- command sync revision bumped so production is forced to rebuild Telegram command scopes

Expected Owner menu after resync:
`/start`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

## TEST CI cleanup
Observed run `32123681126` / job `95669489898`:
- typecheck passed
- local D1 migration validation passed
- Wrangler dry-run passed
- failure occurred only in generated artifact self-push
- push lost a race with a newer `test` commit and was rejected as non-fast-forward

Observed run `32124026795` / job `95670512070`:
- typecheck passed
- D1 validation was cancelled only because a newer `test` push arrived while `cancel-in-progress: true` was enabled
- this was cancellation collateral, not a test assertion or migration failure

Current `.github/workflows/test-typecheck.yml`:
- read-only repository permission
- no CI write-back to `test`
- generated Worker/checksum only in runner artifact
- all `migrations/*.sql` included in handoff bundle
- push trigger path-scoped to source/config/migrations/workflow files
- docs-only continuity commits no longer trigger Test Build
- `cancel-in-progress: false`, so relevant runs queue instead of being cancelled

## Production operational-data bootstrap
Workflow: `.github/workflows/bootstrap-production-data.yml`

Copied allow-list:
- current FAQ entries
- current manual sections
- Sudo Admin roles
- staff membership
- operator identity metadata required for labels
- operational settings: persona, monitoring mode, Staff Inbox ID, handoff route, dedicated staff ID

Not copied:
- ordinary user history/questions
- escalation history
- conversation takeover state
- monitoring-topic mappings
- setup/admin sessions
- encrypted AI credentials
- AI cache/tests/model bindings

## Production cutover automation
Workflow: `.github/workflows/production-telegram-cutover-once.yml`

The workflow deploys current main to production, verifies health, uses a one-time D1 nonce, calls Telegram `setWebhook`, verifies `getWebhookInfo`, refreshes command scopes, and performs a final production health check.

## Canonical Worker stack
Wrangler enters `src/manual_entry.ts`.

1. manual pager/edit/add + command sync
2. deployment online notice + production cutover endpoint
3. latest Return-to-AI control
4. monitoring presentation / isolated handoff
5. Staff Inbox UX
6. Telegram UX polish
7. secure AI setup interception
8. dynamic FAQ/AI runtime
9. compatibility fallback + `/health`

## Next exact work
1. verify the latest path-scoped Test Build finishes green without cancellation noise
2. verify Owner Telegram menu shows the full Owner command set
3. configure production AI provider/API key through `/ai`
4. verify grounded AI, fallback and human handoff
5. once stable, promote the CI workflow cleanup from `test` to `main`

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

## Later slice
After production stabilization:
- remove or retire the one-time cutover workflow
- latency / route telemetry without secrets
- provider/model performance comparison
- answer-presentation polish only where live UX shows a real need
