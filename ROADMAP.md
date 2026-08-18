# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch and deployment policy
- `main` is the single active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- no TEST workflows or TEST deployments remain active.
- relevant `main` pushes run the single production pipeline automatically.

## Current foundation
Status: PRODUCTION LIVE; MAIN-ONLY PIPELINE ACTIVE; AI SETUP WORKING

Implemented:
- multilingual dynamic FAQ
- Owner/Sudo roles and scoped commands
- encrypted configurable AI Primary/Fallback
- grounded AI + human handoff
- Staff Inbox monitoring and Take Over / Return to AI
- editable/addable Owner/Admin manuals
- production D1 bootstrap completed
- production Telegram webhook cutover completed
- Owner command registry verified through Telegram read-back
- TEST deployment notices suppressed at runtime
- TEST/one-time workflow clutter retired
- production runtime-binding preflight/postflight checks
- AI API-key setup catches encryption/configuration failures and returns an explicit Owner-visible error instead of silently stopping
- `/language` is a visible public command for all users and therefore inherited by Sudo/Admin and Owner command sets
- Sudo Admin grant also enables staff authorization and provisions private Staff Inbox access
- Staff Inbox can be explicitly switched to a new Telegram group from `/staff`
- Owner-only `/clearmessage` cleanup for the active Staff Inbox with confirmation, permission diagnostics and tracked-message deletion

## Verified production checkpoint
- production D1 and Worker are healthy
- production operational-data bootstrap completed green
- production Telegram webhook cutover completed green
- `/start` works through production
- `BOT_OWNER_TELEGRAM_ID` is configured as a Cloudflare `secret_text` binding
- `AI_CONFIG_MASTER_KEY` is configured as a valid Cloudflare `secret_text` binding
- production Gemini provider setup is working
- `/language` is visible in the live Telegram command menu
- 14-command Owner registry including `/clearmessage` has passed exact Telegram read-back

## AI configuration contract
`AI_CONFIG_MASTER_KEY` must be Base64 representing exactly 32 random bytes. It is used as the AES-GCM key for encrypting provider credentials in D1.

Changing the master key invalidates credentials encrypted with an older master key; those provider credentials must be entered again through `/ai`.

`secure_entry.ts` catches AI setup encryption/configuration exceptions, best-effort deletes submitted secret input, and sends a clear recovery message to the Owner instead of allowing the webhook path to fail silently.

## Sudo Admin and Staff Inbox access
`/sudo grant <telegram_user_id>` remains Owner-only and uses the canonical immutable Telegram user ID.

After a successful grant:
- the user is enabled in `staff_members`
- the user's Telegram command scope is refreshed best-effort
- if a Staff Inbox group is configured, the bot checks whether the user is already a member
- otherwise the bot creates a bot-owned one-use Staff Inbox invite link and sends it to the new Sudo Admin privately
- if Telegram will not allow the bot to DM that user, the one-use link is sent to the Owner as a fallback
- if invite creation fails, the Owner is told to verify that the bot is a group administrator with permission to invite users

Telegram Bot API does not provide the bot with a general force-add-user operation for this workflow, so private invite-link delivery is the canonical access path.

`/sudo revoke <telegram_user_id>` removes the Sudo role and disables the user's bot-side staff authorization. Removing an already joined user from the Telegram group remains a separate group-membership action unless a future explicit auto-kick policy is added.

## Staff Inbox switching
Open `/staff` inside the desired Telegram group and choose `Use / Switch to this Staff Inbox`.

When switching from an old group to a new group:
- `staff_inbox_chat_id` is replaced with the new group ID
- handoff route is set to `group`
- all new inquiries and monitoring use the new group
- monitoring topics are naturally isolated by `(user, staff_chat_id)`, so new topics are created in the new group as needed
- historical mappings/messages in the old group are retained as history but are no longer the active destination
- deleting/leaving the old Telegram group is an Owner-side Telegram action, not required for the bot-side switch

