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
First repository promotion to `main` is complete. Production provisioning is active.

Verified production evidence:
- isolated D1 `school-of-nursing-faq-bot-prod-db` exists
- its UUID is stored as GitHub secret `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
- guarded production deploy from `main` is green
- production Worker `school-of-nursing-faq-bot` is deployed
- production `/health` passes with `environment=production`
- production Worker runtime secrets have been added: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_OWNER_TELEGRAM_ID`, `AI_CONFIG_MASTER_KEY`
- production uses a fresh `AI_CONFIG_MASTER_KEY`; encrypted TEST AI credentials must not be copied

Telegram webhook has NOT been moved to production yet. Current user traffic remains on TEST until production operational data is bootstrapped and smoke-tested.

## Canonical Worker stack
Wrangler entrypoint: `src/manual_entry.ts`

1. `manual_entry.ts` — Owner/Admin manual pager/edit/add + command sync
2. `deployment_notice_entry.ts` — deploy-health command sync + online notice
3. `latest_return_entry.ts` — latest Return-to-AI control
4. `monitoring_message_entry.ts` — monitoring presentation + isolated handoff
5. `staff_ux_entry.ts` — Staff Inbox UX
6. `ux_entry.ts` — Telegram UX, cancel/reset, stale-AI guard
7. `secure_entry.ts` — secure AI setup interception
8. `runtime_entry.ts` — dynamic FAQ / AI / commands
9. `index.ts` — compatibility fallback + `/health`

## Commands
Normal user: `/start`, `/whoami`

Sudo Admin adds: `/admin`, `/admins`, `/faq`, `/adminmanual`

Owner adds: `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`; Owner inherits `/adminmanual`.

## Manuals
`/ownermanual`: Owner read/edit/add.

`/adminmanual`: Owner read/edit/add; Sudo Admin read-only.

Manual UX uses a single-message pager with Previous/Next, Owner-only Edit/Add controls and Close. Manual storage remains isolated from FAQ/AI knowledge.

## AI / FAQ / human runtime
Runtime contract:
`Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`

Approved active FAQ data is the grounding source. AI/config failure fails closed to human review.

## Multiuser / Staff Inbox
Each Telegram user has independent profile/language, logs, control state, claimant, monitoring topic and AI/human lifecycle. Migration 0008 guards same-user first-message topic provisioning. Staff-side delivery fails closed instead of mixing users.

## TEST deployment
`.github/workflows/deploy-test.yml` remains the normal development deployment path for `test`.

## PRODUCTION deployment
`.github/workflows/deploy-production.yml` is manual-only, main-only and guarded by confirmation `DEPLOY_PRODUCTION`.

Production health endpoint resolution is dynamic through Cloudflare API; do not hard-code the account workers.dev subdomain.

## Production operational-data bootstrap
Workflow:
`.github/workflows/bootstrap-production-data.yml`

Purpose: copy only approved operational state from TEST D1 to isolated PRODUCTION D1.

Manual trigger contract:
- run from `main`
- confirmation `BOOTSTRAP_PRODUCTION_DATA`

Copied:
- current `faq_entries`
- current `manual_sections`
- `admin_roles`
- `staff_members`
- operator identity rows needed for Admin/Staff labels
- allow-listed `bot_settings`: `agent_persona`, `monitoring_mode`, `staff_inbox_chat_id`, `handoff_route`, `dedicated_staff_id`

Intentionally NOT copied:
- user question/history data
- escalation/case history
- conversation-control state
- monitoring-topic mappings
- admin sessions
- AI provider credentials, model cache/tests/bindings
- deployment markers and command-sync fingerprints

The workflow verifies source/destination content counts, deletes the production command-schema fingerprint, then calls production `/health` so role-scoped Telegram command menus rebuild against copied production roles.

Because production uses a fresh `AI_CONFIG_MASTER_KEY`, AI provider credentials must be configured again through production `/ai` after webhook cutover (or through a later purpose-built secret migration flow; never raw-copy encrypted TEST credentials).

## Telegram go-live boundary
One Telegram bot token has one active webhook destination. Do not move the webhook until production operational-data bootstrap is green.

Next exact sequence:
1. promote this bootstrap workflow/docs from `test` to `main`
2. manually run `Bootstrap PRODUCTION operational data` with `BOOTSTRAP_PRODUCTION_DATA`
3. verify green bootstrap + production health
4. move Telegram webhook to production
5. smoke-test `/start`, FAQ, Owner/Admin commands, manuals and Staff Inbox
6. configure production AI provider/API key with `/ai`
7. verify grounded AI + fallback/handoff path

## Current migrations
- 0001 initial
- 0002 AI settings
- 0003 handoff/persona
- 0004 shadow monitoring
- 0005 dynamic FAQ
- 0006 conversation control version
- 0007 latest Return-to-AI control message
- 0008 monitoring topic provision lock
- 0009 editable operating manuals
- 0010 manual newline cleanup

Canonical 0010: `migrations/0010_manual_newline_cleanup.sql`.

## Deferred validation debt
- simultaneous multiuser live stress test
- same-user near-simultaneous first-message live race test

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping.
