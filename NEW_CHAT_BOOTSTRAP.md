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

Newest implementation corrects recurring staff availability semantics: **daily schedule is durable; plain `/available` or `/unavailable` is only a temporary manual override until the next schedule boundary**. Do not call this newest slice live-accepted until production workflow + Telegram acceptance is verified.

## Staff availability commands
Timezone: **Asia/Yangon / UTC+06:30**.

- `/available <start> <end>` — recurring daily schedule, e.g. `/available 9am 5pm`
- plain `/available` — schedule exists: force AVAILABLE until next schedule boundary; no schedule: manual AVAILABLE indefinitely
- plain `/unavailable` — schedule exists: force UNAVAILABLE until next schedule boundary; no schedule: manual UNAVAILABLE indefinitely
- `/unavailable <hours>` — temporary unavailable timer; recurring schedule remains persisted
- `/unavailable cancel|clear` — cancel temporary unavailable timer
- `/available cancel|clear` — explicitly delete recurring daily schedule

Only explicit `/available cancel|clear` deletes the recurring schedule. Plain state changes never silently delete it.

## Manual schedule override persistence
Migration `0034_staff_manual_schedule_override.sql` adds `staff_presence.manual_override_until` plus an index and updated Owner/Admin manual guidance.

`src/staff_presence.ts` now calculates the next recurring schedule start/end boundary in fixed Yangon time. With a schedule present, plain `/available` or `/unavailable`:
1. changes effective state immediately
2. leaves schedule start/end/enabled untouched
3. clears any temporary unavailable timer
4. persists `manual_override_until` at the next schedule boundary
5. lets schedule-derived state become authoritative after that boundary

The existing 5-minute Cron clears expired manual overrides. An actual state change caused by override expiry is announced in staff private chat + Staff Inbox using reason `manual_override_expired`. If the schedule state equals the override state at the boundary, no duplicate/misleading state notice is emitted.

## Private + Staff Inbox contract
Authorized staff can invoke `/available` and `/unavailable` in active Staff Inbox or private bot chat when Staff Inbox exists. Private successful mutations are mirrored once to Staff Inbox root. No Staff Inbox means private mutation rejects before state change. `/noti` remains Staff-Inbox-only.

## Runtime ownership
- `src/staff_presence.ts` — effective state, recurring schedule, temporary timers, manual interval override, transition detection
- `src/staff_presence_entry.ts` — command parser and schedule-aware confirmation copy
- `src/interaction_guard_entry.ts` — 5-minute scheduled sweeps + dual-location automatic state declarations
- `src/human_control_lease.ts` — 1-hour takeover expiry

## Migrations / commands
Current migration range: `0001` through `0034`.
Command schema revision remains **11**. Public 4; Sudo 12; Owner 19.

## Other durable contracts
- deterministic FAQ first; Human Staff continuity always available
- AI outage notices are state-transition-only and AI outage never reduces service to FAQ-only
- Take Over uses persisted 1-hour inactivity lease; Owner can override immediately
- deployment online notice shows revision + deployed change summary
- production workflow validates typecheck, migrations, dry-run, bindings, health, webhook cutover and exact Owner command read-back

## Next exact validation
After production workflow green:
1. schedule `/available 9am 5pm`
2. outside schedule hours use plain `/available`; response must say recurring schedule is preserved and show next Yangon boundary
3. verify schedule remains configured and regains control at next boundary
4. during schedule hours use plain `/unavailable`; verify temporary override until next boundary only
5. `/available cancel` must explicitly delete schedule
6. `/unavailable 3` must preserve schedule and resume it after expiry
7. actual override-expiry state change must produce one private + one Staff Inbox auto-update; later Cron must not duplicate
8. existing FAQ/handoff, takeover lease, Owner override and AI fallback remain operational

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file and relevant manuals/design rules synchronized with repository reality.
