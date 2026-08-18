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
Status: FIRST MAIN PROMOTION COMPLETE; PRODUCTION PROVISIONING IN PROGRESS

Implemented:
- multilingual FAQ + dynamic CRUD/revisions
- Owner/Sudo role management and role-scoped commands
- configurable encrypted AI Primary/Fallback
- grounded AI + human handoff
- Staff Inbox per-user topics and monitoring
- Take Over / Return to AI + stale-AI suppression
- TEST GitHub Actions -> Cloudflare deployment
- deployment-online notification
- editable/addable Owner/Admin manuals
- same-user first-message topic provisioning lock
- guarded production deployment workflow

## Production checkpoint
The Owner has created isolated production D1 `school-of-nursing-faq-bot-prod-db` and registered its UUID as GitHub secret `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`.

The first production deployment reached Worker deployment successfully but the workflow health step returned HTTP 404 because it assumed a hard-coded workers.dev account subdomain.

`src/index.ts` already implements GET `/health`, so the failure is endpoint resolution rather than an absent application health route.

The production workflow is now hardened to:
- explicitly set `workers_dev: true`
- explicitly set `preview_urls: false`
- query Cloudflare API for the actual account workers.dev subdomain
- verify that the production Worker workers.dev route is enabled
- construct the production health URL dynamically
- require `/health` to return `ok=true` and `environment=production`

This workflow fix is developed on `test` and should be promoted to `main` before rerunning production deployment.

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

Manual browsing uses one Telegram pager message. Manual storage remains isolated from FAQ matching and AI grounding.

## Multiuser / Staff Inbox isolation
Different Telegram users have independent profile/language, question logs, conversation mode, claimant, topic, and AI/human lifecycle.

Migration 0008 prevents same-user concurrent first-message duplicate topic creation with a D1 provisioning lock. Staff-side delivery fails closed if an isolated topic cannot be established.

## Take Over controls
Migration 0006 prevents stale AI output after control changes.

Migration 0007 keeps Return to AI on the newest human-control USER mirror.

## TEST deployment
`.github/workflows/deploy-test.yml` remains the normal development deployment path for `test`.

## Production deployment
`.github/workflows/deploy-production.yml` is manual-only and main-only, guarded by confirmation `DEPLOY_PRODUCTION`.

Production Worker: `school-of-nursing-faq-bot`

Production D1: `school-of-nursing-faq-bot-prod-db`

Telegram webhook remains on TEST until production health and runtime state are ready.

## Remaining production prerequisites
After health succeeds:
- configure/verify production Worker runtime secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_OWNER_TELEGRAM_ID`, `AI_CONFIG_MASTER_KEY`
- initialize required production FAQ/AI/manual/admin/staff operational state
- move Telegram webhook to production
- smoke-test full user/operator path

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

Canonical 0010 file: `migrations/0010_manual_newline_cleanup.sql`.

## Next exact slice
1. promote production health-resolution fix from `test` to `main`
2. rerun production workflow
3. verify production health green
4. finish production runtime configuration
5. move webhook
6. smoke-test production

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test

## Later slice
After controlled production go-live:
- latency / route telemetry without secrets
- provider/model performance comparison
- answer-presentation polish only where live UX shows a real need
