# ROADMAP

Last updated: 2026-08-19

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Deterministic FAQ first, Human Staff continuity second, grounded AI as supplementary help.

## Repository policy
- `main` is canonical development + production.
- historical `test` is dormant/reference-only.
- relevant main pushes run the production workflow.

## Current checkpoint
Live-accepted foundations include FAQ-first onboarding, Telegram webhook cutover, AI credential setup, Owner takeover override, reboot `Change:` metadata, and the previously deployed staff-availability private/group UX.

Newest `main` slice adds:
1. **automatic staff availability transition notices to both staff private chat and Staff Inbox**
2. **explicit cancellation for temporary-unavailable timers and recurring schedules**

Do not call this newest slice live-accepted until production workflow + Telegram validation is complete.

## Staff availability contract
Timezone: **Asia/Yangon / UTC+06:30**.

Supported syntax:
- `/available` — immediately available; clears recurring schedule
- `/unavailable` — unavailable indefinitely
- `/unavailable 3` — temporary unavailable for 3 hours; positive fractional hours up to 168 are allowed
- `/available 09:00 17:00` — recurring daily schedule
- `/available 9am 5pm` — alias
- `/available 20:00 08:00` — overnight schedule
- `/unavailable cancel` or `/unavailable clear` — cancel active temporary timer; recurring schedule resumes if configured, otherwise staff becomes available
- `/available cancel` or `/available clear` — remove recurring daily schedule and preserve the effective state at cancellation time as the new manual state

`/available` and `/unavailable` may be used in the active Staff Inbox or authorized staff private bot chat. Private use requires an active Staff Inbox and every successful private mutation is mirrored once to the group root. `/noti` remains Staff-Inbox-only.

## Effective-state precedence
1. active temporary unavailable timer overrides recurring schedule
2. timer expiry with a schedule resumes schedule-derived state
3. timer expiry without a schedule returns staff to available
4. recurring schedule is daily Yangon-time state and supports overnight windows
5. staff counts evaluate timer/schedule state directly
6. staff topic reply may clear a temporary timer but preserves recurring schedule

## Automatic transition declaration
Existing Cloudflare Cron remains `*/5 * * * *`.

`src/staff_presence.ts` returns transitions only when effective availability actually changes:
- `timer_expired`
- `schedule_started`
- `schedule_ended`

`src/interaction_guard_entry.ts` sends each transition to:
- affected staff private bot chat
- active Staff Inbox group root

Notice includes resulting AVAILABLE/UNAVAILABLE state, transition reason, Asia/Yangon timezone, and available-staff count.

If a timer expires but a recurring schedule means the effective state remains unchanged, no misleading transition notice is sent. Persisted state prevents duplicate notices on later Cron sweeps. Practical transition latency is 0–5 minutes.

## Staff availability migrations
- `0031_staff_availability_schedule.sql` — timer/schedule persistence
- `0032_private_staff_availability_commands.sql` — private invocation + group mirror/manuals
- `0033_staff_availability_auto_notice_cancel.sql` — automatic-transition and cancel/clear manual guidance

## Command registry
Command names/order/count remain unchanged. Schema revision is now **11** so updated availability descriptions resync.

Public total: 4. Sudo total: 12. Owner total: 19.

## Existing continuity contracts
- FAQ and Human Staff are primary continuity; AI outages never sever staff handoff.
- AI outage alerts are transition-only: one outage notice, no repeats while still down, one recovery notice.
- Human Take Over uses a persisted 1-hour inactivity lease; claimant activity renews it; Cron auto-returns expired claims; Owner may override immediately.
- Production deploy validates typecheck, migrations, dry-run, bindings, health, Telegram webhook, and exact Owner command registry.
- `DEPLOY_REVISION` + `DEPLOY_CHANGE` appear in the online notice when available.

## Canonical runtime ownership
- `src/interaction_guard_entry.ts` — flood guard + scheduled takeover/staff sweeps + automatic staff availability notices
- `src/staff_presence.ts` — effective staff presence, timers, schedules, cancel helpers, transition detection
- `src/staff_presence_entry.ts` — availability command parsing, private/group routing, cancellation UX, private→group mirror
- `src/human_control_lease.ts` — takeover expiry
- `src/ai_runtime.ts` / `src/ai_outage_alert.ts` — grounded AI + outage/recovery visibility

## Migrations
Current range: `0001` through `0033`.

## Validation boundary
Newest slice requires:
1. production workflow green including migration 0033
2. Owner command registry remains exact 19/19 under revision 11
3. controlled short temporary unavailable timer produces initial update, then exactly one private + one Staff Inbox automatic transition on effective state change
4. later Cron does not duplicate that transition
5. schedule start/end each declare the correct state to both locations
6. timer expiry during scheduled off-hours does not falsely announce AVAILABLE
7. `/unavailable cancel` and `clear` cancel temporary timer and resume schedule when present
8. `/available cancel` and `clear` remove recurring schedule while preserving current effective state
9. private cancellation mirrors to Staff Inbox
10. no Staff Inbox configured means private availability/cancel operations reject before mutation
11. existing FAQ, human handoff, takeover lease, Owner override, and AI fallback continue working
