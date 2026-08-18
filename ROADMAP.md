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
Status: PRODUCTION LIVE; MAIN-ONLY PIPELINE ACTIVE; AI SETUP HARDENED

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
- AI API-key setup now catches encryption/configuration failures and returns an explicit Owner-visible error instead of silently stopping

## Verified production checkpoint
- production D1 and Worker are healthy
- production operational-data bootstrap completed green
- production Telegram webhook cutover completed green
- `/start` works through production
- Owner menu shows the expected 12 commands after exact Telegram read-back verification
- `BOT_OWNER_TELEGRAM_ID` is required as a Cloudflare `secret_text` binding
- `AI_CONFIG_MASTER_KEY` is required as a Cloudflare `secret_text` binding
- production AI provider credential setup is the current active validation target

## AI configuration contract
`AI_CONFIG_MASTER_KEY` must be Base64 representing exactly 32 random bytes. It is used as the AES-GCM key for encrypting provider credentials in D1.

Changing the master key invalidates credentials encrypted with an older master key; those provider credentials must be entered again through `/ai`.

`secure_entry.ts` now catches AI setup encryption/configuration exceptions, best-effort deletes submitted secret input, and sends a clear recovery message to the Owner instead of allowing the webhook path to fail silently.

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
12. exact Telegram `getMyCommands` read-back of all 12 Owner commands

Only this workflow remains active in `.github/workflows`.

## Retired workflows
Removed from the live tree after successful completion/consolidation:
- TEST deployment
- TEST build/typecheck handoff workflow
- production operational-data bootstrap
- one-time Telegram production cutover
- separate Owner command-resync workflow

Their history remains available in Git.

## Owner command registry
Expected Owner commands:
`/start`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

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
1. replace production `AI_CONFIG_MASTER_KEY` with a valid 32-byte Base64 Cloudflare secret
2. let the current main production pipeline deploy the hardened AI setup handler
3. rerun `/ai` -> Google Gemini -> send the Gemini API key privately
4. verify encrypted credential save, key-message deletion, model fetch and model binding
5. verify grounded AI, fallback and human handoff

## Current migrations
0001 through 0010. Canonical 0010: `migrations/0010_manual_newline_cleanup.sql`.

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
