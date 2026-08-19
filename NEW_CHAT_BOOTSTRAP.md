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
Main-only production Telegram FAQ assistant. FAQ and Human Staff are primary continuity; grounded AI is supplementary.

Staff recurring availability schedule/manual override is live-accepted.

Newest unresolved/live-validation item is FAQ integrity recovery. Production evidence showed the live `official-info-channel` row itself was corrupted at Version 8: `MY A` contained `/faq`, while other fields contained nested rendered FAQ-management text. This was not multiple live FAQ rows being shown.

Newest `main` slice adds prevention plus Owner recovery. Do not call it live-accepted until repair + fresh public verification succeed.

## Confirmed corruption mechanism
Legacy lower FAQ handling could invoke `consumeFaqAdminText()` before normal command routing. If an authorized Admin was waiting for an FAQ field value and sent `/faq`, that command could be treated as text and saved to the field. This explains the observed `MY A: /faq` exactly.

The older store also accepted arbitrary field text without a final structural integrity check, so rendered FAQ-management blocks could become nested canonical field content.

## FAQ live/current/history model
- `faq_entries` = one current published row per stable `faq_key`
- `faq_key` is PRIMARY KEY
- approved edits overwrite the current row and increment `version`
- `faq_revisions` separately archives before/after JSON snapshots
- archived revisions are history/recovery only, never normal-user answer rows
- deleting revision history is not the fix for stale/corrupt current content

## Integrity prevention
`src/faq_store.ts` now rejects canonical create/update when any multilingual question/answer contains:
- a command-only value such as `/faq` or `/start`
- multiple rendered FAQ-card markers such as `FAQ ·`, `Key:`, `Version:`, `MY Q:`, `MY A:`, `EN Q:`, `EN A:`, `ZH Q:`, `ZH A:`
- draft-preview control text

The validator sits at the store boundary, so individual edits, manual translations, and AI-generated drafts all pass through the same final guard.

Dynamic deterministic matching and grounded AI context skip rows that fail integrity validation.

`src/faq_ai_entry.ts` remains the authoritative FAQ router and prevents slash commands from becoming FAQ authoring values through lower legacy wrappers.

## Owner recovery
Owner-only maintenance subcommand: `/faq repair`.

Behavior:
1. scan current live rows
2. act only on rows detected as structurally corrupt
3. search `faq_revisions` newest-first for the latest clean same-key snapshot
4. restore that content as a new live version
5. preserve the corrupt version and all historical revisions
6. append the repair itself as another before/after revision
7. report any key with no recoverable clean snapshot as `Needs manual review`

No static FAQ answer is silently substituted during normal user traffic.

Migration `0035_manual_faq_integrity_recovery.sql` adds Owner/Admin manual guidance.

## Single FAQ runtime owner
`src/faq_ai_entry.ts` owns:
- `/faq` for all roles
- all `faq:*` callbacks
- FAQ authoring text/actions
- `/faq repair`
- normal-user deterministic D1 FAQ fast path

D1 `faq_entries` is the live source. `src/faq.ts` is seed/bootstrap only once D1 exists.

## Manual navigation
Long Owner/Admin manuals include Previous/Next plus First/Last jumps.

## Staff availability durable contract
Timezone: Asia/Yangon / UTC+06:30.
- recurring schedules survive plain `/available` and `/unavailable`
- plain state commands override only until next schedule boundary
- `/available cancel|clear` explicitly removes schedule
- `/unavailable <hours>` preserves schedule
- private mutations mirror to Staff Inbox
- automatic effective transitions declare to private + Staff Inbox

## Migrations / commands
Current migration range: `0001` through `0035`.
Registered command schema revision remains 11. Public 4; Sudo 12; Owner 19. `/faq repair` is a maintenance subcommand under `/faq`, not a new registered menu command.

## Other durable contracts
- Human Staff continuity remains available when AI is down
- AI outage alert is state-transition-only
- Take Over uses persisted 1-hour inactivity lease; Owner can override immediately
- deployment online notice shows revision + change summary
- production workflow validates typecheck, migrations, dry-run, bindings, health, webhook cutover, and exact Owner command read-back

## Next exact FAQ validation
After production workflow green:
1. Owner sends `/faq repair` privately.
2. Save the repair report.
3. Reopen `official-info-channel` through Owner/Admin Browse from scratch.
4. Confirm `/faq` and nested `FAQ · / Key: / Version:` blocks are no longer canonical field values.
5. Confirm the repaired FAQ becomes a new higher live version; history is not rewound/deleted.
6. Open the same FAQ from a normal account via `/faq`; wording must match Owner/Admin fresh Browse.
7. Ask a deterministic matching free-text question; answer must match the same current D1 row.
8. Begin an FAQ field edit and send `/faq`; verify the command navigates/restarts rather than becoming the field value.
9. Try to submit a copied rendered FAQ management block; verify it is rejected.
10. FAQ miss still goes to grounded AI/human fallback.

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file, FAQ content policy, and relevant manuals synchronized with repository reality.
