# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, human staff continuity always available, grounded configurable AI only as a supplementary helper.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **FAQ-FIRST + HUMAN-STAFF-CONTINUITY PRIMARY; TOKEN/WEBHOOK ROTATION LIVE; AI CREDENTIAL SAVE LIVE; OWNER TAKEOVER OVERRIDE LIVE-ACCEPTED; 1-HOUR HUMAN-CONTROL LEASE + AUTO-RETURN IMPLEMENTED; DEPLOYMENT ONLINE CHANGE SUMMARY LIVE-ACCEPTED; AI OUTAGE ALERTS CHANGED TO STATE-TRANSITION-ONLY ON MAIN; PRODUCTION/LIVE OUTAGE ACCEPTANCE REQUIRED**.

Live-confirmed:
- rotated Telegram bot token works inbound/outbound
- automatic production webhook cutover works
- `/language`, `/faq`, normal commands and false-escalation filtering work
- rotated `AI_CONFIG_MASTER_KEY` works after re-saving Gemini credentials
- grounded Gemini AI is usable when available
- Bot Owner can override another Admin's stale `Take Over` and return the user to AI
- reboot notice shows current revision plus deploy change summary

## Product priority
The operational priority is now explicit:
1. deterministic FAQ is the primary automated answer source
2. Human Staff response is the primary fallback and continuity path
3. AI is supplementary assistance only and may be unavailable because free-tier/provider limits are expected
4. AI outage must never sever user↔staff communication

## AI outage / human fallback visibility
AI infrastructure/configuration failure must never collapse the bot into FAQ-only mode.

Runtime behavior:
1. deterministic FAQ continues working independently of AI provider health
2. AI availability/configuration/provider/runtime failures return a human-handoff decision rather than surfacing provider errors to the user
3. unresolved meaningful questions remain logged and handed off through the normal Staff Inbox path
4. `src/ai_outage_alert.ts` sends an operational `🚨 AI service unavailable` notice to Bot Owner private chat and configured Staff Inbox
5. the alert shows a safe internal reason and whether human fallback is `ACTIVE` or `QUEUED ONLY`
6. `ACTIVE` means a staff destination is configured and unresolved questions continue routing to staff
7. `QUEUED ONLY` means questions/cases are persisted but there is no active staff destination configured

### Transition-only alert policy
AI outage notifications are state transitions, not periodic reminders:
- healthy → outage: send one outage notice and persist the outage marker
- while outage remains active: send no additional outage notices, regardless of duration or changes in the underlying reason
- outage → recovered: clear the marker and send one recovery notice
- after recovery, a later new outage may send one new outage notice

There is no 30-minute repeat alert anymore. A valid AI policy handoff caused by insufficient approved knowledge is not an outage and must not trigger an outage alert. End users never receive provider/API-key/master-key error details.

Migration `0030_manual_ai_outage_transition_only.sql` updates Owner/Admin manuals to match this policy. Outage state uses existing `bot_settings`; no new table is required.

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
- `src/human_control_lease.ts` atomically expires stale human claims.
- practical expiry is approximately **1h00m–1h05m after last claimant activity**.
- Worker restart/deploy does not erase takeover timing.

On successful expiry the user is returned to AI mode, user/claimant/staff are notified, stale control buttons are removed, and case/question/user history remains intact.

## Production deployment support
The production workflow builds an isolated Wrangler config and copies `source.triggers` so the canonical Cron schedule survives deploy. Remote D1 migrations run before Worker deploy.

The workflow also injects:
- `DEPLOY_REVISION = GITHUB_SHA`
- `DEPLOY_CHANGE = normalized triggering commit subject`

`🟢 Bot is Online!` displays both revision and change summary when available.

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

`ai_runtime.ts` owns AI availability/provider execution and outage/recovery signaling through `ai_outage_alert.ts`.
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
- transition-only AI outage/recovery notices + human fallback continuity
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
Current migrations: `0001` through `0030`.

Newest migrations:
- `0028_human_control_lease.sql` — persisted 1-hour takeover lease, rollout backfill, expiry index, Owner/Admin manual documentation
- `0029_manual_ai_outage_fallback.sql` — initial AI outage/human-fallback guidance
- `0030_manual_ai_outage_transition_only.sql` — replaces periodic outage reminders with healthy→outage / outage→recovered transition-only notices and documents FAQ/Human Staff as primary continuity

## Validation boundary
Do not call the newest AI-outage policy production-green until production workflow + live acceptance confirms:
1. typecheck, migration 0030, dry-run bundle, remote migration, deploy and health pass
2. FAQ answers still work while AI provider is unavailable
3. a meaningful FAQ miss under AI outage creates/logs the human handoff as before
4. Owner receives exactly one `🚨 AI service unavailable` alert for the outage episode
5. active Staff Inbox receives the same operational alert when configured
6. repeated AI failures during the same outage produce no additional outage alert, even after a long interval or when the internal reason changes
7. alert correctly distinguishes `Human fallback: ACTIVE` from `QUEUED ONLY`
8. end user never sees provider/API key details
9. intentional knowledge-gap AI handoff does not create an outage alert
10. after restoring a valid AI provider response, exactly one `🟢 AI service recovered` notice is emitted
11. a later new outage is allowed to emit one new outage alert
12. existing takeover lease, Owner override, limits/flood guard, FAQ and manuals remain operational
