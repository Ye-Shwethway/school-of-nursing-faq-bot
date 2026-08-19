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

A deeper FAQ consistency issue was reported after the first stale-read fix: normal users could still see older FAQ wording through `/faq` and free-text even though Owner/Admin mutation results showed the newer content.

Newest `main` slice hardens FAQ architecture around a **single live D1 source and one authoritative Telegram FAQ router**. Production/live acceptance is required before calling this fixed.

The earlier manual First/Last pagination slice remains pending explicit Telegram acceptance unless separately confirmed.

## FAQ current-row and archive contract
- D1 `faq_entries` is the only live canonical FAQ store.
- `faq_key` is the primary key, so one current published row exists per FAQ key.
- approved update overwrites that current row and increments `version`.
- old versions are preserved separately in `faq_revisions.before_json/after_json` for audit/history/recovery.
- `faq_revisions` is never a public answer source and old revisions do not need deletion to expose the current version.
- `src/faq.ts` is initial seed/bootstrap data only, not a production answer source after D1 exists.

## Single FAQ runtime owner
`src/faq_ai_entry.ts` now handles all Telegram FAQ surfaces before lower legacy layers:
1. `/faq` command for Owner/Sudo/normal users
2. every `faq:*` callback
3. AI/manual FAQ authoring actions
4. authorized FAQ edit text input
5. normal-user deterministic free-text FAQ matching

All these surfaces use the same `handleFaqCommand` / `handleFaqCallback` / `faq_store` D1 path.

A live D1 FAQ match is terminal and must not fall through to static `FAQS` matching. If a live FAQ read fails, FAQ surfaces fail closed with a temporary-unavailable message instead of substituting old static seed content.

Question logging for a valid FAQ hit is best-effort; a logging failure must not suppress a successfully-read canonical D1 answer.

## FAQ write contract
Approved mutations continue to use `updateFaq/createFaq`:
- current `faq_entries` row is saved
- saved row is read back from D1 before success is returned
- mutation version is returned
- before/after revision is archived in `faq_revisions`
- operator notification occurs from the mutation result

## Manual pagination UX
For multi-page Owner/Admin manuals, existing Previous/Next navigation now also includes First/Last direct jumps. No schema change.

## Staff availability contract
Timezone: **Asia/Yangon / UTC+06:30**.
- `/available <start> <end>` creates/updates recurring schedule
- plain `/available` or `/unavailable` only overrides until the next schedule boundary
- `/unavailable <hours>` preserves recurring schedule
- `/available cancel|clear` explicitly removes recurring schedule
- private state mutations mirror to Staff Inbox
- automatic effective transitions declare to private + Staff Inbox

## Migrations
Current range remains `0001` through `0034`. This FAQ hardening slice has no schema migration.

## Command registry
Command names/order/count unchanged. Schema revision remains **11**. Public 4, Sudo 12, Owner 19.

## Existing continuity contracts
- FAQ and Human Staff are primary continuity; AI outage never severs staff handoff.
- AI outage alerts are transition-only.
- Human Take Over uses a persisted 1-hour inactivity lease; Owner may override immediately.
- production deploy validates typecheck, migrations, dry-run, bindings, health, Telegram webhook, and exact Owner command registry.
- deployment online notice shows revision + change summary.

## Validation boundary
Newest FAQ hardening requires:
1. production workflow green
2. reopen an existing FAQ in Owner/Admin management and note its key/version/current wording
3. edit + approve that FAQ and confirm version increments
4. reopen Owner/Admin browse from scratch and confirm the saved wording, not merely the success notification
5. normal-user `/faq` list/detail must show the exact same wording
6. normal-user deterministic free-text question must return the same D1 answer
7. old static seed wording must never reappear
8. if live FAQ storage is intentionally unavailable in controlled QA, the bot must show temporary-unavailable instead of old FAQ content
9. FAQ miss still proceeds to grounded AI/human fallback
10. existing staff availability, takeover lease, Owner override, manuals, and AI outage behavior remain operational
