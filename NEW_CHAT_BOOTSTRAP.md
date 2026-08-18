# NEW CHAT BOOTSTRAP

Last updated: 2026-08-19
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant canonical docs/source

Live repository plus verified production evidence outranks remembered chat context.

## Current checkpoint
Main-only production Telegram FAQ assistant. FAQ and Human Staff are the primary continuity paths; grounded AI is supplementary.

Newest implementation on `main` adds **automatic staff availability state declarations to both private chat and Staff Inbox plus explicit timer/schedule cancellation**. Do not call this newest slice live-accepted until production workflow and Telegram acceptance are verified.

## Staff availability commands
Timezone is fixed to **Asia/Yangon / UTC+06:30**.

- `/available` → immediate available; clears recurring schedule
- `/unavailable` → unavailable indefinitely
- `/unavailable 3` → temporary unavailable for 3 hours
- positive fractional hours up to 168 supported
- `/available 09:00 17:00` → recurring daily schedule
- `/available 9am 5pm` → alias
- `/available 9:30am 5:30pm` → minute-resolution alias
- `/available 20:00 08:00` → overnight schedule
- `/unavailable cancel` or `/unavailable clear` → cancel temporary unavailable timer; recurring schedule resumes if present, otherwise available
- `/available cancel` or `/available clear` → remove recurring daily schedule and preserve the effective state at cancellation time as manual state

## Private + Staff Inbox contract
`/available` and `/unavailable` may be used by authorized staff in:
1. active Staff Inbox group, or
2. private bot chat only when an active Staff Inbox exists.

Private use is convenience only. Successful private mutations are mirrored once to Staff Inbox group root for team coordination. No Staff Inbox means private availability/cancel commands reject before mutation. `/noti` remains Staff-Inbox-only.

## Automatic transition notifications
Existing Cloudflare Cron remains `*/5 * * * *`.

`src/staff_presence.ts` detects persisted effective-state transitions:
- `timer_expired`
- `schedule_started`
- `schedule_ended`

`src/interaction_guard_entry.ts` announces each actual AVAILABLE↔UNAVAILABLE transition to:
- the affected staff member's private bot chat
- active Staff Inbox group root

The notice includes state, reason, Asia/Yangon timezone and current available-staff count.

Do not notify merely because a timer timestamp expired if the recurring schedule means the effective state stayed the same. The next real state change is the notification point. Persisted state prevents duplicate notices on later 5-minute sweeps.

## State precedence
1. active temporary-unavailable timer overrides schedule
2. timer expiry resumes recurring schedule if configured
3. timer expiry without schedule returns staff available
4. recurring schedule is daily Yangon-time state and may cross midnight
5. plain `/available` or `/unavailable` clears recurring schedule for manual mode
6. explicit `/available cancel` differs from plain `/available`: cancel preserves current effective state instead of forcing available

## Runtime ownership
- `src/staff_presence.ts` — effective state, timers, recurring schedule, cancel helpers, transition detection
- `src/staff_presence_entry.ts` — command parser, private/group authorization, cancel/clear UX, private→group mirror
- `src/interaction_guard_entry.ts` — scheduled human-control + staff-availability sweeps and auto-transition delivery
- `src/human_control_lease.ts` — 1-hour takeover expiry

## Migrations / manuals
Current migration range: `0001` through `0033`.

Newest migration:
- `0033_staff_availability_auto_notice_cancel.sql` — expands Owner/Admin command/manual sections with cancellation syntax and automatic dual-location transition notices

Previous availability migrations:
- `0031_staff_availability_schedule.sql`
- `0032_private_staff_availability_commands.sql`

## Command registry
Command names/order/count unchanged. `src/command_menu.ts` schema revision is **11**.

Public total 4; Sudo total 12; Owner total 19.

## Other durable contracts
- deterministic FAQ first
- meaningful FAQ miss under AI outage still routes to human staff
- AI outage notices are state-transition-only, not periodic
- Take Over uses persisted 1-hour inactivity lease; claimant activity renews; Cron auto-returns; Bot Owner can override immediately
- deployment online notice shows revision + deployed change summary
- production workflow validates typecheck, migrations, dry-run, bindings, health, webhook cutover and exact Owner command read-back

## Next exact validation
After production workflow is green:
1. confirm migration 0033 and command schema revision 11 deploy successfully
2. run controlled short `/unavailable` timer and verify exactly one private + one Staff Inbox auto-transition when state actually changes
3. verify later Cron run does not duplicate it
4. verify recurring schedule start and end each declare state to both locations
5. verify timer expiry during schedule off-hours does not falsely announce available
6. test `/unavailable cancel` and `/unavailable clear`
7. test `/available cancel` and `/available clear`
8. private cancellation must mirror to Staff Inbox
9. no active Staff Inbox → private cancellation rejects before mutation
10. existing FAQ/handoff, takeover lease, Owner override and AI fallback remain operational

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file and relevant manuals synchronized with repository reality.
