# NEW CHAT BOOTSTRAP

Last updated: 2026-08-19
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
The project is main-only and production-live. FAQ-first onboarding, false-escalation filtering, rotated Telegram token + automatic webhook cutover, rotated AI master-key credential save, Bot Owner takeover override, deployment reboot `Change:` metadata, and the latest production workflow before this slice are live-accepted.

Newest implementation on `main` extends the timed/daily **staff availability system so authorized staff can use `/available` and `/unavailable` from private bot chat while Staff Inbox remains the team-visible source of coordination**. Do not call this newest slice production/live accepted until workflow + Telegram acceptance is verified.

## Product priority contract
- Deterministic FAQ and Human Staff response are the primary service continuity paths.
- AI is a supplementary helper, not a dependency for user↔staff communication.
- Free-tier/provider outages are expected operational conditions and must not create alert spam or break human handoff.

## Staff availability timer + daily schedule
Timezone is fixed to **Asia/Yangon / UTC+06:30**.

### Commands
- `/available` → immediate available; clears recurring schedule
- `/unavailable` → unavailable indefinitely
- `/unavailable 3` → unavailable for 3 hours
- positive fractional hours are accepted up to 168 hours
- `/available 09:00 17:00` → daily recurring 09:00–17:00 availability
- `/available 9am 5pm` → alias
- `/available 9:30am 5:30pm` → minute-resolution alias
- `/available 20:00 08:00` → overnight schedule

### Private + Staff Inbox location contract
`/available` and `/unavailable` may be used by authorized staff in either:
1. the configured active Staff Inbox group, or
2. private bot chat, **provided an active Staff Inbox group is already configured**.

Private use is convenience only. Team visibility stays in Staff Inbox.

Private-command rules:
- resolve the active Staff Inbox before mutating availability
- if no Staff Inbox is configured, reject the command and leave state unchanged
- after every successful private availability/timer/schedule mutation, publish one operational update to the Staff Inbox group root
- group update identifies the actor with username/name when available plus immutable Telegram ID and includes the resulting state/count/timer/schedule confirmation
- group invocation remains supported and needs no duplicate mirror because the result is already visible there
- `/noti` remains Staff-Inbox-only

### State precedence
1. active temporary unavailable timer overrides everything
2. after timer expiry, recurring schedule resumes if configured
3. without a recurring schedule, timer expiry returns staff to available
4. daily schedule determines availability by the configured Yangon-time window
5. plain `/available` or `/unavailable` clears recurring schedule to preserve manual-toggle semantics

### Runtime ownership
Migration `0031_staff_availability_schedule.sql` adds `unavailable_until`, `schedule_start_minute`, `schedule_end_minute`, `schedule_enabled` and expiry index to `staff_presence`.

Migration `0032_private_staff_availability_commands.sql` expands Owner/Admin command/manual sections for:
- private availability invocation
- active Staff Inbox prerequisite
- private→group operational mirroring
- expanded command syntax/examples

`src/staff_presence.ts` owns effective availability, temporary unavailable, recurring schedule, available count and scheduled materialization.

`src/staff_presence_entry.ts` owns:
- `/available` / `/unavailable` parser
- 24-hour and am/pm aliases
- private/group command authorization
- Staff Inbox prerequisite
- private→Staff-Inbox operational update
- suppression of legacy availability-return prompt during scheduled off-hours

`src/interaction_guard_entry.ts` reuses the existing `*/5 * * * *` Cloudflare Cron for both human-control lease expiry and staff-availability sweep.

Availability queries calculate effective state directly, so staff counts do not wait for Cron. Persisted `available` is reconciled within 0–5 minutes of a boundary.

## Command registry
Command names/order/count remain unchanged. `src/command_menu.ts` revision is now **10** so updated `/available` and `/unavailable` descriptions sync to privileged Telegram command menus.

Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo total 12; Owner total 19.

## AI outage / fallback contract
AI infrastructure/configuration failure must not reduce the bot to FAQ-only mode. Deterministic FAQ continues to answer matches and meaningful FAQ misses still use normal human handoff.

Operational alerts remain state-transition-only:
1. healthy → outage: one `🚨 AI service unavailable`
2. while outage remains active: no repeat notices
3. outage → recovered: one `🟢 AI service recovered`
4. later new outage may alert again

## Human-control lease contract
- every successful `Take Over` starts a 1-hour inactivity lease
- only active claimant renews with valid staff activity or `Extend 1h`
- existing 5-minute Cron auto-returns expired claims to AI
- Bot Owner may override immediately regardless of claimant

## Deployment contract
Canonical `wrangler.jsonc` has `triggers.crons = ["*/5 * * * *"]`; isolated production Wrangler config copies `source.triggers`.

Every production deploy validates typecheck, local migrations, dry-run bundle, remote migrations, deploy, bindings, `/health`, Telegram webhook cutover/read-back and exact Owner command registry 19/19.

The workflow injects `DEPLOY_REVISION` and `DEPLOY_CHANGE`; `🟢 Bot is Online!` shows both when available.

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
- `staff_presence_entry.ts` — staff availability command UX/parser + private/group routing
- `human_control_lease.ts` — human takeover expiry
- `ai_runtime.ts` — grounded AI execution + outage/recovery signaling
- `ai_outage_alert.ts` — transition-only AI outage/recovery notices
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
- private availability commands with required Staff Inbox + team-visible group mirroring
- transition-only AI outage/recovery alert + human fallback continuity
- reboot notice with revision + deployed change summary
- `/limits`, progressive inquiry limits, Interaction Flood Guard
- Owner-only permanent ban/unban
- editable manuals

## Migrations / manuals
Current migration range: `0001` through `0032`.
Newest migration: `0032_private_staff_availability_commands.sql`.

## Next exact validation
After the triggered production workflow is green:
1. verify migration 0032/deploy/health/webhook pass
2. verify command schema revision 10 syncs and Owner remains exact 19/19
3. with active Staff Inbox configured, use `/available` in authorized private chat and confirm state changes
4. confirm one Staff Inbox root update appears with actor identity + state
5. use private `/unavailable 3` and confirm private timer response + group mirror
6. use private `/available 09:00 17:00` and `/available 9am 5pm`; verify equivalent schedules and group visibility
7. temporarily test no-Staff-Inbox condition: private availability command must reject before mutation
8. Staff Inbox group command path remains backward-compatible
9. `/noti` still rejects private use
10. unauthorized private user cannot change staff state
11. timer/schedule effective counts and Cron transitions remain correct
12. existing takeover lease, Owner override, AI fallback, limits/flood guard and FAQ remain operational

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with live repository reality.
