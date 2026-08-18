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
The first repository promotion to `main` is complete. `main` and `test` were synchronized at the approved full implementation checkpoint before production provisioning began.

Production provisioning has now started:
- separate production D1 `school-of-nursing-faq-bot-prod-db` was created by the Owner
- its UUID was stored as GitHub secret `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
- the first guarded production workflow reached the Worker deploy step and then failed only at the health check because the workflow hard-coded the workers.dev account subdomain
- application `/health` exists in `src/index.ts`; the 404 was therefore an endpoint-resolution problem, not a missing application route
- production workflow has been patched on `test` to explicitly enable `workers_dev`, disable preview URLs, query Cloudflare for the real account subdomain and Worker subdomain status, and build the health URL dynamically

Telegram webhook has NOT been moved to production yet. Current user traffic remains on the known-good TEST endpoint until production health and runtime configuration are ready.

## Current canonical Worker stack
Wrangler entrypoint: `src/manual_entry.ts`

Layer order:
1. `manual_entry.ts` — Owner/Admin manuals, pager/edit/add UX, command sync before interception
2. `deployment_notice_entry.ts` — deploy-health command sync + revision-aware `🟢 Bot is Online!`
3. `latest_return_entry.ts` — latest-message Return to AI control
4. `monitoring_message_entry.ts` — identity/model-aware mirrors + isolated group handoff
5. `staff_ux_entry.ts` — group-native `/staff` inline panel
6. `ux_entry.ts` — typing/reply-to/Close/Back, `/cancel`, `/reset`, stale-AI guard
7. `secure_entry.ts` — Owner AI secret/setup interception
8. `runtime_entry.ts` — dynamic FAQ/AI/command integration
9. `index.ts` — compatibility fallback and `/health`

## Commands
Normal user: `/start`, `/whoami`

Sudo Admin adds: `/admin`, `/admins`, `/faq`, `/adminmanual`

Owner adds: `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`; Owner also inherits `/adminmanual`.

Role-scoped menus use Telegram `setMyCommands`. Command registry synchronization occurs during deploy health, before outer manual interception, and through the lower runtime self-heal path.

## Editable Owner/Admin manuals
Manual storage is separate from FAQ knowledge and AI grounding.

`/ownermanual`: Owner read/edit/add.

`/adminmanual`: Owner read/edit/add; Sudo Admin read-only.

Manual UX uses one Telegram pager message with Previous/Next, page indicator, Owner-only Edit/Add controls and Close. `/cancel` abandons active edit/add state. Migration 0010 plus runtime normalization convert legacy literal `\\n` sequences into real line breaks.

## Staff group / multiuser contract
Preferred Staff Inbox: private Telegram supergroup with Topics enabled.

Each user maps to a separate topic:
`(telegram_user_id, staff_chat_id) -> message_thread_id`

Different users have independent profile/language, question history, control state, claimant, topic, and AI/human lifecycle.

Migration 0008 + `src/monitoring_target.ts` guard same-user concurrent first-message topic provisioning. Staff-side delivery fails closed if an isolated topic cannot be established.

## Take Over / Return to AI
Migration 0006 adds conversation `control_version`; Take Over, Return to AI and `/reset` increment it so stale in-flight AI output is discarded.

Migration 0007 stores `latest_control_message_id`. During human control only the newest USER mirror carries `Return to AI`; newer traffic moves the button to the latest message.

## AI / FAQ runtime
Runtime contract:
`Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`

Approved active FAQ data is the grounding source. AI/config failure fails closed to human review. 22 multilingual FAQ seeds remain the baseline. `/faq` is Owner/Sudo Admin knowledge management with revisions and notifications.

## TEST deployment
`.github/workflows/deploy-test.yml` remains the normal development deployment path for `test`.

## Production deployment
Workflow: `.github/workflows/deploy-production.yml`

Policy:
- manual `workflow_dispatch` only
- run from `main`
- confirmation must be `DEPLOY_PRODUCTION`
- separate production D1 only
- production D1 UUID comes from `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
- generated Wrangler config explicitly sets `workers_dev: true` and `preview_urls: false`
- after deploy, workflow queries Cloudflare API for the real account workers.dev subdomain and confirms the production Worker subdomain is enabled
- health URL is constructed dynamically; do not hard-code the account subdomain
- production `/health` must return `ok=true` and `environment=production`

Production Worker: `school-of-nursing-faq-bot`
Production D1: `school-of-nursing-faq-bot-prod-db`

## Production state still pending
Before Telegram go-live, production Worker still needs runtime secrets/config as required:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `BOT_OWNER_TELEGRAM_ID`
- `AI_CONFIG_MASTER_KEY`
- required production FAQ/AI/manual/admin/staff operational state

The webhook must remain on TEST until production health is green and this state is initialized.

## Next exact work
1. promote the production-health endpoint fix from `test` to `main`
2. rerun `Deploy PRODUCTION to Cloudflare` from `main` with `DEPLOY_PRODUCTION`
3. verify production health green
4. configure/verify production runtime secrets
5. initialize required production operational data
6. move Telegram webhook to production
7. smoke-test `/start`, FAQ, grounded AI, Owner/Admin commands, manuals, Staff Inbox, Take Over/Return to AI

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

Canonical 0010 file: `migrations/0010_manual_newline_cleanup.sql`.

## Deferred validation debt
- simultaneous multiuser live stress test
- same-user near-simultaneous first-message live race test

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping. `NEW_CHAT_BOOTSTRAP.md` must reflect repository reality, not an older planned state.
