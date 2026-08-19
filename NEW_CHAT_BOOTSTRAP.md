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

Newest `main` fix resolves a **normal-user stale FAQ read**. Root cause was not permission scope: the dynamic D1 matcher could find a current FAQ and then return control to a lower legacy static matcher, allowing normal-user free-text answers to come from old `src/faq.ts` seed content while Owner/Admin management showed the latest D1 version.

Production/live acceptance is still required for this newest FAQ consistency fix.

The earlier Owner/Admin manual First/Last pagination slice also remains pending Telegram acceptance unless separately confirmed.

## FAQ live canonical contract
- D1 `faq_entries` is the live canonical FAQ source after initial seeding.
- `src/faq.ts` is seed/fallback baseline only.
- Owner/Sudo approved mutations update D1 and must become immediately visible to normal-user FAQ surfaces.
- public `/faq` list/detail uses dynamic `listFaqs/getFaq`.
- normal-user deterministic free-text matching now terminates on `findFaqDynamic` and returns that latest active D1 answer directly.
- dynamic FAQ hits must not fall through to the legacy static `findFaq()` path in `src/index.ts`.
- grounded AI approved context is also built from active D1 FAQ entries.
- inactive FAQs must never be shown or answered to normal users.

## Latest source change
`src/faq_ai_entry.ts` now owns an early dynamic FAQ fast path after rate limiting/AI setup but before the lower static legacy runtime:
1. private non-command text only
2. skip active admin/setup sessions
3. skip conversations currently in human-control mode
4. load saved user language
5. run `findFaqDynamic`
6. on match, log `canonical_faq` + matched key and reply with the latest D1 answer
7. on no match or transient D1 failure, continue to the existing lower FAQ/AI/handoff stack

No migration or command schema change is required.

## Manual navigation
For multi-page Owner/Admin manuals:
- primary nav remains Previous / current-total / Next
- second row provides First and/or Last direct jumps
- First hidden on page 1; Last hidden on final page
- existing callbacks, authorization, edit/add and Close behavior remain unchanged

## Staff availability durable contract
Timezone: **Asia/Yangon / UTC+06:30**.

- recurring schedules survive plain `/available` and `/unavailable`
- plain state commands override only until the next schedule boundary
- `/available cancel|clear` explicitly removes schedule
- `/unavailable <hours>` preserves schedule
- private mutations mirror to Staff Inbox when configured
- automatic effective transitions declare to private + Staff Inbox

Migration `0034_staff_manual_schedule_override.sql` persists schedule-aware manual overrides. Existing Cloudflare Cron remains `*/5 * * * *`.

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
1. edit and approve an existing FAQ using Owner/Sudo management
2. verify Owner/Admin management shows the new version
3. verify normal-user `/faq` detail shows exactly the same updated content
4. ask a normal-user free-text question that deterministically matches that FAQ and verify the response is the updated D1 answer
5. verify the old seed wording is not returned
6. verify FAQ miss still proceeds to grounded AI/human handoff
7. verify a human-controlled user conversation is not intercepted by the dynamic FAQ fast path
8. verify existing staff availability, takeover lease, Owner override and manuals remain operational

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file and relevant manuals/design rules synchronized with repository reality.
