# Production Promotion Runbook

Last updated: 2026-08-18

## Purpose
Promote the validated TEST bot to `main` and then deploy a deliberately isolated production Worker without turning every `main` update into an automatic live release.

## Branch contract
- `test` = active development and live TEST validation
- `main` = canonical production source
- production deployment is manual-only
- merging to `main` does not automatically deploy Cloudflare production

## Production isolation
Production must use a D1 database separate from the TEST database.

Expected production database name:
`school-of-nursing-faq-bot-prod-db`

The production D1 UUID is not committed to this public repository. Store it as the GitHub Actions secret:
`CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`

The production workflow generates a temporary Wrangler config during the job and deletes it afterwards.

TEST continues to use the existing TEST Worker/database configuration in `wrangler.jsonc`.

## Production workflow
File:
`.github/workflows/deploy-production.yml`

Trigger:
- manual `workflow_dispatch` only
- workflow must be run from `main`
- confirmation input must equal `DEPLOY_PRODUCTION`

The workflow:
1. checks out `main`
2. verifies Cloudflare credentials and the production D1 ID secret
3. installs dependencies
4. runs strict TypeScript typecheck
5. generates an isolated temporary production Wrangler config
6. validates migrations locally
7. performs a production Worker dry run
8. applies migrations to the production D1 database
9. deploys `school-of-nursing-faq-bot`
10. verifies `/health` reports `environment=production`
11. removes the temporary Wrangler config

## Required GitHub Actions secrets
Already used by TEST and reusable for production:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

New production-specific secret:
- `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`

Do not commit API tokens, Telegram tokens, encryption keys, or D1 exports.

## Cloudflare-side runtime secrets
The production Worker needs its own live runtime secret configuration before the Telegram webhook is moved to it:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `BOT_OWNER_TELEGRAM_ID`
- `AI_CONFIG_MASTER_KEY`

Provider credentials, FAQ content, manuals, roles, and Staff Inbox configuration are D1 data and therefore must be deliberately initialized/migrated for the production D1 database.

## Telegram webhook rule
A Telegram bot token has one active webhook destination at a time.

Do not point the live Telegram bot webhook at the production Worker until:
- production Worker health is green
- production D1 migrations are complete
- required production Worker secrets exist
- required FAQ/AI/admin/manual data has been initialized

Moving the webhook is the go-live boundary.

## First promotion sequence
1. finish repository-side production foundation on `test`
2. validate TEST build/typecheck
3. fast-forward or PR-merge `test` into `main`
4. verify `main` equals the approved `test` checkpoint
5. create the separate production D1 database in Cloudflare
6. save its UUID as `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`
7. configure production Worker secrets
8. initialize required production D1 operational data
9. manually run `Deploy PRODUCTION to Cloudflare` from `main` with confirmation `DEPLOY_PRODUCTION`
10. verify production `/health`
11. move Telegram webhook to production Worker
12. smoke-test `/start`, FAQ, grounded AI, Owner commands, manuals, Staff Inbox, Take Over/Return to AI

## Rollback boundary
Because `main` merge and production deploy are separate actions, a repository promotion does not by itself change the live Telegram bot.

If a production deploy is unhealthy, do not move the Telegram webhook. If the webhook has already moved, restore it to the last known-good Worker while the production revision is repaired.
