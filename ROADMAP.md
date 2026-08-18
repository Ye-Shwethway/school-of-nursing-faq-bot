# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch and deployment policy
- `main` is the single active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- no TEST workflows or TEST deployments remain active.
- relevant `main` pushes run the single production pipeline automatically.

## Current foundation
Status: PRODUCTION LIVE; MAIN-ONLY PIPELINE ACTIVE; AI SETUP WORKING

Implemented:
- multilingual dynamic FAQ
- Owner/Sudo roles and scoped commands
- encrypted configurable AI Primary/Fallback
- grounded AI + human handoff
- Staff Inbox monitoring and Take Over / Return to AI
- editable/addable Owner/Admin manuals
- production D1 bootstrap completed
- production Telegram webhook cutover completed
- Owner command registry verified through Telegram read-back
- TEST deployment notices suppressed at runtime
- TEST/one-time workflow clutter retired
- production runtime-binding preflight/postflight checks
- AI API-key setup catches encryption/configuration failures and returns an explicit Owner-visible error instead of silently stopping
- `/language` is a visible public command for all users and therefore inherited by Sudo/Admin and Owner command sets

## Verified production checkpoint
- production D1 and Worker are healthy
- production operational-data bootstrap completed green
- production Telegram webhook cutover completed green
- `/start` works through production
- `BOT_OWNER_TELEGRAM_ID` is configured as a Cloudflare `secret_text` binding
- `AI_CONFIG_MASTER_KEY` is configured as a valid Cloudflare `secret_text` binding
- production Gemini provider setup is working after replacing the master key with valid Base64 for exactly 32 random bytes
- user reports current production setup is functioning; latest requested UX change is making `/language` visible in all command menus

## AI configuration contract
`AI_CONFIG_MASTER_KEY` must be Base64 representing exactly 32 random bytes. It is used as the AES-GCM key for encrypting provider credentials in D1.

Changing the master key invalidates credentials encrypted with an older master key; those provider credentials must be entered again through `/ai`.

`secure_entry.ts` catches AI setup encryption/configuration exceptions, best-effort deletes submitted secret input, and sends a clear recovery message to the Owner instead of allowing the webhook path to fail silently.

## Single production workflow
Canonical workflow: `.github/workflows/deploy-production.yml`

Relevant `main` pushes perform:
1. production credential and runtime-binding preflight
2. dependency install
3. typecheck
4. isolated production Wrangler config generation
5. local D1 migration validation
6. production Worker dry-run bundle validation
7. remote production D1 migrations
8. production Worker deploy
9. runtime-binding postflight
10. production `/health` verification requiring `environment=production`
11. one-time nonce-gated Owner command resync
12. exact Telegram `getMyCommands` read-back of all 13 Owner commands

Only this workflow remains active in `.github/workflows`.

## Command registry
Public commands visible to every user:
`/start`, `/language`, `/whoami`.

Sudo Admin inherits the public set and adds:
`/admin`, `/admins`, `/faq`, `/adminmanual`.

Expected Owner commands:
`/start`, `/language`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

Command schema revision is bumped whenever a visible command set changes so Telegram registration is refreshed.

## Environment isolation rule
`notifyDeploymentOnline()` is production-only. Historical TEST runtime must not inject deployment messages into the live Owner chat.

## Canonical Worker stack
Wrangler enters `src/manual_entry.ts`.

1. manual pager/edit/add + command sync
2. deployment notice + production ops endpoints
3. latest Return-to-AI control
4. monitoring presentation / isolated handoff
5. Staff Inbox UX
6. Telegram UX polish
7. secure AI setup interception
8. dynamic FAQ/AI runtime
9. compatibility fallback + `/health`

## Next exact work
1. verify the `/language` visibility deployment completes green with exact 13-command Owner read-back
2. confirm `/language` is visible for a normal user as well as Owner
3. continue grounded AI/fallback/handoff production smoke if needed
4. continue feature work directly on `main` in small validated slices

## Current migrations
0001 through 0010. Canonical 0010: `migrations/0010_manual_newline_cleanup.sql`.

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
