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

A newly identified FAQ consistency bug is fixed on `main`: normal-user deterministic free-text FAQ answers could fall through from the dynamic D1 matcher to the legacy static `FAQS` matcher, causing users to receive pre-update content while Owner/Admin views showed the latest D1 version.

Newest fix makes the latest active D1 FAQ entry authoritative for normal-user deterministic FAQ answers. Production/live acceptance is still required for this fix.

The earlier manual-pagination First/Last jump slice also remains pending Telegram acceptance unless separately confirmed.

## FAQ live canonical contract
- D1 `faq_entries` is the live canonical FAQ store after seeding.
- Owner/Sudo approved updates must be visible to normal users immediately.
- `/faq` list/detail already read from dynamic `listFaqs/getFaq`.
- normal-user deterministic free-text matching must answer the matched `findFaqDynamic` result directly.
- a dynamic FAQ match must not fall through to the legacy static matcher in `src/index.ts`.
- `src/faq.ts` remains seed/fallback baseline only when dynamic storage is unavailable.
- grounded AI approved context is built from active D1 FAQ entries.

## Manual pagination UX
`src/manual_entry.ts` owns Owner/Admin manual rendering and pagination.

For manuals with more than one page:
- existing row remains `◀ Previous | current/total | Next ▶`
- a second jump row provides `⏮ First` and/or `⏭ Last`
- First is hidden on page 1
- Last is hidden on final page
- single-page manuals do not show a jump row
- existing page callbacks are reused; authorization/edit controls remain unchanged

## Staff availability contract
Timezone: **Asia/Yangon / UTC+06:30**.

- `/available <start> <end>` creates/updates a recurring daily schedule
- plain `/available` or `/unavailable` overrides a recurring schedule only until its next boundary
- `/unavailable <hours>` preserves recurring schedule and resumes it after timer expiry
- `/available cancel|clear` explicitly removes recurring schedule
- private successful mutations mirror to Staff Inbox when configured
- effective automatic state transitions are declared to staff private chat + Staff Inbox

## Migrations
Current range remains `0001` through `0034`. The FAQ stale-read fix and manual pagination slice require no schema change.

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
Newest FAQ consistency fix requires:
1. production workflow green
2. Owner/Sudo edit and approve an existing FAQ answer in all intended languages
3. Owner/Admin management view shows the new D1 version
4. normal-user `/faq` detail shows the same new version
5. normal user asks a deterministic matching free-text question and receives the same new D1 answer, not the old static seed answer
6. question log records the matched FAQ key with `canonical_faq`
7. FAQ miss still proceeds to grounded AI/human fallback normally
8. human-controlled conversations remain human-controlled and are not intercepted by the FAQ fast path
9. existing staff availability, takeover lease, Owner override, manuals, and AI outage behavior continue working
