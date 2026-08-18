# School of Nursing FAQ Bot

Production multilingual Telegram FAQ assistant for a university School of Nursing, running on Cloudflare Workers with Cloudflare D1.

## Core behavior

- Burmese, English, and Simplified Chinese user experience.
- Deterministic approved FAQ answers first.
- Grounded configurable AI Primary/Fallback second.
- Human Staff Inbox handoff when automation cannot answer safely.
- Anonymous staff reply relay back to the original Telegram user.
- Bot Owner and Sudo Admin management by immutable Telegram numeric ID.
- Staff availability, notification control, Take Over / Return to AI, and per-user forum topics.
- Editable in-Telegram Owner and Admin manuals.

## Production stack

- Telegram Bot API webhook
- Cloudflare Workers
- Cloudflare D1
- Configurable AI providers with encrypted credentials
- GitHub Actions single production pipeline

## Branch and deployment model

`main` is the single active development, canonical, and production source branch.

The historical `test` branch is dormant/reference-only and has no active workflow or deployment role.

Relevant pushes to `main` automatically run the production validation/deployment workflow in `.github/workflows/deploy-production.yml`.

## Project continuity

Before implementation work, read in this order:

1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant docs/source

Live repository and verified production evidence are authoritative over remembered chat context.

## Security

This is a public repository. Never commit bot tokens, provider API keys, Cloudflare secrets, Owner Telegram ID values, private user records, D1 exports, or other credentials.

Runtime secrets belong in Cloudflare Worker secret storage. GitHub production secrets are limited to deployment credentials and the production D1 identifier required by the workflow.
