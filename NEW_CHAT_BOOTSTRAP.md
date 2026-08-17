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
4. only the task-relevant docs/source referenced by those files

Treat the live repository plus verified Cloudflare/Telegram production evidence as authoritative over remembered chat context.

## Branch contract
- Work on `test`.
- Do not implement directly on `main`.
- Validate the current slice on `test`.
- Merge to `main` only when the slice is verified and ready to become canonical.
- Validation deployment target: `school-of-nursing-faq-bot-test`.
- Production Worker target after validated merge: `school-of-nursing-faq-bot`.

## Current checkpoint
**Foundation v0.1 is implemented on `test`; Cloudflare D1 is provisioned/verified; the first test Worker upload was safely rejected only because Cloudflare UTC was still 2026-08-17 while compatibility date is 2026-08-18. Retry after UTC rollover with no code change.**

Implemented repository surface:
- `AGENTS.md`
- `ROADMAP.md`
- `NEW_CHAT_BOOTSTRAP.md`
- `docs/TELEGRAM_DESIGN_RULES.md`
- `docs/ARCHITECTURE.md`
- `docs/CLOUDFLARE_HANDOFF.md`
- `package.json`
- `tsconfig.json`
- `wrangler.jsonc`
- `migrations/0001_initial.sql`
- `src/index.ts`
- `deploy/worker.mjs`

Runtime foundation currently includes:
- `GET /health`
- `POST /telegram/webhook`
- optional Telegram secret-token header verification
- `/start` and `/language` multilingual language keyboard foundation
- Telegram user metadata upsert when D1 is bound
- free-text question logging when D1 is bound
- D1 tables for users, questions, Sudo Admin roles, and privileged audit events

## Verified Cloudflare infrastructure
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1 database: `school-of-nursing-faq-bot-db`
- D1 database ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- Binding name: `DB`
- Migration: applied and verified
- Verified tables: `users`, `questions`, `admin_roles`, `admin_audit`
- Verified indexes: `idx_questions_user_created`, `idx_questions_resolution_created`
- Existing workers.dev account subdomain: `ye-shwethway13`
- KV namespaces: 0
- Durable Object namespaces: 0
- Queues: 0
- R2: not enabled
- Production Worker `school-of-nursing-faq-bot`: not created
- Test Worker `school-of-nursing-faq-bot-test`: not created at this checkpoint because upload was rejected before creation

## Direct Cloudflare API deployment artifact
`deploy/worker.mjs` is the exact GitHub-side JavaScript deployment artifact derived from the current `src/index.ts` foundation.

- Source TypeScript blob: `1b5a5772d799e165fa9f8449cd333d02dc6fdd58`
- Deployment artifact SHA-256: `05c2a5ba086469a559bc5a9d6eddd0c65c334e93a11d6fd89cd79e3475dbde98`
- Local `node --check` validation: PASS

Cloudflare must upload this exact artifact rather than independently rewriting application behavior.

## Cloudflare upload attempt evidence
The first exact test Worker upload used compatibility date `2026-08-18` and was rejected by Cloudflare before Worker creation with:

`10021: Can't set compatibility date in the future: 2026-08-18`

At the time, Cloudflare's API clock was still UTC 2026-08-17. The configuration was intentionally not changed to `2026-08-17`, preserving the canonical GitHub handoff.

The failed upload caused no infrastructure drift:
- no test Worker created
- no production Worker created
- no D1 schema change (`changed_db: false`)
- no bindings created
- no secrets created
- no extra Cloudflare products created

No GitHub-side code or config change is required. Retry the same deployment after Cloudflare UTC reaches 2026-08-18.

## Validation evidence
- GitHub repository read/write access is working on `test`.
- Local dependency install/typecheck could not execute in the available container because outbound DNS to `github.com` is unavailable. No TypeScript failure has been observed; validation is incomplete rather than failed.
- `deploy/worker.mjs` passed local JavaScript syntax validation.
- D1 schema is live and verified in Cloudflare.
- Runtime Worker validation remains pending only because of the UTC compatibility-date boundary.
- Do not merge this checkpoint to `main` until the test Worker runtime is green.

## Product contract
Build a dignified university School of Nursing Telegram FAQ bot with:
- Burmese, English, Simplified Chinese
- `/start` language selection and `/language` switching
- deterministic approved FAQ answer first
- grounded Gemini fallback only after deterministic matching fails
- human escalation when uncertain/unanswered
- Bot Owner and Sudo Admin management
- recording Telegram user ID, username when available, names when available, language, timestamps, and questions for authorized follow-up
- Cloudflare Workers + D1
- GitHub Actions deployment later if useful

## Canonical knowledge contract
The source FAQ document contains 22 core FAQs. Burmese canonical facts are authoritative; EN/ZH are meaning-preserving translations. Policy-sensitive content such as dates, fees, eligibility, accreditation, applications, scholarships/loans/bonds must never be invented by AI.

## Security contract
The repository is public. Never commit Telegram bot tokens, Gemini API keys, Cloudflare credentials, webhook secrets, private user logs, or production database exports.

Admin authority is based on immutable Telegram user ID, not username.

## UX contract
Follow `docs/TELEGRAM_DESIGN_RULES.md`: clean, restrained, university-appropriate, button-led where useful, concise multilingual copy, no clutter or gimmicky styling.

## Continuity rule
A meaningful implementation slice is not complete until both this file and `ROADMAP.md` are updated to reflect:
- what changed
- verified state/evidence
- unresolved gaps
- current architecture/schema changes
- exact recommended next slice

## Current known gaps
- Test Worker `school-of-nursing-faq-bot-test` must be retried after Cloudflare UTC reaches 2026-08-18, then health/binding/runtime checks must pass.
- Full dependency/type validation is still pending because the GitHub-side execution container has no outbound GitHub DNS.
- Canonical 22-FAQ dataset has not yet been committed to this repository.
- Language callback handling/persistence is not yet implemented.
- Telegram bot token/webhook configuration is not yet installed.
- Gemini fallback is not yet production-enabled.
- Owner Telegram user ID must be configured securely before privileged management is enabled.

## Recommended next slice
After Cloudflare UTC reaches 2026-08-18, retry the exact existing `deploy/worker.mjs` upload to Worker `school-of-nursing-faq-bot-test` with compatibility date `2026-08-18`, D1 binding `DB` → `9109c1ef-3613-49f8-aee3-c62a3dbdd744`, and `APP_ENV=test`. Then verify `/health`, unknown-route 404, malformed-webhook 400, Worker settings/binding, and D1 integrity. Return that runtime evidence to the GitHub session. Do not configure Telegram secrets/webhook or merge to `main` until this checkpoint is green.
