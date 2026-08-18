# ROADMAP

Last updated: 2026-08-19

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, human staff continuity always available, grounded configurable AI only as a supplementary helper.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **FAQ-FIRST + HUMAN-STAFF-CONTINUITY PRIMARY; TOKEN/WEBHOOK ROTATION LIVE; AI CREDENTIAL SAVE LIVE; OWNER TAKEOVER OVERRIDE LIVE; 1-HOUR HUMAN-CONTROL LEASE + AUTO-RETURN IMPLEMENTED; DEPLOYMENT ONLINE CHANGE SUMMARY LIVE; AI OUTAGE ALERTS STATE-TRANSITION-ONLY; STAFF AVAILABILITY TIMER + DAILY SCHEDULE IMPLEMENTED; PRIVATE STAFF AVAILABILITY COMMANDS + GROUP MIRROR IMPLEMENTED ON MAIN; PRODUCTION/LIVE PRIVATE-COMMAND ACCEPTANCE REQUIRED**.

Live-confirmed before this newest slice:
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
Authorized staff availability is persisted in `staff_presence` and evaluated in **Asia/Yangon (UTC+06:30)**.

### Command semantics
- `/available` → immediate available and clear recurring schedule
- `/unavailable` → unavailable indefinitely until explicitly changed
- `/unavailable 3` → temporary unavailable for 3 hours
- positive fractional hours up to 168 are accepted
- `/available 09:00 17:00` → recurring daily 09:00–17:00 availability
- `/available 9am 5pm` → alias for the same schedule
- `/available 9:30am 5:30pm` → minute-resolution alias
- `/available 20:00 08:00` → valid overnight schedule
- start and end must differ

### Where availability commands may be used
`/available` and `/unavailable` are allowed in:
1. the active Staff Inbox group, or
2. an authorized staff member's private bot chat **only when an active Staff Inbox group is configured**.

Private invocation is convenience only; Staff Inbox remains the team-visible coordination surface.

Rules:
- if no Staff Inbox group is configured, private availability commands are rejected **before state mutation**
- a private successful availability/timer/schedule change is automatically published to the active Staff Inbox group root
- the group update identifies the staff member by username/name when available plus immutable Telegram ID and shows the resulting state/count/timer/schedule summary
- direct use in the Staff Inbox remains supported; the normal command/result there is already team-visible
- `/noti` remains Staff-Inbox-only

### Effective-state rules
1. active temporary-unavailable timer overrides everything
2. after timer expiry, a recurring schedule resumes if configured
3. after timer expiry with no schedule, staff returns to available
4. recurring schedule is daily Yangon-time state, including overnight windows
5. effective available-staff counts evaluate timer/schedule state directly, not only the stored legacy boolean
6. existing 5-minute Cloudflare Cron materializes expiry/schedule transitions; persisted transition latency is 0–5 minutes
7. staff reply may clear a temporary unavailable override because active response proves return, but recurring schedule is preserved
8. scheduled off-hours do not trigger the old private “become available now?” prompt

Migration `0031_staff_availability_schedule.sql` added timer/schedule state. Migration `0032_private_staff_availability_commands.sql` expands Owner/Admin manuals for private invocation, Staff Inbox prerequisite and group mirroring.

`src/staff_presence.ts` owns effective-state calculation, timers, recurring schedule, active-reply behavior, available counts and Cron sweep.

`src/staff_presence_entry.ts` owns command parsing, private/group authorization, active Staff Inbox prerequisite and private→group operational mirroring.

`src/command_menu.ts` command schema revision is **10**; command names/order/count are unchanged, while `/available` and `/unavailable` descriptions now advertise scheduling/timed behavior.

## AI outage / human fallback visibility
AI infrastructure/configuration failure must never collapse the bot into FAQ-only mode. FAQ continues independently; meaningful FAQ misses still go to human handoff.

Alert policy is state-transition-only:
- healthy → outage: one `🚨 AI service unavailable`
- while outage remains active: no repeat notices
- outage → recovered: one `🟢 AI service recovered`
- after recovery, a later new outage may alert again

Outage notices show whether human fallback is `ACTIVE` or `QUEUED ONLY`. End users never receive provider/API-key/master-key error details.

## Human-control lease / auto-return
A successful `Take Over` starts a persisted 1-hour inactivity lease. Only the claimant may renew it by valid staff reply or `Extend 1h`; unrelated admin activity does not renew it. Existing 5-minute Cron auto-returns expired claims to AI, while Owner may override immediately at any time. History remains intact.

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
- private `/available`/`/unavailable` with Staff Inbox prerequisite + group visibility
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
Command schema revision: **10**. Sudo total: **12**. Owner total: **19**. Command names/order/count remain unchanged.

## Migrations
Current migrations: `0001` through `0032`.

Newest migrations:
- `0028_human_control_lease.sql` — persisted 1-hour takeover lease
- `0029_manual_ai_outage_fallback.sql` — AI outage/human-fallback guidance
- `0030_manual_ai_outage_transition_only.sql` — transition-only outage notices
- `0031_staff_availability_schedule.sql` — timed unavailable + recurring daily staff schedule
- `0032_private_staff_availability_commands.sql` — private availability command/manual expansion + team-visibility contract

## Validation boundary
Do not call the newest private availability slice production/live accepted until:
1. typecheck, migration 0032, dry-run bundle, remote migration, deploy and health pass
2. exact Owner command registry remains 19/19 and updated descriptions sync under schema revision 10
3. authorized staff can use plain `/available` privately when Staff Inbox exists
4. private `/unavailable 3` mutates staff state and returns a private confirmation
5. private `/available 09:00 17:00` and `/available 9am 5pm` save schedules correctly
6. every successful private availability/timer/schedule change creates one Staff Inbox root operational update with staff identity and resulting state
7. no Staff Inbox configured → private `/available` and `/unavailable` reject before state mutation
8. active Staff Inbox group invocation remains backward-compatible
9. `/noti` remains Staff-Inbox-only
10. unauthorized private users cannot manage staff state
11. timer/schedule effective counts and Cron transitions remain correct
12. existing human-control lease, Owner override, AI fallback, limits/flood guard and FAQ remain operational