## Staff Inbox cleanup
Migration `0011_group_message_cleanup.sql` adds `group_message_ledger` for observed Staff Inbox message IDs.

`/clearmessage` is Owner-only and works only inside the currently active Staff Inbox. It shows a destructive-action confirmation before deleting anything.

The first production implementation treated successful `deleteMessages` calls as proof that every requested ID was deleted. Telegram documents that missing IDs may be silently skipped, so that count was not reliable and is retired.

Current cleanup behavior:
- verifies the bot's own Telegram membership/admin state before showing confirmation
- for supergroups, requires administrator `can_delete_messages`; creator status also passes
- reads `getMe.can_read_all_group_messages` for privacy-mode diagnostics
- selects only actual message IDs present in `group_message_ledger`
- verifies deletion one message at a time with `deleteMessage`; an ID counts as deleted only when Telegram returns `result=true`
- captures Telegram's error description for failures instead of silently swallowing them
- removes only confirmed-deleted IDs from the ledger
- sends the Owner a private result containing confirmed-deleted count, failed count, tracked-ID count, privacy-mode diagnostic, and first Telegram error if any
- one cleanup considers at most the newest 5,000 tracked messages younger than the Telegram deletion window

Telegram Bot API permits deletion only for messages younger than 48 hours. The bot must be a group administrator with the appropriate deletion right to delete other users' messages. Bot admins receive ordinary group messages; `getMe.can_read_all_group_messages=true` additionally indicates that global Group Privacy Mode is disabled. The Bot API does not expose general chat-history retrieval, so messages that predate ledger observation cannot be guaranteed to be discovered retroactively.

## Single production workflow
Canonical workflow: `.github/workflows/deploy-production.yml`

Relevant `main` pushes perform:
1. production credential and runtime-binding preflight
2. dependency install
3. typecheck
4. isolated production Wrangler config generation
5. local D1 migration validation
6. production Worker dry-run bundle validation
7. remote production D1 migrations
8. production Worker deploy
9. runtime-binding postflight
10. production `/health` verification requiring `environment=production`
11. one-time nonce-gated Owner command resync
12. exact Telegram `getMyCommands` read-back of all 14 Owner commands

Only this workflow remains active in `.github/workflows`.

## Command registry
Public commands visible to every user:
`/start`, `/language`, `/whoami`.

Sudo Admin inherits the public set and adds:
`/admin`, `/admins`, `/faq`, `/adminmanual`.

Expected Owner commands:
`/start`, `/language`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.

Command schema revision is bumped whenever a visible command set changes so Telegram registration is refreshed.

## Environment isolation rule
`notifyDeploymentOnline()` is production-only. Historical TEST runtime must not inject deployment messages into the live Owner chat.

## Canonical Worker stack
Wrangler enters `src/clear_message_entry.ts`.

1. Staff Inbox message ledger + Owner `/clearmessage`
2. manual pager/edit/add + command sync
3. deployment notice + production ops endpoints
4. latest Return-to-AI control
5. monitoring presentation / isolated handoff
6. Staff Inbox UX + Sudo-to-staff access lifecycle
7. Telegram UX polish
8. secure AI setup interception
9. dynamic FAQ/AI runtime
10. compatibility fallback + `/health`

## Next exact work
1. verify the per-message-confirmed `/clearmessage` production deployment completes green
2. send fresh disposable messages in the active Staff Inbox after that deployment, then run `/clearmessage`
3. inspect the Owner result: confirmed-deleted, failed, tracked IDs, privacy mode, first Telegram error
4. if fresh incoming group messages are tracked/deleted correctly, expand ledger coverage for downstream bot-originated Staff Inbox messages
5. continue feature work directly on `main` in small validated slices

## Current migrations
0001 through 0011. Canonical 0011: `migrations/0011_group_message_cleanup.sql`.

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
- optional future policy: automatically remove a revoked Sudo Admin from the Telegram Staff Inbox group
- broader ledger coverage for every bot-originated Staff Inbox control/monitoring message
