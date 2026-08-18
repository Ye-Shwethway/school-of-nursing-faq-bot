# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant canonical docs/source

Live repository plus verified Cloudflare/Telegram evidence outranks remembered chat context.

## Current checkpoint
The project is main-only and production-live. FAQ-first onboarding, false-escalation filtering, rotated Telegram token + automatic webhook cutover, rotated AI master-key credential save, Bot Owner takeover override, deployment reboot `Change:` metadata, and the latest pre-existing production workflow are live-accepted.

Newest implementation on `main` adds **timed staff unavailability and recurring daily staff availability schedules** using Asia/Yangon time. Do not call this newest slice production/live accepted until workflow + Telegram command acceptance is verified.

## Product priority contract
- Deterministic FAQ and Human Staff response are the primary service continuity paths.
- AI is a supplementary helper, not a dependency for user↔staff communication.
- Free-tier/provider outages are expected operational conditions and must not create alert spam or break human handoff.

## Staff availability timer + daily schedule
Existing staff commands retain backward compatibility and add optional timing arguments.

### Commands
- `/available` → immediate available; clears recurring schedule
- `/unavailable` → unavailable indefinitely
- `/unavailable 3` → unavailable for 3 hours
- positive fractional hours are accepted up to 168 hours
- `/available 09:00 17:00` → daily recurring 09:00–17:00 availability
- `/available 9am 5pm` → alias for the same schedule
- `/available 9:30am 5:30pm` → minute-resolution 12-hour alias
- `/available 20:00 08:00` → valid overnight schedule

Timezone is fixed to **Asia/Yangon / UTC+06:30**.

### State precedence
1. active temporary unavailable timer overrides everything
2. after timer expiry, a recurring schedule resumes if configured
3. without a recurring schedule, timer expiry returns the staff member to available
4. daily schedule determines availability by the configured Yangon-time window
5. plain `/available` or plain `/unavailable` intentionally clears the recurring schedule to preserve old manual-toggle semantics

### Runtime ownership
Migration `0031_staff_availability_schedule.sql` adds `unavailable_until`, `schedule_start_minute`, `schedule_end_minute`, `schedule_enabled` and an expiry index to `staff_presence`, plus manual guidance.

`src/staff_presence.ts` owns:
- effective availability calculation
- temporary-unavailable state
- recurring daily schedule state
- available-staff counting
- staff-active reply behavior
- scheduled sweep/materialization

`src/staff_presence_entry.ts` owns:
- `/available` / `/unavailable` parsing
- 24-hour and am/pm aliases
- command confirmations in Asia/Yangon time
- suppression of the legacy “become available now?” prompt during scheduled off-hours

`src/interaction_guard_entry.ts` reuses the existing Cloudflare `*/5 * * * *` Cron and runs both:
- human-control lease expiry sweep
- staff-availability timer/schedule sweep

Availability queries calculate effective state directly, so staff counts do not need to wait for the Cron. Persisted `available` state is reconciled by Cron within 0–5 minutes of a boundary.

A staff topic reply may clear a temporary unavailable override because it demonstrates active return, but must not delete a recurring daily schedule.

## AI outage / fallback contract
- AI infrastructure/configuration failure must not reduce the bot to FAQ-only mode.
- Deterministic FAQ continues to answer matches.
- Meaningful FAQ misses still go to normal human handoff when AI is unavailable.
- End users never receive provider/API-key/master-key error details.

Operational AI alerts are state-transition-only:
1. healthy → outage: one `🚨 AI service unavailable`
2. while outage remains active: no repeat notices
3. outage → recovered: one `🟢 AI service recovered`
4. a later new outage may alert again

## Human-control lease contract
- Every successful `Take Over` starts a 1-hour inactivity lease.
- Only the active claimant may renew with valid staff activity or `Extend 1h`.
- Other Admin activity does not renew another claimant's lease.
- Existing 5-minute Cron auto-returns expired claims to AI.
- Owner override remains immediately available and outranks claimant ownership.

## Deployment contract
Canonical `wrangler.jsonc` has `triggers.crons = ["*/5 * * * *"]`; the isolated production Wrangler config copies `source.triggers`.

Every production deploy validates typecheck, local migrations, dry-run bundle, remote migrations, deploy, bindings, `/health`, Telegram webhook cutover/read-back and exact Owner command registry 19/19.

The workflow injects:
- `DEPLOY_REVISION = GITHUB_SHA`
- `DEPLOY_CHANGE = normalized triggering commit subject`

`🟢 Bot is Online!` shows both `Revision:` and `Change:` when metadata is available.

## Handoff acknowledgement contract
For real AI→human escalation, user acknowledgement remains reply-first with plain-private-message fallback. Staff Inbox success does not substitute for user-facing acknowledgement.

## Canonical Worker stack
Wrangler entrypoint: `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts` — Interaction Flood Guard + scheduled human-control/staff-availability sweeps
2. `rate_limit_entry.ts`
3. `ai_setup_entry.ts`
4. `faq_ai_entry.ts`
5. `input_quality_entry.ts`
6. `cases_entry.ts`
7. lower Staff/manual/deploy/latest-return/monitoring/UX/security/runtime layers

Important ownership:
- `staff_presence.ts` — effective staff presence + timers/schedules
- `staff_presence_entry.ts` — staff availability command UX/parser
- `human_control_lease.ts` — human takeover expiry
- `ai_runtime.ts` — grounded AI execution + outage/recovery signaling
- `ai_outage_alert.ts` — transition-only operational AI outage/recovery notices
- `latest_return_entry.ts` — Return-to-AI controls, `Extend 1h`, claimant renewal, Owner override
- `deployment_notice_entry.ts` — production online notice with revision/change metadata

## Existing product surfaces
- multilingual deterministic/dynamic FAQ
- public role-aware `/faq`
- FAQ-first `/start`/`/language`
- Owner/Sudo FAQ management + multilingual AI-assisted drafting
- `/cases` escalation archive
- Staff Inbox human takeover/resolve/return-to-AI
- Owner override of stale Admin takeover
- 1-hour human-control lease + auto-return
- timed staff unavailable + recurring daily staff availability schedules
- transition-only AI outage/recovery alert + human fallback continuity
- reboot notice with revision + deployed change summary
- `/limits`, progressive inquiry limits, Interaction Flood Guard
- Owner-only permanent ban/unban
- Input Quality Gate + AI clarify-vs-handoff
- editable manuals

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision remains **9**. Sudo total: **12**. Owner total: **19**. This slice adds arguments, not command names.

## Migrations / manuals
Current migration range: `0001` through `0031`.
Newest migration: `0031_staff_availability_schedule.sql`.

## Next exact validation
After the triggered production workflow is green:
1. verify migration 0031/deploy/health/webhook/commands pass
2. `/unavailable` remains indefinite manual unavailable
3. `/available` remains immediate manual available and clears schedule
4. `/unavailable 3` reports a correct Asia/Yangon expiry time and makes staff unavailable immediately
5. controlled expiry returns unscheduled staff to available within the Cron boundary
6. `/available 09:00 17:00` saves a recurring schedule
7. `/available 9am 5pm` produces the same schedule
8. an overnight schedule is accepted
9. available-staff count reflects schedule/timer immediately
10. temporary unavailable overrides a recurring schedule and the schedule resumes after expiry
11. scheduled off-hours do not show the legacy availability-return prompt
12. staff topic replies still deliver and preserve recurring schedule
13. existing human-control lease, Owner override, AI fallback, limits/flood guard, FAQ and manuals remain operational

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with live repository reality.
