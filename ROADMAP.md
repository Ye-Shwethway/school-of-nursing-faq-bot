# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch policy
- `test` = active development / live TEST validation
- `main` = verified canonical / production
- no direct implementation on `main`
- promote only after TEST behavior is green

## Locked architecture
- Telegram webhook on Cloudflare Workers + D1
- normal users: `/start`, `/whoami`
- role-scoped command menus synced automatically with Telegram `setMyCommands`
- immutable Telegram numeric IDs for authority
- dynamic D1 FAQ knowledge + revisions
- deterministic FAQ -> grounded Primary AI -> grounded Fallback AI -> Human Handoff
- AI/config failures fail closed to human review
- Owner/Sudo Admin management, separate staff responder allow-list
- Staff Inbox group with per-user forum topics or dedicated private responder
- anonymous staff relay
- atomic Take Over / Return to AI
- editable Owner/Admin operating manuals stored separately from FAQ knowledge
- public repo; no plaintext runtime credentials

## Foundation through live TEST
Status: COMPLETE / FUNCTIONAL ON `test`

Verified live capabilities include:
- 22 multilingual FAQ seeds
- Owner/Sudo roles, identity display, `/whoami`
- encrypted configurable AI providers/models
- Gemini grounded answer path
- dynamic FAQ CRUD
- Staff Inbox binding and group routing
- shadow monitoring
- human Take Over / Return to AI
- direct GitHub Actions -> Cloudflare TEST deployment

`main` and production remain unpromoted.

## Current canonical Worker stack
Wrangler enters:

`src/manual_entry.ts`

Layer order:
1. `manual_entry.ts` — editable Owner/Admin manuals
2. `deployment_notice_entry.ts` — revision-aware online notification after successful health check
3. `latest_return_entry.ts` — latest-message Return to AI control during human takeover
4. `monitoring_message_entry.ts` — user/model-aware staff mirror headers and isolated inquiry/handoff presentation
5. `staff_ux_entry.ts` — group-native `/staff` inline control panel and topic identity polish
6. `ux_entry.ts` — typing indicator, reply-to, Close/Back, `/cancel`, `/reset`, stale-AI guard
7. `secure_entry.ts` — secret/setup routing guard
8. `runtime_entry.ts` — dynamic FAQ / AI / command integration
9. `index.ts` — retained fallback / compatibility runtime

Do not bypass or independently reconstruct this stack.

## Editable operating manuals
Status: IMPLEMENTED ON `test`; LIVE TEST PENDING

Commands:
- `/ownermanual` — Owner read/edit
- `/adminmanual` — Owner read/edit; Sudo Admin read-only

Manual content is written for ordinary operators, not developers. It explains:
- Bot / AI / Human Staff layers
- normal question path
- role-specific commands
- FAQ maintenance
- AI setup/primary/fallback behavior
- Staff Inbox, monitoring, Take Over, Return to AI
- deployment-online notices
- authority and safety boundaries

Migration 0009 adds:
- `manual_sections`
- `manual_revisions`

Owner edit workflow:
`Open manual -> Edit a section -> choose section -> send replacement text -> Preview -> Save/Discard`

`/cancel` aborts a pending manual edit. Each saved change increments section version and archives the previous text.

Manual storage is isolated from FAQ storage and must never affect deterministic FAQ matching or AI grounding.

See `docs/OPERATOR_MANUALS.md`.

## Telegram UX polish
Implemented on `test`:
- native `typing` refresh during AI generation
- AI/handoff replies attach to original user question
- `✕ Close`, edit-in-place navigation, consistent Back/Cancel semantics
- `/cancel` = current wizard/setup only
- `/reset` = transient conversation/session reset only; persistent FAQ/AI/admin settings preserved
- Owner command menu includes `/cancel` and `/reset`
- `/staff` inside the group opens an inline control panel
- Staff Inbox can be bound from the current group without copying a group ID
- role-scoped command menu includes `/adminmanual` for Sudo Admins and both manuals for Owner

## Staff monitoring presentation
Each user has a separate Staff Inbox forum topic.

Topic title:
`Name · @username · ID 123456789`

Mirror headers:
- `USER · Name (@username) · ID 123456789`
- `BOT · FAQ`
- `AI · provider/model`
- human-control USER header includes `Human control`

## Conversation and concurrency hardening
Migration 0006 — `conversation_control.control_version`
- Take Over / Return to AI / `/reset` increment version
- in-flight AI output is discarded after control changes

Migration 0007 — `monitoring_topics.latest_control_message_id`
- only the newest human-control USER message carries `Return to AI`
- new USER message moves the button down and removes the older button

Migration 0008 — `monitoring_topic_provision_locks`
- same-user concurrent first messages cannot independently create duplicate forum topics
- one request provisions; competitors wait for the canonical mapping
- stale locks recover after 30 seconds
- monitoring/group-handoff delivery fails closed if an isolated topic cannot be established
- no fallback that mixes users into the Staff Inbox main chat

## Multiuser contract
Different Telegram users are independent across:
- language/user profile
- question logs
- conversation control
- AI/human takeover state
- monitoring topic
- human claimant

Group monitoring and group handoff are isolated by `(telegram_user_id, staff_chat_id) -> message_thread_id`.

A Take Over for User A must not pause User B or User C.

## Deployment visibility
GitHub workflow `.github/workflows/deploy-test.yml` automatically runs on deploy-relevant pushes to `test` and remains manually dispatchable.

Pipeline:
1. install dependencies
2. strict typecheck
3. local D1 migration validation
4. Wrangler dry run
5. remote D1 migrations
6. deploy TEST Worker with `DEPLOY_REVISION=${GITHUB_SHA}`
7. verify `/health`

A new deployed revision sends `🟢 Bot is Online!` once to the configured Owner plus current Sudo Admins after a successful health request. Duplicate health checks for the same revision do not resend the notice.

## Current migrations
- 0001 initial
- 0002 AI settings
- 0003 handoff/persona
- 0004 shadow monitoring
- 0005 dynamic FAQ
- 0006 conversation control version
- 0007 latest control message
- 0008 monitoring topic provision lock
- 0009 editable operating manuals

## Current validation focus
Before `main` promotion, keep testing bounded to live behavior:
- Owner `/ownermanual` renders and edit Preview/Save/Discard works
- Sudo Admin `/adminmanual` renders read-only
- manual edits do not alter FAQ/AI knowledge behavior
- multiple simultaneous users create/use distinct topics
- same user sends two near-simultaneous first messages without duplicate topics
- group handoff card remains inside the correct user topic
- Take Over only affects that user
- latest-message Return to AI button moves correctly
- online deployment notification reaches Owner/Sudo Admins once per revision
- no secrets/config regression after automated deployment

## Later slice
After live-green operational validation:
- latency / route telemetry without secrets
- provider/model performance comparison
- answer presentation polish only where live UX shows a real need
