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
- Sudo Admin grant now also enables staff authorization and provisions private Staff Inbox access
- Staff Inbox can be explicitly switched to a new Telegram group from `/staff`

## Verified production checkpoint
- production D1 and Worker are healthy
- production operational-data bootstrap completed green
- production Telegram webhook cutover completed green
- `/start` works through production
- `BOT_OWNER_TELEGRAM_ID` is configured as a Cloudflare `secret_text` binding
- `AI_CONFIG_MASTER_KEY` is configured as a valid Cloudflare `secret_text` binding
- production Gemini provider setup is working
- `/language` is visible in the live Telegram command menu

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
12. exact Telegram `getMyCommands` read-back of all 13 Owner commands

Only this workflow remains active in `.github/workflows`.

## Command registry
Public commands visible to every user:
`/start`, `/language`, `/whoami`.

Sudo Admin inherits the public set and adds:
`/admin`, `/admins`, `/faq`, `/adminmanual`.

Expected Owner commands:
`/start`, `/language`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

Command schema revision is bumped whenever a visible command set changes so Telegram registration is refreshed.

## Environment isolation rule
`notifyDeploymentOnline()` is production-only. Historical TEST runtime must not inject deployment messages into the live Owner chat.

## Canonical Worker stack
Wrangler enters `src/manual_entry.ts`.

1. manual pager/edit/add + command sync
2. deployment notice + production ops endpoints
3. latest Return-to-AI control
4. monitoring presentation / isolated handoff
5. Staff Inbox UX + Sudo-to-staff access lifecycle
6. Telegram UX polish
7. secure AI setup interception
8. dynamic FAQ/AI runtime
9. compatibility fallback + `/health`

## Next exact work
1. verify the Sudo invite / Staff Inbox switch production deployment completes green
2. live-smoke one Sudo grant to a user who has already started the bot
3. verify one-use Staff Inbox invite delivery and successful join
4. live-smoke Staff Inbox switch only when a replacement group is actually needed
5. continue feature work directly on `main` in small validated slices

## Current migrations
0001 through 0010. Canonical 0010: `migrations/0010_manual_newline_cleanup.sql`.

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
- optional future policy: automatically remove a revoked Sudo Admin from the Telegram Staff Inbox group
