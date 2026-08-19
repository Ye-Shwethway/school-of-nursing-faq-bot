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

Staff recurring availability schedule/manual override is live-accepted.

Latest unresolved production issue: Owner/Admin FAQ mutations appeared updated to operators, but normal users still observed older FAQ wording through both `/faq` and free-text. The first free-text-only fix was insufficient.

Newest `main` slice therefore centralizes every Telegram FAQ surface on one live D1 runtime path and forbids stale static FAQ fallback. Do not call this newest slice live-accepted until Telegram verification succeeds.

## FAQ live/current/history model
- `faq_entries` = one current published row per stable `faq_key`
- `faq_key` is PRIMARY KEY
- approved edits overwrite current row and increment `version`
- `faq_revisions` separately archives before/after JSON for audit/history/recovery
- archived revisions are not public FAQ rows and are never selected for normal-user answers
- old revisions should not be deleted merely to make the current FAQ visible
- `src/faq.ts` is seed/bootstrap data only after D1 is established

Migration `0005_dynamic_faq.sql` already provides this current-row + revision-history structure. No new schema migration is required for the latest runtime fix.

## Authoritative FAQ runtime owner
`src/faq_ai_entry.ts` now intercepts FAQ interaction before lower legacy layers and owns:
1. `/faq` command for all roles
2. all `faq:*` callbacks
3. FAQ draft generate/approve/edit flows
4. authorized FAQ authoring text
5. normal-user deterministic free-text matching

It routes UI through the existing `handleFaqCommand` / `handleFaqCallback` and all knowledge reads through `faq_store` / D1.

### Fail-closed rule
A successfully-read D1 FAQ answer is authoritative and terminal.

If live D1 FAQ access fails:
- do not answer from static seed content
- `/faq` and FAQ callbacks return a temporary-unavailable response/alert
- deterministic FAQ path returns temporary-unavailable rather than stale policy knowledge
- question logging is best-effort and cannot suppress an otherwise valid D1 FAQ answer

## FAQ write path
`updateFaq/createFaq` already:
- writes current D1 entry
- increments version on update
- reads saved row back before returning success
- archives before/after state in `faq_revisions`

Operator notification is based on the mutation result. For acceptance, always reopen Browse from scratch after saving; do not treat notification text alone as proof of the public live row.

## Manual navigation
Long Owner/Admin manuals include First/Last direct jump buttons in addition to Previous/Next. This earlier slice remains pending explicit Telegram acceptance unless separately confirmed.

## Staff availability durable contract
Timezone: Asia/Yangon / UTC+06:30.
- recurring schedules survive plain `/available` and `/unavailable`
- plain state commands override only until next schedule boundary
- `/available cancel|clear` explicitly removes schedule
- `/unavailable <hours>` preserves schedule
- private mutations mirror to Staff Inbox
- automatic effective transitions declare to private + Staff Inbox

Migration `0034_staff_manual_schedule_override.sql` persists schedule-aware overrides. Cron remains `*/5 * * * *`.

## Migrations / commands
Current migration range remains `0001` through `0034`.
Command schema revision remains 11. Public 4; Sudo 12; Owner 19.

## Other durable contracts
- Human Staff continuity remains available when AI is down
- AI outage alert is state-transition-only
- Take Over uses persisted 1-hour inactivity lease; Owner can override immediately
- deployment online notice shows revision + change summary
- production workflow validates typecheck, migrations, dry-run, bindings, health, webhook cutover, and exact Owner command read-back

## Next exact FAQ validation
After production workflow green:
1. open an existing FAQ in Owner/Admin Browse and record key/version/current wording
2. edit + approve it and confirm version increments
3. close FAQ UI completely, reopen `/faq`, browse from scratch as Owner/Admin, and verify saved wording
4. on a normal account open `/faq` from scratch and verify the exact same current wording
5. ask the matching question as free text and verify the exact same D1 answer
6. confirm old seed wording does not appear anywhere
7. verify an FAQ miss still proceeds to AI/human fallback
8. controlled live-store failure, if tested, must show temporary-unavailable rather than static seed content

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file, and relevant manuals/design rules synchronized with repository reality.
