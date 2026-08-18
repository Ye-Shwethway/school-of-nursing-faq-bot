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
Production infrastructure and approved operational data are green. Telegram production cutover is armed as a one-time automated main-push operation.

Verified evidence:
- isolated production D1 `school-of-nursing-faq-bot-prod-db` exists
- its UUID is stored as GitHub secret `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
- guarded production deploy from `main` is green
- production Worker `school-of-nursing-faq-bot` is deployed
- production `/health` passes with `environment=production`
- production Worker runtime secrets exist: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_OWNER_TELEGRAM_ID`, `AI_CONFIG_MASTER_KEY`
- production uses a fresh `AI_CONFIG_MASTER_KEY`; encrypted TEST AI credentials were intentionally not copied
- `Bootstrap PRODUCTION operational data` completed green
- approved FAQ/manual/admin/staff/settings state is initialized in production

## Canonical Worker stack
Wrangler entrypoint: `src/manual_entry.ts`

1. `manual_entry.ts` — Owner/Admin manual pager/edit/add + command sync
2. `deployment_notice_entry.ts` — deploy-health command sync + online notice + production-only nonce-gated Telegram cutover endpoint
3. `latest_return_entry.ts` — latest Return-to-AI control
4. `monitoring_message_entry.ts` — monitoring presentation + isolated handoff
5. `staff_ux_entry.ts` — Staff Inbox UX
6. `ux_entry.ts` — Telegram UX, cancel/reset, stale-AI guard
7. `secure_entry.ts` — secure AI setup interception
8. `runtime_entry.ts` — dynamic FAQ / AI / commands
9. `index.ts` — compatibility fallback + `/health`

## Runtime contract
`Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`

Approved active FAQ data is the grounding source. AI/config failure fails closed to human review.

## Commands
Normal user: `/start`, `/whoami`

Sudo Admin adds: `/admin`, `/admins`, `/faq`, `/adminmanual`

Owner adds: `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`; Owner inherits `/adminmanual`.

## Production operational data
Workflow: `.github/workflows/bootstrap-production-data.yml`

Copied from TEST allow-list:
- current `faq_entries`
- current `manual_sections`
- `admin_roles`
- `staff_members`
- operator identity rows required for labels
- `agent_persona`, `monitoring_mode`, `staff_inbox_chat_id`, `handoff_route`, `dedicated_staff_id`

Intentionally not copied:
- ordinary user/question history
- escalation/case history
- conversation-control state
- monitoring-topic mappings
- admin sessions
- AI provider credentials/cache/tests/bindings
- deployment markers / command-sync fingerprint

## One-time Telegram production cutover
Runtime endpoint:
`POST /ops/telegram/cutover`

Workflow:
`.github/workflows/production-telegram-cutover-once.yml`

Trigger:
- push to `main`
- job runs only when the head commit message contains `[production-cutover]`

Flow:
1. typecheck current main
2. generate isolated production Wrangler config
3. apply production migrations
4. deploy current main to production
5. resolve real workers.dev production origin through Cloudflare API
6. verify production health
7. generate a high-entropy one-time nonce and mask it in GitHub Actions
8. store nonce in production D1
9. call production `/ops/telegram/cutover` with the nonce
10. Worker atomically consumes the nonce
11. Worker uses its own runtime `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` to call Telegram `setWebhook`
12. Worker calls `getWebhookInfo` and requires exact production URL read-back
13. refresh role-scoped command menus
14. final production health check

The bot token is never copied into GitHub Actions. The cutover endpoint is production-only and unusable without the current one-time D1 nonce.

Normal future `main` promotions do not retrigger cutover because they will not carry the `[production-cutover]` head-commit tag.

## Post-cutover next work
After cutover workflow is verified green:
1. smoke-test `/start`, FAQ, Owner/Admin commands, manuals and Staff Inbox on production
2. configure production AI provider/API key through `/ai` because production uses a fresh master key
3. verify grounded AI + fallback/handoff
4. remove the one-time cutover workflow from the repository
5. continue future development through `test -> validate -> main`; user should not need to manage branches manually

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
