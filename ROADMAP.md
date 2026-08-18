# ROADMAP

Last updated: 2026-08-19

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Deterministic FAQ first, Human Staff continuity second, grounded AI as supplementary help.

## Repository policy
- `main` is canonical development + production.
- historical `test` is dormant/reference-only.
- relevant main pushes run the production workflow.

## Current checkpoint
The recurring staff availability schedule/manual-override behavior is live-accepted by Creator.

Newest `main` slice improves long Owner/Admin manual navigation with direct **First** and **Last** page jump buttons. Production/live acceptance is still required for this newest pagination slice.

## Manual pagination UX
`src/manual_entry.ts` owns Owner/Admin manual rendering and pagination.

For manuals with more than one page:
- existing row remains `◀ Previous | current/total | Next ▶`
- a second jump row provides `⏮ First` and/or `⏭ Last`
- `⏮ First` is omitted while already on page 1
- `⏭ Last` is omitted while already on the final page
- single-page manuals do not show a jump row
- existing `manual:page:<key>:<index>` callbacks are reused; no new callback namespace or schema is required
- authorization, edit-in-place behavior, Owner edit/add controls, and `✕ Close` remain unchanged

## Staff availability contract
Timezone: **Asia/Yangon / UTC+06:30**.

Supported syntax:
- `/available 09:00 17:00` or `/available 9am 5pm` — create/update recurring daily schedule
- `/available` — if a recurring schedule exists, immediately force AVAILABLE only until the next schedule start/end boundary; otherwise set manual AVAILABLE indefinitely
- `/unavailable` — if a recurring schedule exists, immediately force UNAVAILABLE only until the next schedule start/end boundary; otherwise set manual UNAVAILABLE indefinitely
- `/unavailable 3` — temporary unavailable timer; recurring schedule remains stored and resumes after timer expiry
- `/unavailable cancel|clear` — cancel active temporary timer
- `/available cancel|clear` — explicitly remove recurring daily schedule and preserve current effective state as manual state

Plain availability commands never silently delete a recurring schedule.

## Migrations
Current range remains `0001` through `0034`. The manual pagination slice has no schema change.

## Command registry
Command names/order/count unchanged. Schema revision remains **11**. Public 4, Sudo 12, Owner 19.

## Existing continuity contracts
- FAQ and Human Staff are primary continuity; AI outages never sever staff handoff.
- AI outage alerts are transition-only: one outage notice, no repeats while down, one recovery notice.
- Human Take Over uses a persisted 1-hour inactivity lease; claimant activity renews it; Cron auto-returns expired claims; Owner may override immediately.
- staff recurring schedules survive plain `/available` and `/unavailable`; those commands only override until the next schedule boundary.
- production deploy validates typecheck, migrations, dry-run, bindings, health, Telegram webhook, and exact Owner command registry.
- deployment online notice shows revision + deployed change summary.

## Validation boundary
Newest manual pagination slice requires:
1. production workflow green
2. open `/ownermanual` and `/adminmanual` with multiple pages
3. first page shows `⏭ Last` but not `⏮ First`
4. middle page shows both jump buttons
5. final page shows `⏮ First` but not `⏭ Last`
6. First and Last jump directly to correct endpoints using edit-in-place
7. Previous/Next/page counter/Edit/Add/Close behavior remains unchanged
8. existing FAQ, staff availability, human handoff, takeover lease, Owner override, and AI fallback continue working
