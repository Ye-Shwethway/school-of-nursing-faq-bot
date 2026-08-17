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

## Current checkpoint
**Foundation v0.1 is implemented on `test` but not yet merged to `main`.**

Implemented repository surface:
- `AGENTS.md`
- `ROADMAP.md`
- `NEW_CHAT_BOOTSTRAP.md`
- `docs/TELEGRAM_DESIGN_RULES.md`
- `docs/ARCHITECTURE.md`
- `package.json`
- `tsconfig.json`
- `wrangler.jsonc`
- `migrations/0001_initial.sql`
- `src/index.ts`

Runtime foundation currently includes:
- `GET /health`
- `POST /telegram/webhook`
- optional Telegram secret-token header verification
- `/start` and `/language` multilingual language keyboard foundation
- Telegram user metadata upsert when D1 is bound
- free-text question logging when D1 is bound
- D1 tables for users, questions, Sudo Admin roles, and privileged audit events

No production Telegram webhook or Cloudflare deployment should be assumed active until verified in the live services.

## Validation evidence
- GitHub repository read/write access is working on `test`.
- Current Worker tooling versions were checked against the package registry on 2026-08-18.
- A real local `npm install`/`npm run typecheck` could not execute in the available container because outbound DNS to `github.com` is unavailable. No TypeScript failure has been observed; validation is simply incomplete.
- Do not merge this checkpoint to `main` until dependency/type validation or equivalent Cloudflare validation is green.

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
- Foundation dependency/type validation is still pending.
- Canonical 22-FAQ dataset has not yet been committed to this repository.
- Language callback handling/persistence is not yet implemented.
- Cloudflare D1 resource and Worker deployment must be provisioned/verified.
- Telegram bot token/webhook configuration must be supplied through secrets.
- Gemini fallback is not yet production-enabled.
- Owner Telegram user ID must be configured securely before privileged management is enabled.

## Recommended next slice
Validate the Worker foundation in a real Cloudflare-capable environment, provision D1 and bind it to the Worker on `test`, then connect and smoke-test the first Telegram webhook. After that, import the approved 22-FAQ multilingual dataset and implement deterministic answering. Merge to `main` only after the current validated checkpoint is green.
