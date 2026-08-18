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

The recurring staff availability schedule/manual-override behavior is live-accepted by Creator.

Newest implementation adds **First/Last direct jumps to long Owner/Admin manuals**. Do not call this newest pagination slice live-accepted until production workflow + Telegram acceptance are verified.

## Manual navigation
`src/manual_entry.ts` owns manual pagination.

For manuals with multiple pages:
- primary nav remains `◀ Previous | current/total | Next ▶`
- a second row adds `⏮ First` and/or `⏭ Last`
- First is hidden on page 1
- Last is hidden on the final page
- single-page manuals have no jump row
- existing `manual:page:<key>:<index>` callbacks are reused
- no schema or migration is required
- Owner/Admin authorization and edit-in-place navigation remain unchanged
- Owner edit/add controls and `✕ Close` remain unchanged

## Staff availability durable contract
Timezone: **Asia/Yangon / UTC+06:30**.

- `/available <start> <end>` creates/updates recurring daily schedule
- plain `/available` or `/unavailable` only overrides a recurring schedule until its next boundary
- plain availability commands do not delete the recurring schedule
- `/available cancel|clear` explicitly deletes the recurring schedule
- `/unavailable <hours>` is a temporary unavailable timer and preserves recurring schedule
- private successful state changes mirror to Staff Inbox when configured
- automatic effective state transitions are declared in staff private chat + Staff Inbox

Migration `0034_staff_manual_schedule_override.sql` persists schedule-aware manual overrides. Existing Cloudflare Cron remains `*/5 * * * *`.

## Runtime ownership
- `src/manual_entry.ts` — Owner/Admin manual rendering, page navigation, First/Last jumps, Owner editing
- `src/staff_presence.ts` — effective staff presence, recurring schedule, timers, manual interval override
- `src/staff_presence_entry.ts` — availability command parser and confirmation copy
- `src/interaction_guard_entry.ts` — 5-minute scheduled sweeps + dual-location automatic state declarations
- `src/human_control_lease.ts` — 1-hour takeover expiry

## Migrations / commands
Current migration range remains `0001` through `0034`.
Command schema revision remains **11**. Public 4; Sudo 12; Owner 19.

## Other durable contracts
- deterministic FAQ first; Human Staff continuity always available
- AI outage notices are state-transition-only and AI outage never reduces service to FAQ-only
- Take Over uses persisted 1-hour inactivity lease; Owner can override immediately
- deployment online notice shows revision + deployed change summary
- production workflow validates typecheck, migrations, dry-run, bindings, health, webhook cutover and exact Owner command read-back

## Next exact validation
After production workflow green:
1. open a multi-page Owner Manual and confirm first page shows Last but not First
2. move to a middle page and confirm both First and Last appear
3. Last jumps directly to final section via edit-in-place
4. final page shows First but not Last
5. First jumps directly back to page 1
6. repeat on Admin Manual
7. Previous/Next/page counter/Edit/Add/Close remain unchanged
8. existing FAQ/handoff, staff availability scheduling, takeover lease, Owner override and AI fallback remain operational

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file and relevant manuals/design rules synchronized with repository reality.
