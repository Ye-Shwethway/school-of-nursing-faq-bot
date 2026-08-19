# FAQ Content Policy

Last updated: 2026-08-19

## Canonical source

The Creator-provided `SCHOOL of Nursing FAQ.docx` is the original approved content baseline.

For the running bot, **D1 `faq_entries` is the only live canonical FAQ source**. Owner/Sudo approved mutations update this table and must become visible immediately to normal-user `/faq` browsing, deterministic FAQ answers, and grounded AI context.

`src/faq.ts` is repository seed/bootstrap data only. It must never answer production traffic once the live D1 FAQ store exists, and it must never override a newer D1 FAQ version.

## Current row vs revision archive

`faq_entries` stores exactly one current published row per stable `faq_key`; `faq_key` is the primary key. Updating an FAQ overwrites that current row and increments its version.

Historical content is intentionally preserved separately in `faq_revisions` as an audit/archive trail using `before_json` and `after_json`. Old FAQ versions are **not** kept as duplicate live rows and should not be deleted merely to make the current version visible.

Runtime reads must never query `faq_revisions` as user-facing FAQ content. The revision table exists for history/audit/recovery only.

## Repository representation

`src/faq.ts` provides the initial seeded FAQ keys, Burmese/English/Simplified Chinese content, and matching keywords.

`src/faq_store.ts` owns the live multilingual FAQ records, active/inactive state, versions, revisions, deterministic dynamic matching, and approved AI context.

The English and Simplified Chinese text is a translation layer. It must not add, remove, soften, or strengthen policy facts relative to the approved source meaning.

## Single live read contract

All FAQ interaction surfaces must use the same live D1 store:

1. Owner/Sudo management browse/detail/edit/approve
2. normal-user `/faq` list/detail
3. deterministic normal-user free-text FAQ matching
4. grounded AI approved FAQ context

`src/faq_ai_entry.ts` is the authoritative Telegram FAQ surface router. It handles `/faq`, all `faq:*` callbacks, FAQ authoring input, and the normal-user deterministic D1 FAQ fast path before lower legacy runtime layers.

A successful D1 FAQ match is terminal for that turn. Production FAQ UI or answer traffic must not fall through to a static `FAQS` matcher.

If the live FAQ store cannot be read, FAQ surfaces fail closed with a temporary-unavailable response rather than substituting older static seed content. Serving stale policy-sensitive knowledge is worse than temporary unavailability.

## Write and publish contract

Every approved FAQ mutation must:

1. update the current `faq_entries` row (or create it for a new FAQ)
2. increment/version the live entry as applicable
3. read the saved row back from D1 before reporting success
4. append the before/after state to `faq_revisions`
5. notify authorized operators only after the mutation result exists

A draft, preview, notification, or archived revision is never itself the live FAQ source.

## High-risk facts

The following must never be invented by the model or silently changed during copy editing:

- admission eligibility
- entrance exam dates and subjects
- application links
- tuition/accommodation/meal amounts
- exchange-rate wording
- accreditation/licensing status
- CDM applicant rules
- bond/service obligations
- scholarship and loan percentages/terms
- exam-failure consequences attached to financial support
- school opening period
- marital/pregnancy policy
- academic-year/break durations
- campus address
- official Telegram channel

## Answer order

1. latest active deterministic D1 FAQ match
2. grounded AI fallback using only approved D1 FAQ context
3. unresolved/human escalation if grounding is insufficient

Policy-sensitive answers must prefer the latest approved FAQ data.

## Translation maintenance

When an approved FAQ answer changes:

1. update the authoritative source language;
2. update the other two languages to preserve the same meaning;
3. update matching keywords only when needed;
4. review all three languages before approval;
5. after approval, the new D1 version is immediately canonical for every public and deterministic answer surface.
