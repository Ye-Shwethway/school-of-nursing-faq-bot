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

## Staff Inbox notification semantics
`/noti off` does not disable monitoring, delete messages, or discard escalation cases. It only sets Telegram `disable_notification=true` for handoff/human-control group delivery. This avoids push-notification spam while preserving the operational record.

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

1. staff presence / notification commands + topic reply relay
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
0001 through 0012. Canonical 0012: `migrations/0012_staff_presence_notifications.sql`.

## Next exact work
1. verify the migration 0012 / presence-notification production run is green
2. live-smoke `/noti off` and confirm handoff messages remain visible but silent
3. mark all staff `/unavailable`, trigger an AI-failed inquiry, and confirm the unavailable copy
4. mark one staff `/available`, reply inside the user's topic, and confirm the user receives the staff message privately
5. continue directly on `main` in small validated slices

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
- optional future policy: automatically remove a revoked Sudo Admin from the Telegram Staff Inbox group
