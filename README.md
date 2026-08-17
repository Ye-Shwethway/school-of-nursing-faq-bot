# School of Nursing FAQ Bot

A multilingual Telegram FAQ bot for a university School of Nursing, built on Cloudflare Workers.

## Goals

- Answer approved School of Nursing FAQs in Burmese, English, and Simplified Chinese.
- Prefer deterministic, canonical FAQ answers before any AI fallback.
- Use a grounded Gemini fallback only when an approved FAQ does not directly answer the user.
- Escalate uncertain or unanswered questions for human follow-up.
- Record Telegram user identity metadata and submitted questions for authorized staff follow-up.
- Provide Bot Owner and Sudo Admin management.
- Keep the Telegram experience formal, clean, accessible, and appropriate for a university.

## Planned stack

- Telegram Bot API webhook
- Cloudflare Workers
- Cloudflare D1 for persistent application data
- Gemini API for grounded fallback
- GitHub Actions for automated deployment

## Project continuity

Before implementation work, read `AGENTS.md`, `NEW_CHAT_BOOTSTRAP.md`, and `ROADMAP.md`.

`ROADMAP.md` and `NEW_CHAT_BOOTSTRAP.md` are living project documents and must be updated whenever a completed implementation slice changes project state, architecture, deployment state, or the recommended next step.

## Security

This is a public repository. Never commit bot tokens, API keys, Cloudflare secrets, private user records, or other credentials. Runtime secrets belong in Cloudflare/GitHub secret storage only.
