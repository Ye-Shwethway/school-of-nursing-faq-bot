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
Status: IMPLEMENTED ON `test`; RUNTIME VALIDATION PENDING

Completed on `test`:
- Repository/project operating rules in `AGENTS.md`.
- Mandatory branch policy: develop/validate on `test`, merge verified state to `main`.
- Living continuity docs: `ROADMAP.md` and `NEW_CHAT_BOOTSTRAP.md`.
- University-grade Telegram UX/design contract.
- Architecture baseline.
- TypeScript/Cloudflare Worker project configuration.
- Initial D1 schema for users, questions, Sudo Admin roles, and admin audit events.
- Worker routes: `GET /health` and `POST /telegram/webhook`.
- Optional Telegram webhook secret-header verification.
- `/start` and `/language` multilingual language-selection keyboard foundation.
- Telegram user metadata upsert and free-text question logging when D1 is bound.
- Runtime secret placeholders only; no secrets committed.
- Current tooling versions aligned with the package registry on 2026-08-18.

Validation state:
- Repository writes/reads on `test` verified through the GitHub connector.
- Local clone/install/typecheck could not run in the available execution container because outbound DNS to `github.com` is unavailable. This is an environment limitation, not a reported TypeScript failure.
- Do not merge Foundation v0.1 to `main` until a real dependency install/typecheck or equivalent Cloudflare validation passes.

## Phase 1 — Telegram MVP
Status: PLANNED

- `/start` language selector: မြန်မာ / English / 简体中文
- `/language` switcher with persisted preference
- callback-query handling and persisted language choice
- canonical FAQ loader and deterministic matching
- aligned meaning across all three languages
- no-match path and human escalation
- record user metadata and meaningful submitted questions

Acceptance: a real Telegram webhook receives a question, resolves language, answers a canonical FAQ, and persists the interaction.

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

- Provision Cloudflare D1.
- Configure Worker secrets/bindings.
- Configure Telegram webhook.
- Configure GitHub Actions secrets/workflow if used.
- Deploy and run focused production smoke checks.

## Phase 5 — Operations
Status: PLANNED

- Staff review flow for unresolved questions.
- FAQ content update workflow.
- Basic retention/privacy policy for logged user/question records.
- Right-sized production observability.

## Canonical content
The source FAQ document contains 22 core questions. Canonical Burmese facts are the source of truth; English and Simplified Chinese translations must preserve meaning. Do not invent or silently alter dates, costs, accreditation, eligibility, application, scholarship/loan/bond, or policy facts.

## Next recommended slice
Validate Foundation v0.1 with a real Worker dependency install/typecheck, provision the Cloudflare D1 binding, then connect and smoke-test the first live Telegram webhook. Keep the work on `test`; merge to `main` only after validation is green.
