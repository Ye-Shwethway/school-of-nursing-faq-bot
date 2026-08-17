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
- D1 language preference persistence by immutable Telegram user ID
- canonical FAQ answer selection before AI
- answered-question logging with `matched_faq_key` and `answer_source=canonical_faq`
- unresolved-question logging with `resolution=pending` and `answer_source=unresolved`
- localized no-match/human-review response

Pending validation/work:
- focused matcher validation across all 22 FAQs and all three languages
- live Telegram callback test
- live D1 persistence test
- webhook secret configuration
- EN/ZH wording review without changing Burmese source facts
- regenerate direct Cloudflare deployment artifact after current source stabilizes; existing `deploy/worker.mjs` is the earlier Foundation v0.1 artifact

Acceptance: a real Telegram webhook receives a question, resolves/persists language, answers a canonical FAQ deterministically, and persists the interaction.

## Phase 2 — Owner / Sudo Admin
Status: AUTHORIZATION CORE IMPLEMENTED ON `test`; RUNTIME VALIDATION PENDING

Implemented in `src/admin.ts` and wired into `src/index.ts`:
- Owner identity sourced only from `BOT_OWNER_TELEGRAM_ID`
- numeric immutable Telegram user ID validation
- D1-backed `sudo_admin` role lookup
- `/admin` and `/admin status`
- `/admin help`
- `/admins` authorized administrator listing
- Owner-only `/sudo grant <telegram_user_id>`
- Owner-only `/sudo revoke <telegram_user_id>`
- protection against revoking/downgrading the Owner through Sudo Admin management
- server-side authorization checks; usernames are not authority
- audit rows for Sudo Admin grant/revoke operations
- admin commands bypass normal FAQ/question logging

Pending:
- live Owner secret configuration
- unauthorized-user negative tests
- live D1 role grant/revoke/list tests
- admin view for unresolved questions
- user lookup/follow-up tooling

Acceptance: unauthorized users cannot modify roles; Owner can grant/revoke Sudo Admins by Telegram user ID; privileged mutations are auditable.

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
Continue on `test` while Cloudflare waits for UTC rollover: validate/harden FAQ matching and admin authorization behavior, then regenerate the current Phase 1/2 direct deployment artifact. After Cloudflare accepts `2026-08-18`, deploy the current build to `school-of-nursing-faq-bot-test` and validate `/health`, D1 binding, language persistence, canonical answering, unresolved logging, and Owner/Sudo Admin authorization before any `main` merge.
