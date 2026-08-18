# ROADMAP

Last updated: 2026-08-19

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Deterministic FAQ first, Human Staff continuity second, grounded AI as supplementary help.

## Repository policy
- `main` is canonical development + production.
- historical `test` is dormant/reference-only.
- relevant main pushes run the production workflow.

## Current checkpoint
Newest `main` slice corrects staff availability semantics so a recurring daily schedule is **durable** and plain `/available` or `/unavailable` only overrides the current schedule interval. Production/live acceptance is still required for this newest slice.

## Staff availability contract
Timezone: **Asia/Yangon / UTC+06:30**.

Supported syntax:
- `/available 09:00 17:00` or `/available 9am 5pm` — create/update recurring daily schedule
- `/available` — if a recurring schedule exists, immediately force AVAILABLE only until the next schedule start/end boundary; otherwise set manual AVAILABLE indefinitely
- `/unavailable` — if a recurring schedule exists, immediately force UNAVAILABLE only until the next schedule start/end boundary; otherwise set manual UNAVAILABLE indefinitely
- `/unavailable 3` — temporary unavailable timer for 3 hours; recurring schedule remains stored and resumes after timer expiry
- `/unavailable cancel` or `/unavailable clear` — cancel active temporary timer
- `/available cancel` or `/available clear` — explicitly remove the recurring daily schedule and preserve current effective state as manual state

Plain availability commands must never silently delete a recurring schedule. Only explicit `/available cancel|clear` removes it.

## Schedule-aware manual override
Migration `0034_staff_manual_schedule_override.sql` adds `manual_override_until` to `staff_presence`.

When a recurring schedule exists:
1. plain `/available` or `/unavailable` calculates the next Yangon-time schedule boundary (start or end)
2. the requested state becomes immediately effective
3. the recurring schedule remains persisted unchanged
4. `manual_override_until` stores the next boundary
5. at that boundary the override expires and schedule-derived state becomes authoritative again

The existing 5-minute Cron materializes override expiry. If expiry causes an actual AVAILABLE↔UNAVAILABLE change, both affected staff private chat and Staff Inbox receive the existing automatic state-change declaration. If schedule state equals the override state at the boundary, no misleading duplicate state notification is sent.

## Private + Staff Inbox contract
`/available` and `/unavailable` may be used in the active Staff Inbox or authorized staff private bot chat. Private use requires an active Staff Inbox and successful private mutations are mirrored once to group root. `/noti` remains Staff-Inbox-only.

## Existing availability behavior retained
- recurring schedules support 24-hour, am/pm, minute resolution and overnight windows
- `/unavailable <hours>` supports positive fractional hours up to 168
- automatic timer/schedule state transitions are declared in staff private chat + Staff Inbox when effective state actually changes
- staff counts use effective timer/schedule/override state directly

## Migrations
Current range: `0001` through `0034`.

Latest availability migrations:
- `0031_staff_availability_schedule.sql`
- `0032_private_staff_availability_commands.sql`
- `0033_staff_availability_auto_notice_cancel.sql`
- `0034_staff_manual_schedule_override.sql`

## Command registry
Command names/order/count unchanged. Schema revision remains **11**. Public 4, Sudo 12, Owner 19.

## Existing continuity contracts
- FAQ and Human Staff are primary continuity; AI outages never sever staff handoff.
- AI outage alerts are transition-only: one outage notice, no repeats while down, one recovery notice.
- Human Take Over uses a persisted 1-hour inactivity lease; claimant activity renews it; Cron auto-returns expired claims; Owner may override immediately.
- Production deploy validates typecheck, migrations, dry-run, bindings, health, Telegram webhook, and exact Owner command registry.
- deployment online notice shows revision + deployed change summary.

## Validation boundary
Newest slice requires:
1. production workflow green including migration 0034
2. create `/available 9am 5pm`, then use plain `/available` outside the window; recurring schedule must remain stored and confirmation must show schedule-resume boundary
3. next schedule boundary must restore schedule authority automatically
4. create the schedule, then use plain `/unavailable` inside the window; override must last only until next boundary
5. `/available cancel` must still explicitly delete the recurring schedule
6. `/unavailable 3` must preserve recurring schedule and resume it after timer expiry
7. effective state changes from override expiry must retain private + Staff Inbox automatic declaration behavior
8. existing FAQ, human handoff, takeover lease, Owner override and AI fallback continue working
