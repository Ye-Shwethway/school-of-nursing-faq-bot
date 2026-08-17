# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Canonical FAQ answers come first, grounded Gemini fallback second, human escalation when needed.

## Branch policy
- `test`: active development and validation branch.
- `main`: verified canonical/production branch.
- Development must not be performed directly on `main`.
- Merge `test` to `main` only after the current slice is validated.

## Locked architecture
- Telegram Bot API webhook
- Cloudflare Workers runtime
- Cloudflare D1 persistence
- Canonical multilingual FAQ records
- Deterministic FAQ match before AI
- Gemini grounded fallback only against approved knowledge
- Human escalation for uncertain/unanswered questions
- Bot Owner + Sudo Admin authorization by immutable Telegram user ID
- User/question logging for staff follow-up
- GitHub Actions deployment later in the production phase
- Public repo; secrets never committed

## Phase 0 — Foundation v0.1
Status: IMPLEMENTED ON `test`; CLOUDFLARE RUNTIME VALIDATION WAITING FOR UTC DATE ROLLOVER

Completed:
- repository/project operating rules and living continuity docs
- university-grade Telegram UX/design contract
- TypeScript/Cloudflare Worker configuration
- D1 schema for users, questions, Sudo Admin roles, and audit events
- Worker routes `GET /health` and `POST /telegram/webhook`
- Cloudflare D1 database `school-of-nursing-faq-bot-db`
- D1 database ID `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- verified D1 schema: 4 tables + 2 indexes
- separate validation Worker target `school-of-nursing-faq-bot-test`

Validation state:
- first Worker upload was safely rejected with Cloudflare error `10021` because compatibility date `2026-08-18` was still in the future according to Cloudflare UTC
- no Worker/binding/secret/schema drift occurred
- compatibility date must remain UTC-safe for future deployments
- do not merge to `main` until runtime validation is green

## Phase 1 — Telegram MVP
Status: CORE IMPLEMENTED ON `test`; RUNTIME/TRANSLATION VALIDATION PENDING

Implemented:
- canonical 22-FAQ dataset in `src/faq.ts`
- Burmese source facts derived from the Creator-provided `SCHOOL of Nursing FAQ.docx`
- meaning-preserving English and Simplified Chinese translation layer
- FAQ content policy in `docs/FAQ_CONTENT_POLICY.md`
- deterministic per-language FAQ matcher
- `/start` language selector: မြန်မာ / English / 简体中文
- `/language` language switcher
- Telegram callback-query handling for `lang:my`, `lang:en`, `lang:zh`
- D1 language preference persistence on immutable Telegram user ID
- canonical FAQ answer selection before AI
- answered-question logging with `matched_faq_key` and `answer_source=canonical_faq`
- unresolved-question logging with `resolution=pending` and `answer_source=unresolved`
- localized no-match/human-review response

Pending validation/work:
- focused matcher validation across all 22 FAQs and all three languages
- live Telegram callback test
- live D1 persistence test
- webhook secret configuration
- review/polish of EN/ZH translation wording without changing Burmese source facts
- regenerate the direct Cloudflare deployment artifact after Phase 1 code stabilizes; the existing `deploy/worker.mjs` represents the earlier Foundation v0.1 source and must not be treated as the current Phase 1 build

Acceptance: a real Telegram webhook receives a user question, resolves/persists language, answers a canonical FAQ deterministically, and persists the interaction.

## Phase 2 — Owner / Sudo Admin
Status: PLANNED

- Bootstrap Owner from configured immutable Telegram user ID.
- Owner-only Sudo Admin grant/revoke.
- Admin status/help/list commands.
- Recent unanswered/escalated-question view.
- User lookup by Telegram ID/username where available.
- Auditable privileged actions.

Acceptance: unauthorized users cannot access admin functions; authorized staff can identify users/questions requiring follow-up.

## Phase 3 — Grounded Gemini fallback
Status: PLANNED

- Invoke only after deterministic FAQ match fails.
- Ground only in approved School of Nursing content.
- Never invent policy-sensitive facts.
- Record fallback outcome and escalate when grounding is insufficient.

## Phase 4 — Production deployment
Status: PLANNED

- Deploy canonical `main` to Worker `school-of-nursing-faq-bot` only after validated merge.
- Configure Worker secrets/bindings.
- Configure Telegram webhook.
- Configure GitHub Actions secrets/workflow if used.
- Run focused production smoke checks.

## Phase 5 — Operations
Status: PLANNED

- Staff review flow for unresolved questions.
- FAQ content update workflow.
- Basic retention/privacy policy for logged user/question records.
- Right-sized production observability.

## Canonical content
The current source document contains 22 core FAQs. Burmese facts are authoritative. English and Simplified Chinese are translation layers and must preserve the Burmese meaning. Policy-sensitive dates, costs, accreditation, eligibility, application, scholarship/loan/bond, academic, contact, and campus facts must never be invented or silently altered.

## Compatibility-date rule
Cloudflare compatibility dates must be based on a UTC-safe date, not merely the Creator's local calendar date. Once a compatibility date is accepted, keep it fixed until a deliberate runtime-compatibility upgrade requires changing it.

## Next recommended slice
While waiting for Cloudflare UTC rollover, validate and harden the Phase 1 deterministic FAQ matcher on `test`, then regenerate the current direct-deployment artifact. After Cloudflare accepts the compatibility date, deploy the current `test` build to `school-of-nursing-faq-bot-test`, verify `/health`, D1 binding, language callback persistence, canonical answering, and unresolved-question logging. Do not merge to `main` until those checks are green.
