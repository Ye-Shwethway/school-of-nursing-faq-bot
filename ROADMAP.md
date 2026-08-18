# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, human handoff when automation cannot answer safely.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **FAQ-FIRST + FALSE-ESCALATION GUARD LIVE; TOKEN/WEBHOOK ROTATION LIVE; AI CREDENTIAL SAVE LIVE; OWNER TAKEOVER OVERRIDE LIVE-ACCEPTED; 1-HOUR HUMAN-CONTROL LEASE + AUTO-RETURN IMPLEMENTED; DEPLOYMENT ONLINE CHANGE SUMMARY LIVE-ACCEPTED; AI OUTAGE ALERT + HUMAN FALLBACK VISIBILITY IMPLEMENTED ON MAIN; PRODUCTION/LIVE OUTAGE ACCEPTANCE REQUIRED**.

Live-confirmed:
- rotated Telegram bot token works inbound/outbound
- automatic production webhook cutover works
- `/language`, `/faq`, normal commands and false-escalation filtering work
- rotated `AI_CONFIG_MASTER_KEY` works after re-saving Gemini credentials
- grounded Gemini AI is usable
- Bot Owner can override another Admin's stale `Take Over` and return the user to AI
- reboot notice shows current revision plus deploy change summary

## AI outage / human fallback visibility
AI infrastructure/configuration failure must never collapse the bot into FAQ-only mode.

Runtime behavior:
1. deterministic FAQ remains the first path and continues working independently of AI provider health
2. AI availability/configuration/provider/runtime failures return a human-handoff decision rather than surfacing provider errors to the user
3. the unresolved meaningful question is still logged and handed off through the normal Staff Inbox path
4. `src/ai_outage_alert.ts` sends an operational `🚨 AI service unavailable` notice to Bot Owner private chat and the configured Staff Inbox
5. the alert shows the safe internal reason and whether human fallback is `ACTIVE` or `QUEUED ONLY`
6. `ACTIVE` means a staff destination is configured and unresolved questions continue routing to staff
7. `QUEUED ONLY` means questions/cases are persisted but there is no active staff destination configured
8. repeated alerts for the same reason are throttled to once per 30 minutes using `bot_settings`
9. a changed outage reason may alert immediately
10. once a valid AI decision is obtained again, the outage marker is cleared and one `🟢 AI service recovered` notice is sent
11. a valid AI policy handoff caused by insufficient approved knowledge is not an outage and must not trigger an outage alert

Infrastructure outage reasons currently include:
- `ai_unavailable:<reason>`
- `primary_and_fallback_failed`
- `ai_runtime_failure`

The end user still receives the normal localized handoff/unavailable copy; provider/API details remain operational-only.

Migration `0029_manual_ai_outage_fallback.sql` documents these semantics in Owner/Admin manuals. No new schema table is required because alert state uses existing `bot_settings`.

## Human-control lease / auto-return
A successful `Take Over` starts a persisted **1-hour inactivity lease**.

Lease semantics:
1. `takeOverConversation()` sets `last_human_activity_at=CURRENT_TIMESTAMP` and `human_control_expires_at=now + 1 hour`.
2. only the current claimant may renew the lease.
3. an eligible claimant non-command staff reply in that user's Staff Inbox topic or claimed case reply renews expiry to `now + 1 hour`.
4. the active claimant may explicitly press `Extend 1h` to renew without sending a user-facing message.
5. unrelated admin activity, commands, other users' conversations, and other Admins do not renew the claim.
6. manual claimant `Return to AI`, Owner override, resolve/reset, and automatic expiry clear lease timestamps.

### Scheduled expiry
- canonical `wrangler.jsonc` contains `triggers.crons = ["*/5 * * * *"]`.
- top-level `interaction_guard_entry.ts` exposes a `scheduled()` handler.
- `src/human_control_lease.ts` lists expired human claims, atomically expires each claim only if claimant + expiry still match, then performs best-effort notifications/cleanup.
- practical expiry is approximately **1h00m–1h05m after last claimant activity**.
- no in-memory sleep/timer is used, so Worker restart/deploy does not erase takeover timing.

### Auto-return notifications
On successful expiry:
- user receives localized notice that the automated assistant is active again
- previous claimant receives a private expiry notification
- if claimant DM is unavailable, the Staff Inbox topic note acts as fallback notification
- Staff Inbox topic records the auto-return transition
- latest stale `Return to AI` button is removed
- case/question/user history remains intact

