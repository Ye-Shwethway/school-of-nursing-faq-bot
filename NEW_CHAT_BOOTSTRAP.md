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

FAQ integrity repair is live-verified for `official-info-channel`: Owner `/faq repair` reported `corrupt v8 → clean snapshot v5 → new live v9`, and revision history was preserved.

Newest `main` slice improves edit safety/clarity for existing FAQs. During `✨ Edit from one language`, the current live FAQ remains unchanged until approval, text-input stages keep a visible `✕ Cancel Edit` control, and draft UI states which live version remains in force.

Do not call this newest edit-UX slice live-accepted until Telegram verification succeeds.

## Confirmed corruption mechanism
Legacy lower FAQ handling could invoke `consumeFaqAdminText()` before normal command routing. If an authorized Admin was waiting for an FAQ field value and sent `/faq`, that command could be treated as text and saved to the field. This explained the observed `MY A: /faq` exactly.

The older store also accepted arbitrary field text without a final structural integrity check, so rendered FAQ-management blocks could become nested canonical field content.

## FAQ live/current/history model
- `faq_entries` = one current published row per stable `faq_key`
- `faq_key` is PRIMARY KEY
- approved edits overwrite the current row and increment `version`
- `faq_revisions` separately archives before/after JSON snapshots
- archived revisions are history/recovery only, never normal-user answer rows
- deleting revision history is not the fix for stale/corrupt current content
- multiple live FAQ versions must never be displayed for the same key

## Integrity prevention
`src/faq_store.ts` rejects canonical create/update when any multilingual question/answer contains:
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

## FAQ edit UX
`src/faq_ai_entry.ts` now decorates active existing-FAQ edit sessions centrally.

For `✨ Edit from one language`:
- after a source language is selected, Step 1/2 shows `✕ Cancel Edit`
- subsequent text-input stages keep the cancel control
- UI states `Draft only · live vN remains unchanged until Approve & Save.`
- `faq:editcancel` clears only the current FAQ edit session/draft
- cancelling does not mutate the current live `faq_entries` row
- draft preview may keep the existing `✕ Discard Draft` instead of duplicating Cancel
- only `✅ Approve & Save` publishes the next live version
- previous live content moves to revision history only

The same central decorator also makes individual-field edit text-input stages cancelable without changing the live row before a value is actually saved.

## Single FAQ runtime owner
`src/faq_ai_entry.ts` owns:
- `/faq` for all roles
- all `faq:*` callbacks
- FAQ authoring text/actions
- `/faq repair`
- edit cancel/session UI
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
1. open repaired `official-info-channel` from Owner/Admin Browse and note current live version/content
2. choose `✨ Edit from one language`
3. select a language and verify Step 1/2 shows `✕ Cancel Edit` plus live-version-preserved copy
4. send a replacement question; Step 2/2 must remain cancelable
5. press Cancel and confirm the live FAQ/version/content did not change
6. restart edit, complete the draft, and verify draft preview clearly remains non-canonical until approval
7. Approve & Save and verify one next live version only
8. Owner/Admin fresh Browse, normal-user `/faq`, and normal-user free-text must show identical current content
9. revision history must remain intact
10. copied management-card blocks and slash commands must still be rejected as FAQ content

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file, FAQ content policy, and relevant manuals synchronized with repository reality.
