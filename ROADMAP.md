# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Canonical FAQ answers come first, configurable grounded AI fallback second, human escalation when needed.

## Branch policy
- `test`: active development and validation branch.
- `main`: verified canonical/production branch.
- Development must not be performed directly on `main`.
- Merge `test` to `main` only after the current slice is validated.

## Locked architecture
- Telegram Bot API webhook
- Cloudflare Workers runtime
- Cloudflare D1 persistence
- canonical multilingual FAQ records
- deterministic FAQ match before AI
- configurable multi-provider AI fallback grounded only in approved knowledge
- primary + fallback AI model binding
- human escalation for uncertain/unanswered questions
- Bot Owner + Sudo Admin authorization by immutable Telegram user ID
- user/question logging for staff follow-up
- GitHub Actions deployment later in the production phase
- public repo; secrets never committed

## Phase 0 — Foundation v0.1
Status: IMPLEMENTED ON `test`; CLOUDFLARE RUNTIME VALIDATION WAITING FOR UTC DATE ROLLOVER

Completed:
- repository/project operating rules and living continuity docs
- university-grade Telegram UX/design contract
- TypeScript/Cloudflare Worker configuration
- initial D1 schema for users, questions, Sudo Admin roles, and audit events
- Worker routes `GET /health` and `POST /telegram/webhook`
- Cloudflare D1 database `school-of-nursing-faq-bot-db`
- D1 database ID `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- initial D1 schema verified: 4 tables + 2 indexes
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
- regenerate current deployment artifact/build after source stabilizes; existing `deploy/worker.mjs` is stale Foundation-only code

Acceptance: a real Telegram webhook receives a question, resolves/persists language, answers a canonical FAQ deterministically, and persists the interaction.

## Phase 2 — Owner / Sudo Admin
Status: AUTHORIZATION CORE IMPLEMENTED ON `test`; RUNTIME VALIDATION PENDING

Implemented:
- Owner identity sourced only from `BOT_OWNER_TELEGRAM_ID`
- numeric immutable Telegram user ID validation
- D1-backed `sudo_admin` role lookup
- `/admin` and `/admin status`
- `/admin help`
- `/admins`
- Owner-only `/sudo grant <telegram_user_id>`
- Owner-only `/sudo revoke <telegram_user_id>`
- protection against revoking/downgrading the Owner
- server-side authorization checks; usernames are not authority
- audit rows for Sudo Admin grant/revoke operations
- admin commands bypass normal FAQ/question logging

Pending:
- live Owner configuration
- unauthorized-user negative tests
- live D1 role grant/revoke/list tests
- admin unresolved-question view
- user lookup/follow-up tooling

## Phase 3 — Configurable grounded AI fallback
Status: PROVIDER SETTINGS CORE IMPLEMENTED ON `test`; AGENT RUNTIME/DEPLOYMENT VALIDATION PENDING

Implemented:
- Owner-only Telegram entry point: `/ai`
- provider registry:
  - OpenAI
  - Anthropic
  - Google Gemini
  - OpenRouter
  - Groq
  - Mistral
  - Custom OpenAI-compatible HTTPS endpoint
- provider API key entry from Telegram settings
- AES-256-GCM encryption before D1 persistence
- master encryption key supplied only as Cloudflare secret `AI_CONFIG_MASTER_KEY`
- best-effort deletion of Telegram messages containing provider API keys after capture
- provider model-list fetching from live provider APIs; model IDs are not hard-coded
- D1 model cache with short Telegram callback tokens
- explicit model-level **Test Ping** generation request
- model cannot be bound until Test Ping has passed
- save/bind selected model as Primary or Fallback
- primary and fallback may use different providers
- current binding status view
- Custom provider base URL + key setup
- schema migration `migrations/0002_ai_settings.sql`
- design/security contract in `docs/AI_SETTINGS.md`

Provider/API references were checked against current official documentation on 2026-08-18.

Pending:
- apply migration `0002_ai_settings.sql` to Cloudflare D1
- provision `AI_CONFIG_MASTER_KEY` as a Cloudflare secret
- live Owner `/ai` UI validation
- live credential encryption/decryption validation
- model-list tests for supported providers
- model ping tests
- actual grounded fallback inference orchestration using the bound primary/fallback pair
- fallback-on-provider/model-error behavior
- unresolved escalation if both models fail or cannot answer from approved context

AI remains downstream of deterministic canonical FAQ matching. Provider/model configuration never authorizes invention of policy-sensitive facts.

## Phase 4 — Production deployment
Status: PLANNED

- deploy canonical `main` to Worker `school-of-nursing-faq-bot` only after validated merge
- configure Worker secrets/bindings
- configure Telegram webhook
- configure GitHub Actions secrets/workflow if used
- run focused production smoke checks

## Phase 5 — Operations
Status: PLANNED

- staff review flow for unresolved questions
- FAQ content update workflow
- basic retention/privacy policy for logged user/question records
- right-sized production observability

## Canonical content
The current source document contains 22 core FAQs. Burmese facts are authoritative. English and Simplified Chinese are translation layers and must preserve the Burmese meaning. Policy-sensitive dates, costs, accreditation, eligibility, application, scholarship/loan/bond, academic, contact, and campus facts must never be invented or silently altered.

## Compatibility-date rule
Cloudflare compatibility dates must be based on a UTC-safe date, not merely the Creator's local calendar date. Once a compatibility date is accepted, keep it fixed until a deliberate runtime-compatibility upgrade requires changing it.

## Next recommended slice
Stabilize the current combined Telegram MVP + Admin + AI Settings source on `test`, then prepare the current deployable build. When Cloudflare UTC accepts `2026-08-18`, apply D1 migration `0002_ai_settings.sql`, deploy to `school-of-nursing-faq-bot-test`, configure only the minimum required test secrets, and validate `/health`, D1 bindings, language persistence, FAQ answering/logging, Owner/Sudo authorization, encrypted AI credential setup, model fetch, Test Ping, and primary/fallback binding. Do not merge to `main` until the test checkpoint is green.
