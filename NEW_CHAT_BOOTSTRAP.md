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
The first repository promotion has completed.

Promotion checkpoint:
`ea076d9f1ebf992f866c9fa38020ec19cd83d789`

At that checkpoint, `main` was fast-forwarded from the original bootstrap history to the full approved TEST implementation, including the production-promotion foundation and the duplicate migration cleanup.

Production Cloudflare has NOT been deployed by this promotion. Repository promotion and Telegram go-live are separate boundaries.

Continue feature development on `test`; promote to `main` only after validation.

## Current canonical Worker stack
Wrangler entrypoint: `src/manual_entry.ts`

Layer order:
1. `manual_entry.ts` — Owner/Admin manuals, single-message pager, edit/add UX, command sync before interception
2. `deployment_notice_entry.ts` — deploy-health command sync + revision-aware `🟢 Bot is Online!`
3. `latest_return_entry.ts` — latest-message Return to AI control
4. `monitoring_message_entry.ts` — identity/model-aware mirrors + isolated group handoff
5. `staff_ux_entry.ts` — group-native `/staff` inline panel
6. `ux_entry.ts` — typing/reply-to/Close/Back, `/cancel`, `/reset`, stale-AI guard
7. `secure_entry.ts` — Owner AI secret/setup interception
8. `runtime_entry.ts` — dynamic FAQ/AI/command integration
9. `index.ts` — compatibility fallback

## Commands
Normal user:
- `/start`
- `/whoami`

Sudo Admin adds:
- `/admin`
- `/admins`
- `/faq`
- `/adminmanual`

Owner adds:
- `/sudo`
- `/ai`
- `/staff`
- `/ownermanual`
- `/cancel`
- `/reset`

Owner also inherits `/adminmanual`. `/language` remains supported but hidden.

Role-scoped menus use Telegram `setMyCommands`. Command registry synchronization occurs during deploy health, before outer manual interception, and through the lower runtime self-heal path.

## Editable Owner/Admin manuals
Manual storage is separate from FAQ knowledge and AI grounding.

`/ownermanual`:
- Owner read/edit/add

`/adminmanual`:
- Owner read/edit/add
- Sudo Admin read-only

Manual UX:
- one Telegram message per open manual view
- `◀ Previous` / page indicator / `Next ▶`
- Owner-only `✎ Edit this section`
- Owner-only `＋ Add new section`
- `✕ Close`
- page navigation uses edit-in-place

Edit flow:
`Open -> navigate -> Edit -> replacement body -> Preview -> Save/Discard`

Add flow:
`Open -> Add new section -> title -> body -> Preview -> Add/Discard`

The bot generates internal section keys/order. `/cancel` abandons an active manual edit/add session. Migration 0010 and runtime normalization convert legacy literal `\\n` sequences to real line breaks.

See `docs/OPERATOR_MANUALS.md`.

## Staff group / multiuser contract
Preferred Staff Inbox: private Telegram supergroup with Topics enabled.

Each user maps to a separate topic:
`(telegram_user_id, staff_chat_id) -> message_thread_id`

Topic title:
`Name · @username · ID 123456789`

Mirror headers:
- `USER · Name (@username) · ID 123456789`
- `BOT · FAQ`
- `AI · provider/model`
- human-control USER messages add `Human control`

Different users have independent profile/language, question history, control state, claimant, topic, and AI/human lifecycle.

Migration 0008 + `src/monitoring_target.ts` guard same-user concurrent first-message topic provisioning. Staff-side delivery fails closed if an isolated topic cannot be established; never mix different users into the Staff Inbox main chat as fallback.

## Take Over / Return to AI
Migration 0006 adds conversation `control_version`; Take Over, Return to AI and `/reset` increment it so stale in-flight AI output is discarded.

Migration 0007 stores `latest_control_message_id`. During human control only the newest USER mirror carries `Return to AI`; newer user traffic moves the button to the latest message and removes it from the old one.

## AI / FAQ runtime
Runtime contract:
`Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`

Approved active FAQ data is the grounding source. AI/config failure fails closed to human review. AI monitoring headers show the actual bound provider/model.

22 multilingual FAQ seeds remain the baseline. `/faq` is Owner/Sudo Admin knowledge management with revisions and notifications.

## TEST deployment
Workflow:
`.github/workflows/deploy-test.yml`

Deploy-relevant `test` pushes validate/typecheck, validate local migrations, dry-run Wrangler, apply remote TEST migrations, deploy `school-of-nursing-faq-bot-test`, verify `/health`, refresh command menus and trigger the revision-scoped online notice.

TEST runtime remains the development/validation environment.

## Production Promotion Foundation v1
Workflow:
`.github/workflows/deploy-production.yml`

Production deployment contract:
- manual `workflow_dispatch` only
- must run from `main`
- confirmation input must be exactly `DEPLOY_PRODUCTION`
- requires existing `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
- additionally requires GitHub secret `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
- generates a temporary production Wrangler config during the job
- uses a production D1 database separate from TEST
- validates locally, dry-runs, applies production migrations, deploys Worker, verifies `environment=production`
- temporary production config is deleted at job end

Production Worker name:
`school-of-nursing-faq-bot`

Expected production D1 name:
`school-of-nursing-faq-bot-prod-db`

See `docs/PRODUCTION_PROMOTION.md`.

## Cloudflare production resources are NOT provisioned yet
Do not run the production workflow until these are ready:
- separate production D1 database
- its UUID stored as GitHub secret `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
- production Worker runtime secrets: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_OWNER_TELEGRAM_ID`, `AI_CONFIG_MASTER_KEY`
- required production FAQ/AI/manual/admin/staff configuration initialized deliberately

The existing TEST D1 must not be reused as production storage.

## Telegram go-live boundary
A Telegram bot token has one active webhook destination at a time.

The webhook must remain on the current known-good endpoint until production Worker health and production data/config are ready. Moving the webhook to `school-of-nursing-faq-bot` is the actual Telegram go-live boundary.

## Next exact work
1. create the separate production D1 database
2. save its UUID as GitHub secret `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
3. configure production Worker runtime secrets
4. deliberately initialize required production D1 operational content/config
5. manually run `Deploy PRODUCTION to Cloudflare` from `main` using confirmation `DEPLOY_PRODUCTION`
6. verify production health
7. move Telegram webhook to production
8. smoke-test `/start`, FAQ, grounded AI, Owner/Admin commands, manuals, Staff Inbox, Take Over/Return to AI

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

There is only one canonical `0010` migration file: `migrations/0010_manual_newline_cleanup.sql`.

## Known deferred validation debt
Useful after production setup, but not a reason to add more features now:
- simultaneous multiuser live stress test
- same-user near-simultaneous first-message race test

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping. `NEW_CHAT_BOOTSTRAP.md` must reflect repository reality, not an older planned state.
