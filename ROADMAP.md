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
Status: PRODUCTION LIVE; MAIN-ONLY PIPELINE ACTIVE

Implemented:
- multilingual dynamic FAQ
- Owner/Sudo roles and scoped commands
- encrypted configurable AI Primary/Fallback
- grounded AI + human handoff
- Staff Inbox monitoring and Take Over / Return to AI
- editable/addable Owner/Admin manuals
- Staff Inbox switching and Sudo invite provisioning
- Owner `/clearmessage` best-effort cleanup
- visible `/language` for all users
- staff notification toggle and staff availability state
- staff-topic reply relay back to the original user
- returning-unavailable staff pending-inquiry reminder with inline availability choice
- Owner/Admin manuals include the current staff-operations commands and reconnect workflow

## Staff notifications and availability
Migration `0012_staff_presence_notifications.sql` adds `staff_presence` and the `staff_notifications_enabled` setting.

Active Staff Inbox group commands:
- `/noti on` — handoff/human-control group messages may trigger normal Telegram notifications
- `/noti off` — messages remain in the group but are sent silently
- `/available` — mark the current authorized staff member available
- `/unavailable` — mark the current authorized staff member unavailable

These commands are accepted from the Bot Owner, Sudo Admins, and active staff members inside the active Staff Inbox. `/noti`, `/available`, and `/unavailable` are visible in Owner/Sudo command menus. Command schema revision is 5.

Existing active staff without a `staff_presence` row are treated as available until they explicitly mark unavailable.

When FAQ + AI cannot answer:
- the escalation case/topic is still created and retained
- if at least one active staff member is available, the user receives the normal staff-handoff message
- if available staff count is zero, the user is told that staff are currently unavailable, the question is retained, and they should try again later

When staff later return, an authorized staff member can write inside that user's Staff Inbox topic. The bot resolves the topic -> Telegram user mapping, takes human control if available, and relays the staff text to the user's private chat as a School of Nursing staff reply. The staff member is also marked available on successful reply handling.

## Returning unavailable staff prompt
When an authorized staff member is currently marked unavailable and later interacts with the bot in private chat, the bot checks for open escalation cases.

If new pending inquiries exist since that staff member last acknowledged the reminder, the bot sends a private prompt showing the pending count with:
- `✅ Mark me Available & Review` — marks the staff member available and directs them to review waiting Staff Inbox topics
- `⏸ Stay Unavailable` — leaves their availability unchanged and keeps cases queued

The newest pending case ID is stored as a per-staff acknowledgement in `bot_settings`, so the same pending set does not generate repeated reminders. A later newly-created open case can trigger a fresh reminder.

## Staff Inbox notification semantics
`/noti off` does not disable monitoring, delete messages, or discard escalation cases. It only sets Telegram `disable_notification=true` for handoff/human-control group delivery. This avoids push-notification spam while preserving the operational record.

## Manual coverage
Migration `0013_manual_staff_operations.sql` adds a new operational section to both manuals without overwriting existing editable sections.

Migration `0014_manual_returning_staff_prompt.sql` documents the returning-staff pending-inquiry reminder and its two inline availability choices in both Owner and Admin manuals.

Owner Manual coverage includes `/language`, `/noti`, `/available`, `/unavailable`, `/clearmessage`, Staff Inbox switching, unavailable-staff behavior, returning-staff reminders, and later topic-reply reconnect.

Admin Manual coverage includes `/language`, `/noti`, `/available`, `/unavailable`, Take Over / Return to AI context, returning-staff reminders, and topic-reply reconnect. Owner-only controls remain explicitly identified as Owner-only.

## AI configuration contract
`AI_CONFIG_MASTER_KEY` must be a Cloudflare `secret_text` containing Base64 for exactly 32 random bytes. Credentials encrypted with an older master key must be entered again through `/ai` after key rotation.

## Staff Inbox switching
Open `/staff` inside the desired Telegram group and choose `Use / Switch to this Staff Inbox`. New handoff and monitoring traffic then uses that group; old group history remains historical only.

## Sudo access
Owner `/sudo grant <telegram_user_id>` grants Sudo, enables staff authorization, refreshes command scope best-effort, and provisions a one-use Staff Inbox invite if needed. `/sudo revoke` removes Sudo and disables bot-side staff authorization.

## Staff Inbox cleanup
`/clearmessage` remains Owner-only and best-effort. Telegram deletion/history limitations prevent it from being treated as a guaranteed full-history purge.

## Single production workflow
Canonical workflow: `.github/workflows/deploy-production.yml`.

Relevant `main` pushes perform install, typecheck, local migration validation, production bundle validation, remote D1 migrations, Worker deploy, runtime-binding checks, production health verification, and exact Telegram Owner-command read-back.

Expected Owner commands (17):
`/start`, `/language`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/noti`, `/available`, `/unavailable`, `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.

## Canonical Worker stack
Wrangler entrypoint: `src/staff_presence_entry.ts`.

1. staff presence / notification commands + returning-staff pending reminder + topic reply relay
2. Staff Inbox cleanup wrapper
3. manual + command sync
4. deployment notice / ops endpoints
5. Return-to-AI control
6. monitoring/handoff runtime
7. Staff Inbox UX + Sudo invite lifecycle
8. Telegram UX
9. secure AI setup
10. dynamic FAQ/AI runtime
11. compatibility fallback + `/health`

## Current migrations
0001 through 0014. Canonical 0014: `migrations/0014_manual_returning_staff_prompt.sql`.

## Next exact work
1. verify the returning-staff prompt + migration 0014 production run is green
2. mark one staff unavailable, create a new unanswered inquiry, then use the bot privately as that staff member
3. verify the pending-count prompt appears once, `Stay Unavailable` preserves presence, and `Mark me Available & Review` restores availability
4. continue directly on `main` in small validated slices

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
- optional future policy: automatically remove a revoked Sudo Admin from the Telegram Staff Inbox group
