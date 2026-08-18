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
Production infrastructure, operational data and Telegram webhook cutover are green. `/start` works on production. A production Owner command-menu hotfix is being promoted because the Owner account showed only the two public commands after cutover.

Verified production evidence:
- isolated production D1 `school-of-nursing-faq-bot-prod-db` exists
- production Worker `school-of-nursing-faq-bot` is deployed and healthy
- production `/health` returns `environment=production`
- production runtime secrets exist: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_OWNER_TELEGRAM_ID`, `AI_CONFIG_MASTER_KEY`
- approved FAQ/manual/admin/staff/settings data was bootstrapped into production
- Telegram webhook cutover workflow completed green and `/start` works through production
- production uses a fresh `AI_CONFIG_MASTER_KEY`; encrypted TEST AI provider credentials were intentionally not copied

## Owner command-menu hotfix
Observed production symptom:
Owner account displayed only `/start` and `/whoami`.

Root cause:
`src/command_sync.ts` previously swallowed role-specific `setMyCommands` failures and could still persist `command_schema_version`, causing later syncs to treat the command registry as current and skip retries.

Fix on `test`:
- `syncUserCommandScope()` returns boolean success/failure
- Owner or Sudo command-scope failure aborts fingerprint persistence
- later request/health sync can retry and self-heal
- `COMMAND_SYNC_REVISION` is bumped so production is forced to rebuild command scopes

Expected Owner command menu:
`/start`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

## Canonical Worker stack
Wrangler entrypoint: `src/manual_entry.ts`

1. `manual_entry.ts` — Owner/Admin manual pager/edit/add + command sync
2. `deployment_notice_entry.ts` — deploy-health command sync + online notice + production cutover endpoint
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
Normal user: `/start`, `/whoami`.

Sudo Admin adds: `/admin`, `/admins`, `/faq`, `/adminmanual`.

Owner adds: `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`; Owner inherits Admin commands.

## Production operational data
Workflow: `.github/workflows/bootstrap-production-data.yml`

Copied from TEST allow-list:
- current FAQ entries
- current manual sections
- Sudo Admin roles
- staff membership
- operator identity rows required for labels
- persona, monitoring mode, Staff Inbox ID, handoff route, dedicated staff ID

Intentionally not copied:
- ordinary user/question history
- escalation/case history
- conversation-control state
- monitoring-topic mappings
- admin sessions
- AI provider credentials/cache/tests/bindings

## Telegram production cutover
Workflow: `.github/workflows/production-telegram-cutover-once.yml`

The workflow deploys current main, verifies production health, uses a one-time D1 nonce to authorize the Worker cutover endpoint, calls Telegram `setWebhook`, verifies exact production URL through `getWebhookInfo`, refreshes command scopes and performs final health verification.

## Next exact sequence
1. promote the Owner command-menu hotfix from `test` to `main`
2. tagged production workflow auto-deploys the hotfix and forces command resync
3. verify Owner menu shows all Owner commands
4. configure production AI provider/API key through `/ai`
5. verify grounded AI + fallback/handoff

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
