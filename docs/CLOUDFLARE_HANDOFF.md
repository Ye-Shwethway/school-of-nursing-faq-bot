# Cloudflare TEST Deployment Handoff

Last updated: 2026-08-18

## Current TEST resources
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Branch: `test`

Cloudflare:
- D1: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- binding: `DB`
- TEST Worker: `school-of-nursing-faq-bot-test`
- production Worker: `school-of-nursing-faq-bot`

Production remains untouched until `test` is promoted through the branch contract.

## Deployment ownership
Manual Worker artifact courier flow is no longer the normal path.

Canonical workflow:
`.github/workflows/deploy-test.yml`

It runs automatically for deploy-relevant pushes on `test` and can also be manually dispatched.

Pipeline:
1. checkout current `test`
2. Node 22 dependency install
3. verify `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`
4. strict TypeScript typecheck
5. apply all repository migrations locally
6. Wrangler TEST dry run
7. apply unapplied migrations to remote D1
8. deploy TEST Worker with `DEPLOY_REVISION=${GITHUB_SHA}`
9. verify `/health` reports TEST healthy

Telegram secrets remain Cloudflare Worker secrets; do not copy them into GitHub Actions.

## Current Worker entrypoint
Wrangler entrypoint:

`src/deployment_notice_entry.ts`

Current stack:
1. deployment online notice
2. latest Return-to-AI control
3. monitoring headers + isolated group handoff
4. Staff Inbox inline UX
5. Telegram UX polish / stale-AI guard
6. secure secret/setup guard
7. dynamic FAQ / grounded AI runtime
8. compatibility fallback

Read `NEW_CHAT_BOOTSTRAP.md` for the authoritative layer-by-layer handoff.

## Deployment visibility
Every deployment receives the Git commit SHA as `DEPLOY_REVISION`.

The workflow's successful health request causes `deployment_notice_entry.ts` to send `🟢 Bot is Online!` once for that revision to:
- Bot Owner
- active Sudo Admins

A D1 marker prevents duplicate notices from repeated health requests for the same revision.

## Current required migrations
Remote D1 should advance through all repository migrations in order, currently:
- 0001 initial
- 0002 AI settings
- 0003 handoff/persona
- 0004 shadow monitoring
- 0005 dynamic FAQ
- 0006 conversation control version
- 0007 latest Return-to-AI message pointer
- 0008 monitoring topic provision lock

Do not manually rewrite historical migrations. Let Wrangler apply only unapplied files.

## Multiuser topic safety
Migration 0008 plus `src/monitoring_target.ts` protects same-user concurrent first-topic creation.

The Staff Inbox contract is fail-closed:
- different users have different Telegram forum topics
- same-user concurrent first messages share one canonical topic mapping
- group handoff is posted into that user's topic
- topic provisioning failure must not fall back to the main Staff Inbox chat

## Preserve runtime configuration
Do not rotate/remove/print unless explicitly requested:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `BOT_OWNER_TELEGRAM_ID`
- `AI_CONFIG_MASTER_KEY`
- encrypted provider credentials in D1
- Primary/Fallback bindings
- Staff Inbox / route / monitoring settings

## Current TEST validation checklist
After a deploy:
1. `/health` is HTTP 200 with `environment=test`
2. Owner/Sudo Admin online notice arrives once for the revision
3. deterministic FAQ remains fast
4. grounded AI shows typing and replies to the originating question
5. staff mirror USER header carries name/username/ID
6. AI mirror header carries actual provider/model
7. multiple users stay in separate forum topics
8. same-user near-simultaneous first messages do not create duplicate topics
9. Take Over affects only the selected user
10. newest human-control USER message alone carries Return to AI
11. group handoff card stays inside that user's topic
12. no runtime secret/config regression

Do not promote `main` until the TEST checklist is green.
