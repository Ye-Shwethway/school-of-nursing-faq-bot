# Production Operations Runbook

Last updated: 2026-08-18

> Historical filename retained for continuity. The old TEST-to-PRODUCTION promotion model is retired.

## Current branch contract

- `main` is the single active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- no TEST workflow or TEST deployment remains active.
- relevant pushes to `main` automatically run the production workflow.

There is no normal TEST → main promotion step anymore.

## Production workflow

Canonical file:

`.github/workflows/deploy-production.yml`

Relevant `main` pushes validate and deploy production automatically. The workflow also supports manual dispatch when needed, but manual dispatch is not the normal promotion boundary.

Current pipeline:

1. verify branch and required GitHub deployment secrets
2. preflight required Cloudflare Worker runtime bindings
3. install dependencies
4. strict TypeScript typecheck
5. generate isolated production Wrangler config
6. validate D1 migrations locally
7. validate Worker bundle with dry run
8. apply remote production D1 migrations
9. deploy production Worker
10. verify required runtime bindings remain present
11. verify production `/health`
12. arm one-time Owner command resync nonce
13. resync Telegram Owner command registry
14. exact Telegram command read-back
15. remove generated config and write deployment summary

## Production resources

Production Worker:

`school-of-nursing-faq-bot`

Production D1 database:

`school-of-nursing-faq-bot-prod-db`

The production D1 UUID is not committed to this public repository. GitHub Actions uses `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`.

## GitHub production secrets

Required deployment-side secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PRODUCTION_D1_DATABASE_ID`

Runtime Telegram/AI secrets belong on the Cloudflare Worker, not in repository files.

## Cloudflare runtime bindings

Required production runtime bindings include:

- `DB` — D1 binding
- `TELEGRAM_BOT_TOKEN` — `secret_text`
- `TELEGRAM_WEBHOOK_SECRET` — `secret_text`
- `BOT_OWNER_TELEGRAM_ID` — `secret_text`
- `AI_CONFIG_MASTER_KEY` — `secret_text`

`AI_CONFIG_MASTER_KEY` must be Base64 representing exactly 32 random bytes.

## Telegram go-live state

The production Telegram webhook cutover is already complete. `/start`, FAQ, grounded AI, Owner identity, Staff Inbox, manuals, and current command menus operate through production.

A deploy must therefore preserve the live webhook contract; it is no longer a pre-production cutover exercise.

## Current production validation

A successful deployment is not considered complete until the workflow confirms:

- typecheck PASS
- local migration validation PASS
- production bundle validation PASS
- remote migrations PASS
- Worker deploy PASS
- production health PASS
- required runtime bindings preserved
- exact Owner Telegram command registry PASS

Current expected Owner command count: **17**.

## Runtime smoke-test guidance

After meaningful behavior changes, perform a narrow live smoke test relevant to the changed slice rather than recreating a retired TEST environment.

Typical checks include:

- `/start` and `/language`
- deterministic FAQ fast path
- grounded AI reply
- human handoff
- `/noti on|off`
- `/available` / `/unavailable`
- staff topic reply relay
- Owner/Admin manuals
- Staff Inbox switching/Sudo invite flow when changed

## Rollback principle

If a new production revision is unhealthy, restore/fix from `main` using repository and deployment evidence. Do not revive the retired TEST branch as an alternate active environment.

Preserve secrets and production data; do not delete or rotate credentials merely to recover from an application revision unless the credential itself is the confirmed problem.
