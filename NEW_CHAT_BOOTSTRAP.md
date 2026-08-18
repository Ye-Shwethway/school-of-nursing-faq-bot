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

## Branch contract
- work on `test`
- do not implement directly on `main`
- TEST Worker: `school-of-nursing-faq-bot-test`
- production Worker only after validated merge: `school-of-nursing-faq-bot`
- `main` is not promoted yet

## Current verified TEST state
The live TEST bot has already demonstrated:
- dynamic FAQ answers
- grounded Gemini answers
- role-scoped Telegram commands
- Staff Inbox group binding from Telegram
- monitoring topics
- group Take Over / Return to AI
- direct GitHub Actions -> Cloudflare TEST deployment

Cloudflare/GitHub live evidence always wins if it differs from this file.

## Current canonical Worker stack
Wrangler entrypoint:

`src/deployment_notice_entry.ts`

Layer order:
1. `deployment_notice_entry.ts` — revision-aware `🟢 Bot is Online!` notification after successful health request
2. `latest_return_entry.ts` — newest-message Return to AI control during human takeover
3. `monitoring_message_entry.ts` — user/model-aware staff mirror headers and isolated group handoff
4. `staff_ux_entry.ts` — group-native `/staff` inline control panel and topic identity updates
5. `ux_entry.ts` — typing/reply-to/Close/Back, `/cancel`, `/reset`, stale-AI generation guard
6. `secure_entry.ts` — Owner AI secret/setup interception and best-effort secret-message deletion
7. `runtime_entry.ts` — dynamic FAQ/AI/command integration
8. `index.ts` — retained fallback/compatibility runtime

Do not bypass this stack or reconstruct a separate Worker artifact by hand.

## Commands
Normal user menu:
- `/start`
- `/whoami`

Sudo Admin adds:
- `/admin`
- `/admins`
- `/faq`

Owner adds:
- `/sudo`
- `/ai`
- `/staff`
- `/cancel`
- `/reset`

`/language` remains supported but hidden.

Command menus are synced by Worker `setMyCommands`; authorization is still enforced server-side by immutable Telegram numeric ID.

## `/cancel` and `/reset`
- `/cancel` deletes only the current `admin_sessions` wizard/setup state
- `/reset` clears transient conversation/session state and returns that user to AI mode
- `/reset` preserves language, FAQ knowledge, AI credentials, model bindings, persona, roles, Staff Inbox, routing and monitoring settings

## Staff group UX
Preferred Staff Inbox topology: private Telegram supergroup with Topics enabled.

Bot should be an admin with Manage Topics. Delete Messages is recommended for UI cleanup.

Owner flow inside the group:
`/staff` -> inline control panel

Current panel includes:
- Set this group as Staff Inbox
- Status
- Monitoring
- Route: Group
- Route: Auto
- Close

Binding captures the current group chat ID automatically; manual group-ID copy/paste is not required. Legacy `/staff inbox here` remains supported.

## Staff topic and message identity
Each Telegram user gets a separate monitoring forum topic keyed by:

`(telegram_user_id, staff_chat_id) -> message_thread_id`

Topic title:
`Name · @username · ID 123456789`

Message headers:
- `USER · Name (@username) · ID 123456789`
- `BOT · FAQ`
- `AI · provider/model`
- human-control USER messages add `Human control`

The numeric Telegram ID is the authority key even when name/username changes.

## Multiuser isolation
Different users have independent:
- profile/language
- question history
- conversation mode
- claimant
- Staff Inbox topic
- AI/human-control lifecycle

Take Over for one user must not pause or redirect another user.

Group handoff cards are posted inside that user's isolated topic, not the Staff Inbox main chat.

## Same-user first-message topic race — migration 0008
File:
`migrations/0008_monitoring_topic_provision_lock.sql`

Adds `monitoring_topic_provision_locks` keyed by `(telegram_user_id, staff_chat_id)`.

Shared provisioner:
`src/monitoring_target.ts`

Behavior:
1. read canonical `monitoring_topics` mapping
2. atomically claim topic provisioning in D1
3. only one request calls `createForumTopic`
4. concurrent same-user requests wait briefly for the resulting mapping
5. abandoned locks older than 30 seconds can be recovered
6. lock is released after completion/failure
7. if an isolated topic cannot be established, staff-side delivery fails closed; do not mix users in the Staff Inbox main chat

## Conversation race guard — migration 0006
`migrations/0006_conversation_control_version.sql`

Adds `conversation_control.control_version`.

Take Over, Return to AI, and `/reset` increment the version. Grounded AI captures mode/version before provider work and re-checks before sending; stale in-flight AI output is discarded after a control change.

## Latest Return to AI control — migration 0007
`migrations/0007_latest_control_message.sql`

Adds `monitoring_topics.latest_control_message_id`.

During human control:
- newest mirrored USER message carries `Return to AI`
- a newer USER message is sent first
- after successful send, the previous message's inline keyboard is removed
- newest message becomes the control pointer
- Return to AI or `/reset` clears the latest button

## AI runtime
Runtime contract:
`Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`

Grounded answers use active approved FAQ context only. Provider/config failures fail closed to human review.

Current staff mirror AI header reads the actual bound provider/model from D1 and distinguishes primary vs fallback use.

## Dynamic FAQ
22 canonical multilingual FAQ seeds remain the baseline.

Owner + Sudo Admin `/faq` supports active D1 knowledge management with revisions and change notifications.

## Deployment pipeline
Workflow:
`.github/workflows/deploy-test.yml`

Triggers:
- deploy-relevant pushes to `test`
- manual `workflow_dispatch`

Pipeline:
1. checkout `test`
2. Node 22 + dependencies
3. verify Cloudflare GitHub Actions secrets
4. strict TypeScript typecheck
5. local D1 migrations
6. Wrangler dry run
7. remote D1 migrations
8. deploy TEST with `DEPLOY_REVISION=${GITHUB_SHA}`
9. verify `/health`

Required GitHub Actions repository secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Telegram runtime secrets remain Cloudflare Worker secrets and must not be copied into GitHub.

## Deployment online notification
`src/deployment_notice_entry.ts` handles deployment visibility.

After a successful `/health` request for a new `DEPLOY_REVISION`:
- send `🟢 Bot is Online!` to Bot Owner
- also send to current Sudo Admins
- include environment + short revision + PASS status
- use D1 revision marker so repeated health checks for the same deployment do not spam notifications

## Current migrations
- `0001_initial.sql`
- `0002_ai_settings.sql`
- `0003_handoff_persona.sql`
- `0004_shadow_monitoring.sql`
- `0005_dynamic_faq.sql`
- `0006_conversation_control_version.sql`
- `0007_latest_control_message.sql`
- `0008_monitoring_topic_provision_lock.sql`

## Current live validation focus
Before `main` promotion validate on TEST:
1. two or more different users can ask simultaneously and remain in separate topics
2. same user can send two near-simultaneous first messages without duplicate topics
3. no monitoring/handoff fallback mixes users in the main Staff Inbox chat
4. group handoff card stays inside the correct user's topic
5. Take Over affects only that user
6. latest-message Return to AI button moves correctly
7. stale in-flight AI answer is suppressed after Take Over/reset
8. online notification arrives once per deployed revision to Owner/Sudo Admins
9. runtime secrets/config remain intact after automated deploy

Do not merge `main` until these live checks are green.

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping. `NEW_CHAT_BOOTSTRAP.md` must represent the actual live repository handoff, not an older planned state.
