# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Development branch: `test`
Canonical branch: `main`

## Startup sequence
Read in this order before development:
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant docs/source referenced by those files

Treat the live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Branch contract
- Work on `test`.
- Do not implement directly on `main`.
- Validate on `test`.
- Merge to `main` only when the checkpoint is verified.
- Validation Worker: `school-of-nursing-faq-bot-test`.
- Production Worker after validated merge: `school-of-nursing-faq-bot`.

## Current checkpoint
**Foundation v0.1 plus the core Telegram MVP logic are implemented on `test`. Cloudflare D1 is provisioned and verified. Runtime deployment is waiting for Cloudflare's UTC date to accept compatibility date `2026-08-18`.**

## Implemented repository surface
- `AGENTS.md`
- `ROADMAP.md`
- `NEW_CHAT_BOOTSTRAP.md`
- `docs/TELEGRAM_DESIGN_RULES.md`
- `docs/ARCHITECTURE.md`
- `docs/CLOUDFLARE_HANDOFF.md`
- `docs/FAQ_CONTENT_POLICY.md`
- `package.json`
- `tsconfig.json`
- `wrangler.jsonc`
- `migrations/0001_initial.sql`
- `src/index.ts`
- `src/faq.ts`
- `deploy/worker.mjs` (Foundation v0.1 artifact; currently older than Phase 1 source)

## Telegram MVP core now implemented
- `/start` and `/language` language selector
- callback-query handling for `lang:my`, `lang:en`, `lang:zh`
- language preference persisted in D1 by immutable Telegram user ID
- 22 canonical FAQ records
- Burmese canonical source facts
- English and Simplified Chinese meaning-preserving translations
- deterministic per-language matching before AI
- canonical answer logging with `resolution=answered`, `matched_faq_key`, and `answer_source=canonical_faq`
- unresolved-question logging with `resolution=pending` and `answer_source=unresolved`
- localized unresolved/human-review response

## Canonical FAQ source
Creator-provided document: `SCHOOL of Nursing FAQ.docx`.

It contains 22 FAQ items. Burmese facts are authoritative. EN/ZH are translation layers. See `docs/FAQ_CONTENT_POLICY.md`.

Critical source facts include official channel, eligibility, entrance exam dates/subjects, application links, monthly fees, accreditation/licensing wording, CDM rules, bond conditions, three scholarship/loan schemes, opening period, payment in MMK, marital/pregnancy policy, academic breaks, and campus address.

## Verified Cloudflare infrastructure
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- Binding: `DB`
- Verified tables: `users`, `questions`, `admin_roles`, `admin_audit`
- Verified indexes: `idx_questions_user_created`, `idx_questions_resolution_created`
- workers.dev account subdomain: `ye-shwethway13`
- no production Worker
- no test Worker yet
- no KV, Durable Objects, Queues; R2 not enabled

## Cloudflare upload attempt evidence
The first exact Foundation v0.1 upload was rejected before Worker creation with:

`10021: Can't set compatibility date in the future: 2026-08-18`

Cloudflare was still on UTC 2026-08-17. No infrastructure drift occurred.

Compatibility-date rule: use a UTC-safe date. Once accepted, keep it fixed until a deliberate compatibility upgrade.

## Important deployment-artifact state
`deploy/worker.mjs` was generated from the earlier Foundation v0.1 `src/index.ts` and passed JavaScript syntax validation, but `src/index.ts` has now advanced with Phase 1 functionality and `src/faq.ts` has been added.

Therefore **do not treat the existing `deploy/worker.mjs` as the current Phase 1 build**. Regenerate/update the direct deployment artifact after the Phase 1 matcher/runtime logic is stabilized, before deploying the current `test` source.

## Validation state
- GitHub read/write on `test`: verified.
- D1 schema: live and verified.
- Full npm dependency/type validation: still pending because the available GitHub-side execution container cannot resolve `github.com` externally.
- Foundation JavaScript artifact syntax check: previously PASS.
- Phase 1 matcher/live Telegram/D1 behavior: not yet runtime-validated.
- Do not merge to `main` yet.

## Current known gaps
- focused deterministic matcher validation across 22 FAQs × 3 languages
- current Phase 1 deployment artifact regeneration
- Cloudflare Worker deployment/runtime checks
- Telegram bot token/webhook secret installation
- live language callback/persistence test
- live canonical answer and unresolved logging test
- EN/ZH wording review/polish while preserving Burmese facts
- Owner/Sudo Admin runtime implementation
- Gemini fallback

## Recommended next slice
Continue locally on `test`: harden/validate the deterministic FAQ matcher and translations, then regenerate the exact Phase 1 direct-deployment artifact. After Cloudflare UTC accepts `2026-08-18`, deploy the current test build to `school-of-nursing-faq-bot-test` with `DB` bound to `9109c1ef-3613-49f8-aee3-c62a3dbdd744` and `APP_ENV=test`. Verify `/health`, callback language persistence, canonical FAQ answers, answered/pending D1 logging, and safe unresolved behavior before any `main` merge.
