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
Status: PRODUCTION LIVE; MAIN-ONLY PIPELINE ACTIVE

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

## Verified production checkpoint
- production D1 and Worker are healthy
- production operational-data bootstrap completed green
- production Telegram webhook cutover completed green
- `/start` works through production
- Owner menu shows the expected 12 commands after exact Telegram read-back verification
- production uses a fresh `AI_CONFIG_MASTER_KEY`
- production AI provider credential still needs `/ai` setup

## Single production workflow
Canonical workflow: `.github/workflows/deploy-production.yml`

Relevant `main` pushes perform:
1. dependency install
2. typecheck
3. isolated production Wrangler config generation
4. local D1 migration validation
5. production Worker dry-run bundle validation
6. remote production D1 migrations
7. production Worker deploy
8. production `/health` verification requiring `environment=production`
9. one-time nonce-gated Owner command resync
10. exact Telegram `getMyCommands` read-back of all 12 Owner commands

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
1. verify the consolidated main-only production pipeline completes green
2. fix the remaining `/ai` Owner authorization inconsistency if still reproducible
3. configure production AI provider/API key through `/ai`
4. verify grounded AI, fallback and human handoff
5. continue feature work directly on `main` in small validated slices

## Current migrations
0001 through 0010. Canonical 0010: `migrations/0010_manual_newline_cleanup.sql`.

## Deferred validation debt
- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
