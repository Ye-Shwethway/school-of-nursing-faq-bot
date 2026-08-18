# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence
Read in order:
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. task-relevant source/docs only

Treat live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Current checkpoint
Production FAQ, AI, Telegram webhook, Owner identity, Staff Inbox, Sudo provisioning, main-only deployment and visible `/language` are working. `/clearmessage` is retained as a best-effort utility because Telegram history/deletion behavior limits full cleanup guarantees.

The current deployment slice adds Staff Inbox notification control, explicit staff availability, unavailable-user messaging, and staff-topic reply relay back to users.

## Staff presence / notification slice
Migration `0012_staff_presence_notifications.sql` adds:
- `staff_presence`
- `staff_notifications_enabled` bot setting

Wrangler entrypoint is now `src/staff_presence_entry.ts`, wrapping `src/clear_message_entry.ts`.

Active Staff Inbox commands:
- `/noti on`
- `/noti off`
- `/available`
- `/unavailable`

Owner, Sudo Admins and active staff can use these commands in the active Staff Inbox. `/noti`, `/available`, `/unavailable` are visible in Owner/Sudo command menus.

`/noti off` is notification-only: handoff/human-control messages remain stored and visible in the Staff Inbox but are sent with `disable_notification=true`.

Active staff without an explicit presence row default to available. `/unavailable` marks the actor unavailable; `/available` restores availability.

## Unavailable handoff behavior
If deterministic FAQ and grounded AI both cannot answer:
- escalation is still stored and routed to the Staff Inbox topic
- when at least one staff member is available, the user receives normal human-handoff copy
- when available staff count is zero, the user is told that no staff are currently available, the question has been retained, and they should try again later

This avoids falsely promising immediate staff review when nobody is available.

## Staff reconnect / reply behavior
Authorized staff can later write a normal text message inside the affected user's Staff Inbox topic.

`src/staff_presence_entry.ts`:
- maps `(staff_chat_id, message_thread_id)` back to the original Telegram user through `monitoring_topics`
- marks the replying staff member available
- takes human control when the conversation is not already claimed by someone else
- relays the staff text to the user's private chat prefixed as a School of Nursing staff reply
- leaves another staff member's existing claim intact instead of stealing control

If Telegram cannot deliver the private reply, an error is posted silently in the topic.

## Command registry
Public:
`/start`, `/language`, `/whoami`.

Sudo Admin adds:
`/admin`, `/admins`, `/faq`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.

Owner additionally has:
`/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.

Command schema revision: `5`.
Production exact Owner read-back target: 17 commands.

## Existing critical contracts
- `AI_CONFIG_MASTER_KEY` is a Cloudflare `secret_text` containing Base64 for exactly 32 random bytes.
- Sudo grant enables staff authorization and provisions a one-use Staff Inbox invite when needed.
- `/staff` inside a new group can switch the active Staff Inbox.
- `/clearmessage` remains Owner-only and best-effort.
- runtime contract remains `Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`.

## Canonical Worker stack
1. `staff_presence_entry.ts` — staff availability, `/noti`, topic reply relay
2. `clear_message_entry.ts` — best-effort Staff Inbox cleanup
3. `manual_entry.ts` — manuals + command sync
4. `deployment_notice_entry.ts` — production ops/deploy notice
5. `latest_return_entry.ts` — Return-to-AI control
6. `monitoring_message_entry.ts` — FAQ/AI/handoff + availability-aware copy
7. `staff_ux_entry.ts` — Staff Inbox UX + Sudo invite lifecycle
8. `ux_entry.ts`
9. `secure_entry.ts`
10. `runtime_entry.ts`
11. `index.ts`

## Current migrations
0001 through 0012; canonical 0012 is `migrations/0012_staff_presence_notifications.sql`.

## Next exact sequence
1. verify migration 0012 + 17-command production deployment green
2. test `/noti off` then trigger handoff and confirm group message remains but arrives silently
3. mark all staff `/unavailable`, trigger an unanswered question, confirm unavailable copy
4. mark one staff `/available`, reply in the user topic, confirm private relay to user
5. continue directly on `main`

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping.