### Rollout safety
Migration `0028_human_control_lease.sql` adds:
- `conversation_control.last_human_activity_at`
- `conversation_control.human_control_expires_at`
- expiry index
- Owner/Admin manual sections

Any human-control claim already active when migration 0028 is applied receives a fresh full one-hour lease instead of being immediately expired.

## Production deployment support
The production workflow builds an isolated Wrangler config and copies `source.triggers` so the canonical Cron schedule survives deploy. Remote D1 migrations still run before Worker deploy.

### Deployment online change summary
The production workflow derives the deploy-triggering Git commit subject from `GITHUB_SHA`, normalizes it to one line, caps it at 180 characters, and injects it into the Worker as `DEPLOY_CHANGE` alongside `DEPLOY_REVISION`.

`src/deployment_notice_entry.ts` displays:
`Change: <commit subject>`

This lets Owner/Sudo see what changed directly in the `🟢 Bot is Online!` notice. Missing metadata never blocks health/online notification.

## Owner takeover override
Bot Owner remains higher authority than the current claimant and may force `Return to AI` immediately without waiting for lease expiry. Previous claimant notification and Staff Inbox transition visibility remain required.

## Handoff acknowledgement reliability
During a true AI→human escalation, user acknowledgement remains reply-first with plain-private-message fallback. Staff Inbox success never substitutes for the user-facing acknowledgement.

## AI credential-entry hardening
`src/ai_setup_entry.ts` intercepts active Owner-private `awaiting_ai_*` setup text before lower routing. Provider keys are encrypted by canonical `consumeAiSetupText()`, secret messages are deleted, and explicit success/error feedback is required.

## Canonical Worker stack
Wrangler entrypoint remains `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts` — webhook flood guard + scheduled human-control sweep entry
2. `rate_limit_entry.ts`
3. `ai_setup_entry.ts`
4. `faq_ai_entry.ts`
5. `input_quality_entry.ts`
6. `cases_entry.ts`
7. Staff/manual/deploy/latest-return/monitoring/UX/security/runtime layers

`ai_runtime.ts` owns AI availability/provider execution and now owns outage/recovery signaling through `ai_outage_alert.ts`.
`latest_return_entry.ts` owns latest `Return to AI` / `Extend 1h` controls, claimant-activity renewal, and explicit Owner override handling.

## Existing product contracts
- FAQ-first `/start`/`/language`
- public localized `/faq`
- Owner/Sudo FAQ management + multilingual AI-assisted drafting
- `/cases` escalation archive
- Staff Inbox Take Over / Resolve / Return-to-AI
- Owner override of stale Admin takeover
- 1-hour inactivity lease + claimant renewal + auto-return
- deployment online notice with revision + change summary
- AI outage alert + human fallback continuity + recovery notice
- `/limits`, progressive inquiry rate limit, Interaction Flood Guard, Owner-only ban/unban
- deterministic Input Quality Gate
- grounded AI `answer | clarify | handoff`
- reliable handoff acknowledgement fallback
- editable Owner/Admin manuals

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations
Current migrations: `0001` through `0029`.

Newest migrations:
- `0028_human_control_lease.sql` — persisted 1-hour takeover lease, rollout backfill, expiry index, Owner/Admin manual documentation
- `0029_manual_ai_outage_fallback.sql` — AI outage/human-fallback operational guidance for Owner/Admin manuals

## Validation boundary
Do not call the newest AI-outage slice production-green until production workflow + live acceptance confirms:
1. typecheck, migration 0029, dry-run bundle, remote migration, deploy and health pass
2. FAQ answers still work while AI provider is intentionally unavailable in a controlled test
3. a meaningful FAQ-miss under AI outage creates/logs the human handoff as before
4. Owner receives one `🚨 AI service unavailable` alert
5. active Staff Inbox receives the operational alert when configured
6. same outage reason does not spam more than once per 30 minutes
7. alert correctly distinguishes `Human fallback: ACTIVE` from `QUEUED ONLY`
8. end user never sees provider/API key details
9. intentional knowledge-gap AI handoff does not create an outage alert
10. after restoring a valid AI provider response, one `🟢 AI service recovered` notice is emitted and normal grounded AI answering resumes
11. existing takeover lease, Owner override, limits/flood guard, FAQ and manuals remain operational
