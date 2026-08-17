# FAQ Content Policy

Last updated: 2026-08-18

## Canonical source

The current canonical FAQ source is the Creator-provided document:

`SCHOOL of Nursing FAQ.docx`

It contains 22 FAQ items. The Burmese question/answer facts are the authoritative content baseline for this repository.

## Repository representation

`src/faq.ts` contains:

- stable FAQ keys
- canonical Burmese questions/answers
- meaning-preserving English translations
- meaning-preserving Simplified Chinese translations
- deterministic matching keywords for `my`, `en`, and `zh`

The English and Simplified Chinese text is a translation layer. It must not add, remove, soften, or strengthen policy facts relative to the Burmese source.

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

1. deterministic canonical FAQ match
2. grounded AI fallback later, using only approved knowledge
3. unresolved/human escalation if grounding is insufficient

Policy-sensitive answers must prefer canonical FAQ data even after Gemini fallback is introduced.

## Translation maintenance

When a Burmese canonical answer changes:

1. update Burmese first;
2. update English and Simplified Chinese to preserve the new meaning;
3. update matching keywords only when needed;
4. revalidate all three languages;
5. update `ROADMAP.md` and `NEW_CHAT_BOOTSTRAP.md` if the change affects project behavior or production knowledge.
