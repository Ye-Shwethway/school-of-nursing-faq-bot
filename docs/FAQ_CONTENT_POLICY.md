# FAQ Content Policy

Last updated: 2026-08-19

## Canonical source

The Creator-provided `SCHOOL of Nursing FAQ.docx` is the original approved content baseline.

For the running bot, **D1 `faq_entries` is the live canonical FAQ source**. Owner/Sudo approved mutations update this table and must become visible immediately to normal-user `/faq` browsing and deterministic FAQ answers.

`src/faq.ts` is the repository seed/fallback baseline only. It must never override a newer active D1 FAQ entry after the dynamic FAQ store is available.

## Repository representation

`src/faq.ts` provides the initial seeded FAQ keys, Burmese/English/Simplified Chinese content, and matching keywords.

`src/faq_store.ts` owns the live multilingual FAQ records, active/inactive state, versions, revisions, deterministic dynamic matching, and approved AI context.

The English and Simplified Chinese text is a translation layer. It must not add, remove, soften, or strengthen policy facts relative to the approved source meaning.

## Live read contract

All normal-user FAQ surfaces must read the latest active D1 entry:

1. `/faq` list and detail views
2. deterministic free-text FAQ matching
3. grounded AI approved FAQ context

A dynamic D1 FAQ match is terminal for that turn and must not fall through to the legacy static `FAQS` matcher. Static FAQ data is fallback/bootstrap data only when the dynamic store is unavailable.

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
5. after approval, the new D1 version is immediately canonical for public and deterministic answer paths.
