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
Status: PRODUCTION WORKER + D1 + OPERATIONAL DATA GREEN; TELEGRAM CUTOVER ARMED

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
- one-time nonce-gated Telegram production cutover automation

## Verified production checkpoint
Verified by live workflow/user evidence:
- isolated production D1 `school-of-nursing-faq-bot-prod-db` exists
- production D1 ID is stored as `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
- `Deploy PRODUCTION to Cloudflare` is green
- production Worker `school-of-nursing-faq-bot` is deployed
- production `/health` returns `environment=production`
- four production Worker runtime secrets are configured
- production operational-data bootstrap completed green
- production FAQ/manual/admin/staff operational state is initialized from the approved TEST allow-list
- production `AI_CONFIG_MASTER_KEY` is intentionally fresh, so encrypted TEST AI credentials were not copied

## Production operational-data bootstrap
Workflow:
`.github/workflows/bootstrap-production-data.yml`

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
- deployment markers / command sync fingerprint

## One-time Telegram production cutover
Status: ARMED FOR MAIN PROMOTION

Runtime endpoint:
`POST /ops/telegram/cutover`

Workflow:
`.github/workflows/production-telegram-cutover-once.yml`

Security/behavior:
- production-only endpoint
- requires one-time high-entropy nonce stored in production D1
- workflow generates and masks the nonce, writes it to D1, then calls the production Worker
- Worker atomically consumes the nonce before changing Telegram webhook
- Worker uses its own Cloudflare runtime secrets `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`; the bot token is never copied into GitHub Actions
- webhook target is the actual production Worker origin + `/telegram/webhook`
- Telegram `setWebhook` must succeed
- Telegram `getWebhookInfo` read-back must equal the production webhook URL
- production command scopes are refreshed after cutover
- final production health must pass

The one-time workflow only runs for a `main` push whose head commit message contains `[production-cutover]`. Normal future `main` promotions do not retrigger it.

## Canonical Worker stack
Wrangler enters `src/manual_entry.ts`.

1. manual pager/edit/add + command sync
2. deployment online notice + one-time production cutover endpoint
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
1. promote this tagged cutover checkpoint from `test` to `main`
2. one-time main-push workflow auto-deploys current main to production
3. production health passes before cutover
4. workflow arms and consumes a one-time D1 nonce
5. Telegram webhook moves to production and is read-back verified
6. final production health passes
7. smoke-test normal FAQ, Owner/Admin, manuals and Staff Inbox
8. configure production AI provider/API key through `/ai`
9. verify grounded AI, fallback and human handoff

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
- remove the one-time cutover workflow after successful cutover
- latency / route telemetry without secrets
- provider/model performance comparison
- answer-presentation polish only where live UX shows a real need
