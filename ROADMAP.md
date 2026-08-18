# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, human staff continuity always available, grounded configurable AI only as a supplementary helper.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **FAQ-FIRST + HUMAN-STAFF-CONTINUITY PRIMARY; TOKEN/WEBHOOK ROTATION LIVE; AI CREDENTIAL SAVE LIVE; OWNER TAKEOVER OVERRIDE LIVE; 1-HOUR HUMAN-CONTROL LEASE + AUTO-RETURN IMPLEMENTED; DEPLOYMENT ONLINE CHANGE SUMMARY LIVE; AI OUTAGE ALERTS STATE-TRANSITION-ONLY; STAFF AVAILABILITY TIMER + DAILY SCHEDULE IMPLEMENTED ON MAIN; PRODUCTION/LIVE STAFF-SCHEDULE ACCEPTANCE REQUIRED**.

Live-confirmed:
- rotated Telegram bot token works inbound/outbound
- automatic production webhook cutover works
- `/language`, `/faq`, normal commands and false-escalation filtering work
- rotated `AI_CONFIG_MASTER_KEY` works after re-saving Gemini credentials
- grounded Gemini AI is usable when available
- Bot Owner can override another Admin's stale `Take Over` and return the user to AI
- reboot notice shows current revision plus deploy change summary
- latest production workflow before this slice was reported green

## Product priority
1. deterministic FAQ is the primary automated answer source
2. Human Staff response is the primary fallback and continuity path
3. AI is supplementary assistance only and may be unavailable because free-tier/provider limits are expected
4. AI outage must never sever user↔staff communication

## Staff availability timer + daily schedule
Existing `/available` and `/unavailable` commands remain authorized-staff commands inside the active Staff Inbox, with optional timing arguments added.

### Command semantics
- `/available` → immediate available and clear any recurring schedule
- `/unavailable` → unavailable indefinitely until explicitly changed
- `/unavailable 3` → temporary unavailable for 3 hours
- temporary duration accepts positive fractional hours up to 168 hours
- `/available 09:00 17:00` → recurring daily availability window
- `/available 9am 5pm` → 12-hour alias for the same schedule
- `/available 9:30am 5:30pm` is also accepted
- overnight windows such as `/available 20:00 08:00` are valid
- schedule start and end must differ

All schedule interpretation is fixed to **Asia/Yangon (UTC+06:30)**.

### Effective-state rules
1. a temporary unavailable timer overrides a recurring schedule while active
2. when the timer expires and no recurring schedule exists, staff returns to available
3. when the timer expires and a recurring schedule exists, the recurring schedule resumes
4. schedule state is recurring daily, not a one-day appointment
5. effective available-staff counts evaluate timer/schedule state directly rather than trusting only the legacy `available` boolean
6. the existing 5-minute Cloudflare Cron materializes expiry/schedule transitions, so persisted-state transition latency is 0–5 minutes
7. a staff reply may clear a temporary unavailable override because active response proves the staff member has returned, but it must not erase a recurring schedule
8. scheduled off-hours do not trigger the old “become available now?” private return prompt

Migration `0031_staff_availability_schedule.sql` adds to `staff_presence`:
- `unavailable_until`
- `schedule_start_minute`
- `schedule_end_minute`
- `schedule_enabled`
- expiry index
- Owner/Admin manual guidance

`src/staff_presence.ts` owns effective-state calculation, timed unavailable, recurring schedule, active-reply handling, available counts and Cron sweep.

`src/staff_presence_entry.ts` owns command parsing including 24-hour and am/pm aliases.

Top-level `interaction_guard_entry.ts` reuses the existing 5-minute scheduled event and runs staff-availability sweep alongside human-control lease expiry.

## AI outage / human fallback visibility
AI infrastructure/configuration failure must never collapse the bot into FAQ-only mode. FAQ continues independently; meaningful FAQ misses still go to human handoff.

### Transition-only alert policy
- healthy → outage: one `🚨 AI service unavailable` notice
- while outage remains active: no additional notices regardless of duration or underlying reason changes
- outage → recovered: one `🟢 AI service recovered` notice
- after recovery, a later new outage may send one new outage notice

Outage notices show whether human fallback is `ACTIVE` or `QUEUED ONLY`. End users never receive provider/API-key/master-key error details.

## Human-control lease / auto-return
A successful `Take Over` starts a persisted 1-hour inactivity lease. Only the claimant may renew it by valid staff reply or `Extend 1h`; unrelated admin activity does not renew it. The existing 5-minute Cron auto-returns expired claims to AI, while Owner may override immediately at any time. History remains intact.

## Production deployment support
The production workflow builds an isolated Wrangler config and copies `source.triggers` so the canonical Cron schedule survives deploy. Remote D1 migrations run before Worker deploy.

The workflow injects:
- `DEPLOY_REVISION = GITHUB_SHA`
- `DEPLOY_CHANGE = normalized triggering commit subject`

`🟢 Bot is Online!` displays both revision and change summary when available.

## Handoff acknowledgement reliability
During a true AI→human escalation, user acknowledgement remains reply-first with plain-private-message fallback. Staff Inbox success never substitutes for the user-facing acknowledgement.

## Canonical Worker stack
Wrangler entrypoint remains `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts` — webhook flood guard + scheduled human-control/staff-availability sweeps
2. `rate_limit_entry.ts`
3. `ai_setup_entry.ts`
4. `faq_ai_entry.ts`
5. `input_quality_entry.ts`
6. `cases_entry.ts`
7. Staff/manual/deploy/latest-return/monitoring/UX/security/runtime layers

## Existing product contracts
- FAQ-first `/start`/`/language`
- public localized `/faq`
- Owner/Sudo FAQ management + multilingual AI-assisted drafting
- `/cases` escalation archive
- Staff Inbox Take Over / Resolve / Return-to-AI
- Owner override of stale Admin takeover
- 1-hour inactivity lease + claimant renewal + auto-return
- staff availability timer + recurring daily schedule
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
Command schema revision remains **9**. Sudo total: **12**. Owner total: **19**. No new command names were added; only optional arguments were added to existing staff commands.

## Migrations
Current migrations: `0001` through `0031`.

Newest migrations:
- `0028_human_control_lease.sql` — persisted 1-hour takeover lease
- `0029_manual_ai_outage_fallback.sql` — AI outage/human-fallback guidance
- `0030_manual_ai_outage_transition_only.sql` — transition-only outage notices
- `0031_staff_availability_schedule.sql` — timed unavailable + recurring daily staff schedule

## Validation boundary
Do not call the newest staff-availability slice production/live accepted until:
1. typecheck, migration 0031, dry-run bundle, remote migration, deploy and health pass
2. `/unavailable` still sets indefinite unavailable
3. `/available` still sets immediate available and clears schedule
4. `/unavailable 3` sets temporary unavailable and reports the Asia/Yangon auto-return time
5. expiry returns an unscheduled staff member to available within the Cron boundary
6. `/available 09:00 17:00` creates a recurring daily schedule
7. `/available 9am 5pm` parses identically
8. overnight schedule syntax works
9. effective `countAvailableStaff()` respects schedule/timer immediately
10. temporary unavailable overrides a recurring schedule and the schedule resumes after expiry
11. scheduled off-hours do not trigger the legacy private “become available” prompt
12. normal staff topic replies still reach users and do not destroy recurring schedules
13. existing takeover lease, Owner override, AI fallback, limits/flood guard and FAQ remain operational
