# AGENTS.md

## Purpose
Keep implementation fast, simple, and production-oriented. Avoid over-engineering.

## Required startup order
Before changing code or architecture, read:
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant docs/source referenced by those files

Current repository evidence is authoritative over remembered chat context.

## Branch policy
- `test` is the active development branch.
- `main` is the verified canonical/production branch.
- Do not implement directly on `main`.
- Develop and validate on `test`; merge to `main` only after review/verification.

## Working rules
- Prefer the smallest runnable implementation slice.
- Keep folder structure understandable to a human maintainer.
- Do not add infrastructure, abstractions, frameworks, or tests without a concrete need.
- Preserve deterministic FAQ behavior for canonical facts.
- AI fallback must be grounded in approved School of Nursing knowledge and must not invent dates, fees, accreditation claims, admission rules, bond/loan/scholarship terms, or policy facts.
- Escalate when confidence is insufficient.
- Keep Burmese, English, and Simplified Chinese behavior aligned in meaning.
- This repository is public. Never commit secrets, Telegram tokens, Gemini keys, Cloudflare credentials, private Telegram user records, or production exports.

## Owner/Admin rules
- Bot Owner is the highest authority.
- Sudo Admins are explicitly authorized and identified by immutable Telegram user ID, never username alone.
- Privileged commands must be authorization-checked server-side.
- Role changes must be auditable.

## User/question logging
Store only operationally useful Telegram identity metadata: Telegram user ID, username when available, names when available, language preference, timestamps, and submitted question/history required for follow-up. Never expose these records publicly.

## Telegram UX
Follow `docs/TELEGRAM_DESIGN_RULES.md`.

## Continuity contract — mandatory
`ROADMAP.md` and `NEW_CHAT_BOOTSTRAP.md` are living canonical project-state files.

At the end of every completed implementation slice that changes behavior, architecture, schema, deployment, validation state, or next-step recommendation:
1. update `ROADMAP.md` with completed/current/next status;
2. update `NEW_CHAT_BOOTSTRAP.md` with the exact latest checkpoint, verified evidence, known gaps, and recommended next slice;
3. keep both documents consistent with repository reality before considering the slice complete.

Documentation-only spelling/formatting changes do not require a roadmap checkpoint unless meaning changes.

## Validation
Use focused checks for the changed slice. Critical boundaries requiring explicit validation include webhook parsing, privilege enforcement, canonical FAQ selection, persistence migrations, language preference behavior, escalation/logging paths, and deployment configuration.
