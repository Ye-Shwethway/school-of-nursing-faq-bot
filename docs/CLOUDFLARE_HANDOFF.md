# Cloudflare Production Handoff

Last updated: 2026-08-18

## Current production state

Repository: `Ye-Shwethway/school-of-nursing-faq-bot`

Active branch: `main`

Historical `test` branch: dormant/reference-only; no active TEST workflow or deployment role.

Production Cloudflare resources:

- Worker: `school-of-nursing-faq-bot`
- D1: `school-of-nursing-faq-bot-prod-db`
- D1 binding: `DB`

The production D1 UUID is intentionally not committed to the public repository.

## Deployment ownership

Canonical production workflow:

`.github/workflows/deploy-production.yml`

Relevant pushes to `main` automatically validate and deploy production.

The workflow handles typecheck, local migration validation, production dry run, remote migrations, Worker deploy, binding verification, `/health`, and exact Telegram Owner-command read-back.

## Runtime secrets

Cloudflare Worker runtime bindings must preserve:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `BOT_OWNER_TELEGRAM_ID`
- `AI_CONFIG_MASTER_KEY`
- `DB`

Do not print, rotate, remove, or commit secret values unless explicitly required by a confirmed recovery task.

Provider credentials are encrypted in D1 under `AI_CONFIG_MASTER_KEY`; rotating the master key makes credentials encrypted with the old key unreadable until re-entered.

## Current Worker entrypoint

Wrangler entrypoint:

`src/staff_presence_entry.ts`

Current outer-to-inner stack:

1. staff availability / notification commands / returning-staff prompt / topic reply relay
2. best-effort Staff Inbox cleanup
3. manuals + command sync
4. production deploy notice / ops endpoints
5. latest Return-to-AI control
6. monitoring / FAQ / AI / human handoff
7. Staff Inbox UX + Sudo invite lifecycle
8. Telegram UX polish
9. secure AI setup interception
10. dynamic FAQ/AI runtime
11. compatibility fallback + `/health`

## Current migrations

Repository migrations run in order from `0001` through `0015`.

Latest checkpoints:

- `0011_group_message_cleanup.sql`
- `0012_staff_presence_notifications.sql`
- `0013_manual_staff_operations.sql`
- `0014_manual_returning_staff_prompt.sql`
- `0015_owner_manual_main_only_cleanup.sql`

Do not rewrite historical migrations after they have been deployed. Add a new migration for future persistent-data changes.

## Telegram production state

The Telegram webhook already points to production. Production Owner command registry is verified by the deployment workflow.

Current expected Owner command count: **17**.

Public commands include `/start`, `/language`, `/whoami`.

## Staff operations state

The active Staff Inbox supports:

- per-user forum topics
- Take Over / Return to AI
- `/noti on|off`
- `/available` / `/unavailable`
- unavailable-user handoff messaging
- returning-unavailable staff pending-case reminder
- topic reply relay back to the original user
- Staff Inbox switching
- Sudo invite provisioning
- Owner-only best-effort `/clearmessage`

## Validation checklist after relevant production changes

Use focused live checks for the changed slice. Examples:

1. `/health` returns production healthy
2. exact Owner command read-back is green
3. deterministic FAQ remains fast
4. grounded AI remains reply-linked and safe
5. unresolved questions reach isolated Staff Inbox topics
6. all-unavailable state produces the unavailable user copy
7. staff topic reply reaches the original user privately
8. `/noti off` preserves group messages while suppressing push notifications
9. Owner/Admin manuals reflect current operations
10. no runtime binding or secret regression

Read `NEW_CHAT_BOOTSTRAP.md` and `ROADMAP.md` for the latest canonical project checkpoint before changing infrastructure.
