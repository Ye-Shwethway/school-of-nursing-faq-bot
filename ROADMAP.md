# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch policy
- `test` = active development / live TEST validation
- `main` = canonical production source
- no direct feature implementation on `main`
- production deployment is a separate explicit action after repository promotion

## Current foundation
Status: PRODUCTION WORKER + D1 HEALTH GREEN; OPERATIONAL DATA BOOTSTRAP NEXT

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

## Production checkpoint
Verified by live workflow/user evidence:
- isolated production D1 exists
- production D1 ID is stored as `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
- `Deploy PRODUCTION to Cloudflare` is green
- production Worker `school-of-nursing-faq-bot` is deployed
- production `/health` returns `environment=production`
- four production Worker runtime secrets are configured
- production `AI_CONFIG_MASTER_KEY` is intentionally fresh, so encrypted TEST AI credentials are not portable and will be reconfigured on production

Telegram webhook still points to TEST; go-live has not happened.

## Production operational-data bootstrap
Status: IMPLEMENTED ON `test`; PROMOTION/RUN PENDING

Workflow:
`.github/workflows/bootstrap-production-data.yml`

It runs manually from `main` with confirmation `BOOTSTRAP_PRODUCTION_DATA` and uses the existing Cloudflare API token plus TEST/PRODUCTION D1 IDs.

Copied allow-list:
- current FAQ entries
- current manual sections
- Sudo Admin roles
- active/inactive staff membership
- operator identity metadata required for Admin/Staff labels
- operational bot settings: persona, monitoring mode, Staff Inbox ID, handoff route, dedicated staff ID

Not copied:
- ordinary user history/questions
- escalation history
- conversation takeover state
- monitoring-topic mappings
- setup/admin sessions
- encrypted AI credentials
- AI cache/tests/model bindings
- deployment markers / command sync fingerprint

After copy the workflow forces production command-scope resynchronization and verifies production `/health` again.

## Canonical Worker stack
Wrangler enters `src/manual_entry.ts`.

1. manual pager/edit/add + command sync
2. deployment online notice
3. latest Return-to-AI control
4. monitoring presentation / isolated handoff
5. Staff Inbox UX
6. Telegram UX polish
7. secure AI setup interception
8. dynamic FAQ/AI runtime
9. compatibility fallback + `/health`

## Manuals
`/ownermanual` — Owner read/edit/add.

`/adminmanual` — Owner read/edit/add; Sudo Admin read-only.

Manual storage remains isolated from FAQ matching and AI grounding.

## Multiuser / Staff Inbox isolation
Different Telegram users have independent profile/language, question logs, conversation mode, claimant, topic, and AI/human lifecycle. Migration 0008 guards same-user concurrent first-topic provisioning.

## Production go-live sequence
1. promote production-bootstrap workflow/docs from `test` to `main`
2. run `Bootstrap PRODUCTION operational data`
3. verify bootstrap green + production health
4. move Telegram webhook to production Worker
5. smoke-test normal FAQ, Owner/Admin, manuals and Staff Inbox
6. configure production AI provider/API key through `/ai`
7. verify grounded AI, fallback and human handoff

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
After controlled production go-live:
- latency / route telemetry without secrets
- provider/model performance comparison
- answer-presentation polish only where live UX shows a real need
