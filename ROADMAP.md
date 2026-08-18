# ROADMAP

Last updated: 2026-08-18

## Goal

Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch and deployment policy

- `main` is the single active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- no TEST workflow or TEST deployment is active.
- relevant `main` pushes run the single production validation/deployment workflow automatically.

## Current production checkpoint

Status: **PRODUCTION LIVE; MAIN-ONLY PIPELINE ACTIVE; CURRENT OPERATIONAL SLICES WORKING**

Implemented and live:

- multilingual dynamic FAQ
- visible `/language` for all users
- Owner/Sudo roles and scoped command menus
- encrypted configurable AI Primary/Fallback
- grounded AI + human handoff
- Staff Inbox per-user topic monitoring
- Take Over / Return to AI
- Sudo grant with staff authorization and Staff Inbox invite provisioning
- Staff Inbox switching from `/staff`
- Owner `/clearmessage` retained as best-effort only because Telegram deletion/history behavior prevents full-purge guarantees
- `/noti on|off` notification control
- `/available` / `/unavailable` staff presence
- all-staff-unavailable user messaging
- staff-topic reply relay back to the original user
- returning-unavailable staff pending-inquiry reminder with inline availability choice
- editable/addable Owner/Admin manuals
- Owner/Admin manuals updated for current staff operations
- stale TEST deployment guidance removed from Owner manual
- repository documentation reconciled to the main-only production architecture

## Staff notifications and availability

Migration `0012_staff_presence_notifications.sql` adds `staff_presence` and `staff_notifications_enabled`.

Active Staff Inbox commands:

- `/noti on` — normal Staff Inbox notification behavior
- `/noti off` — keep messages/cases visible but send them silently
- `/available` — mark current authorized staff available
- `/unavailable` — mark current authorized staff unavailable

These commands are accepted from Owner, Sudo Admins, and active staff inside the active Staff Inbox where server-side authorization/context checks pass.

Active staff without an explicit presence row default to available until they mark unavailable.

## Human continuity

When deterministic FAQ and grounded Primary/Fallback AI cannot answer:

- escalation remains stored and routed
- if at least one active staff member is available, user receives normal staff-handoff copy
- if available staff count is zero, user is told staff are currently unavailable, the question is retained, and they should try again later

Authorized staff can later reply inside that user's Staff Inbox topic. The bot maps the topic back to the original Telegram user, takes human control when allowed, marks the replying staff member available, and relays the staff text to the user's private chat without exposing staff identity.

## Returning unavailable staff prompt

When an authorized staff member is still marked unavailable and later interacts with the bot privately, the bot checks for open escalation cases.

If new pending cases exist since that staff member last acknowledged the reminder, it shows:

- `✅ Mark me Available & Review`
- `⏸ Stay Unavailable`

The newest pending case ID is stored as a per-staff acknowledgement so the same pending set does not repeatedly generate reminders. A newly-created open case can trigger a fresh reminder.

## Staff Inbox notification semantics

`/noti off` is notification-only. It does not disable monitoring, delete messages, or discard escalation cases.

## Manuals

Manual storage/revision foundation:

- `0009_manuals.sql`
- `0010_manual_newline_cleanup.sql`

Current manual sync migrations:

- `0013_manual_staff_operations.sql`
- `0014_manual_returning_staff_prompt.sql`
- `0015_owner_manual_main_only_cleanup.sql`

`0015` archives the old Owner deployment/safety bodies in manual revision history and replaces stale TEST guidance with the current main-only production model.

## AI configuration contract

`AI_CONFIG_MASTER_KEY` must be a Cloudflare `secret_text` containing Base64 for exactly 32 random bytes. Credentials encrypted with an older key must be re-entered through `/ai` after key rotation.

## Sudo access

Owner `/sudo grant <telegram_user_id>` grants Sudo authority, enables staff authorization, refreshes command scope best-effort, and provisions a one-use Staff Inbox invite when needed.

`/sudo revoke` removes Sudo authority and disables bot-side staff authorization. Automatic removal of an already-joined Telegram group member is not currently enabled.

## Staff Inbox cleanup

`/clearmessage` is Owner-only and best-effort. It must not be treated as a guaranteed full-history purge.

## Command registry

Public (3):

`/start`, `/language`, `/whoami`

Sudo Admin additionally:

`/admin`, `/admins`, `/faq`, `/adminmanual`, `/noti`, `/available`, `/unavailable`

Owner additionally:

`/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`

Expected Owner total: **17**. Command schema revision: **5**.

## Single production workflow

Canonical workflow: `.github/workflows/deploy-production.yml`.

Relevant `main` pushes perform:

1. production credentials/runtime-binding preflight
2. dependency install
3. typecheck
4. isolated production config generation
5. local migration validation
6. Worker dry-run validation
7. remote production migrations
8. production Worker deploy
9. runtime-binding postflight
10. production `/health`
11. nonce-gated Owner command resync
12. exact Telegram Owner command read-back

## Canonical Worker stack

Wrangler entrypoint: `src/staff_presence_entry.ts`.

1. staff availability / `/noti` / returning-staff reminder / topic reply relay
2. best-effort Staff Inbox cleanup
3. manuals + command synchronization
4. production deploy notice / ops endpoints
5. latest Return-to-AI control
6. monitoring / FAQ / AI / human handoff
7. Staff Inbox UX + Sudo invite lifecycle
8. Telegram UX/navigation polish
9. secure AI setup interception
10. dynamic FAQ/AI runtime
11. compatibility fallback + `/health`

## Current migrations

`0001` through `0015`.

Latest canonical migration: `migrations/0015_owner_manual_main_only_cleanup.sql`.

## Documentation checkpoint

Repository docs were reconciled on 2026-08-18. Current docs must describe the main-only production model; retired TEST deployment/promote workflows are historical only and must not be reintroduced as active architecture.

## Next work

There is no active required feature slice at this checkpoint. Continue only from a new explicit product requirement or a verified production defect.

When new work begins, use the live repository and verified production evidence as authority, implement on `main` in small bounded slices, and update this file plus `NEW_CHAT_BOOTSTRAP.md` after meaningful changes.

## Deferred validation / optional future work

- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
- optional policy: automatically remove a revoked Sudo Admin from the Telegram Staff Inbox group
