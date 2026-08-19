# ROADMAP

Last updated: 2026-08-19

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Deterministic FAQ first, Human Staff continuity second, grounded AI as supplementary help.

## Repository policy
- `main` is canonical development + production.
- historical `test` is dormant/reference-only.
- relevant main pushes run the production workflow.

## Current checkpoint
Staff recurring availability schedule/manual override is live-accepted.

A production FAQ integrity incident is now understood more precisely. The live FAQ row itself became corrupted: for example `official-info-channel` reached Version 8 with `MY A: /faq` and rendered FAQ management text nested inside other language fields. This was not multiple live DB versions being displayed.

Confirmed cause for command corruption: a legacy FAQ edit path could call `consumeFaqAdminText()` before command routing, so an Admin waiting for an FAQ field value could send `/faq` and have that command saved as the field value. The store also lacked a final integrity validator capable of rejecting rendered management-card text.

Newest `main` slice adds store-level prevention plus Owner recovery from revision history. Production/live acceptance is required.

## FAQ current-row and archive contract
- D1 `faq_entries` is the only live canonical FAQ store.
- `faq_key` is PRIMARY KEY: one current published row per FAQ key.
- approved update overwrites that current row and increments `version`.
- `faq_revisions.before_json/after_json` separately stores historical snapshots for audit/recovery.
- old revisions are not duplicate public FAQ rows and must not be deleted to expose current content.
- `src/faq.ts` is seed/bootstrap data, not normal production answer traffic after D1 exists.

## FAQ integrity guard
`src/faq_store.ts` now validates every create/update before canonical write.

Rejected as question/answer content:
- command-only values such as `/faq` or `/start`
- rendered FAQ-management blocks containing multiple markers such as `FAQ ·`, `Key:`, `Version:`, `MY Q:`, `EN A:`, `ZH A:`
- draft-preview control text

The same store validation protects individual edits, manual multilingual drafts, and AI-generated drafts at final approval.

Dynamic FAQ matching and grounded AI context skip rows that fail the integrity detector.

`src/faq_ai_entry.ts` also clears/leaves pending FAQ text-input state before lower command handling so slash commands cannot become canonical FAQ field values through legacy wrappers.

## Owner repair
Owner-only `/faq repair` scans current FAQ rows and acts only on detected corruption.

For each corrupt row it searches `faq_revisions` newest-first and restores the newest clean same-key snapshot as a **new live version**. It does not rewind the version counter or delete history. The corrupt-before and repaired-after states are archived as another revision.

If no clean archived snapshot can be found, the FAQ is reported as `Needs manual review` rather than guessed silently.

Migration `0035_manual_faq_integrity_recovery.sql` documents prevention/recovery in Owner/Admin manuals.

## Single FAQ runtime owner
`src/faq_ai_entry.ts` remains authoritative for `/faq`, `faq:*` callbacks, authoring input, repair, and normal-user deterministic matching. D1 live data is terminal; static FAQ fallback must not answer stale production knowledge.

## Manual pagination UX
Multi-page Owner/Admin manuals include Previous/Next plus First/Last direct jumps.

## Staff availability contract
Timezone: **Asia/Yangon / UTC+06:30**.
- recurring schedule survives plain `/available` and `/unavailable`
- plain state command overrides only until next schedule boundary
- `/unavailable <hours>` preserves recurring schedule
- `/available cancel|clear` explicitly removes schedule
- private mutations mirror to Staff Inbox
- automatic effective transitions declare to private + Staff Inbox

## Migrations
Current range: `0001` through `0035`.

## Command registry
Registered command names/order/count unchanged. Schema revision remains **11**. Public 4, Sudo 12, Owner 19. `/faq repair` is an Owner-only maintenance subcommand, not a separate Telegram menu command.

## Existing continuity contracts
- FAQ and Human Staff are primary continuity; AI outage never severs staff handoff.
- AI outage alerts are transition-only.
- Human Take Over uses a persisted 1-hour inactivity lease; Owner may override immediately.
- production deploy validates typecheck, migrations, dry-run, bindings, health, Telegram webhook, and exact Owner command registry.
- deployment online notice shows revision + change summary.

## Validation boundary
After production workflow green:
1. Owner runs `/faq repair` once.
2. Record its repaired/unrecoverable report.
3. Reopen `official-info-channel` from scratch and confirm `/faq` and nested management-card text are gone.
4. Confirm repaired row version increments rather than reverting the live version number.
5. Confirm revision history remains intact.
6. Owner/Admin fresh Browse, normal-user `/faq`, and normal-user free-text all show identical repaired content.
7. Start an individual FAQ edit, then send `/faq`; verify the command is not saved as the field value.
8. Attempt to save a management-card block as an FAQ field; verify the integrity guard rejects it.
9. FAQ miss still proceeds to grounded AI/human fallback.
10. Existing staff availability, takeover lease, Owner override, manuals, and AI outage behavior remain operational.
