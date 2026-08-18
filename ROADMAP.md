# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, human handoff when automation cannot answer safely.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **FAQ-FIRST ONBOARDING LIVE-ACCEPTED; FALSE ESCALATION GUARD + AI CLARIFICATION + DEPLOY-NOTICE RETRY IMPLEMENTED ON MAIN; NEWEST SLICE REQUIRES PRODUCTION VERIFICATION**.

Live-confirmed before this slice:
- `/language` saves the selected language and returns the new FAQ-first localized confirmation in production.
- FAQ-first onboarding therefore reached production successfully even though one deploy-online Telegram notice was missed.

Implemented/current:
- public localized `/faq` library for normal users
- FAQ-first onboarding after `/start` or `/language`: language selection → picker removal → localized confirmation promoting `/faq` → direct `📚 Browse FAQ` button
- free-text inquiry positioned as the path for questions not covered by `/faq`
- Owner/Sudo FAQ management and multilingual FAQ authoring
- `/cases` Owner/Sudo Escalation Inbox with confirmed case deletion
- Staff Inbox Take Over / Resolve / Return-to-AI, presence, notifications, topic reply relay
- `/limits` Owner/Sudo rate-limit management, temporary exemption/restriction, Owner-only permanent ban/unban
- 10 inquiries / 10 min progressive inquiry cooldown
- private Interaction Flood Guard for command/button/message floods
- new Input Quality Gate to suppress obvious low-information false escalations before FAQ/AI/handoff
- AI clarification decision for meaningful but incomplete/ambiguous input
- production online notice retry when Telegram delivery fails completely
- manuals and design rules synchronized with current behavior

## FAQ-first onboarding
`/start` and `/language` open the one-shot language picker. After a language is saved:
- delete the picker message
- send one localized confirmation
- tell the user to check `/faq` first for common questions
- explain that free-text inquiry is for questions not covered there
- show one localized `📚 Browse FAQ` inline button that opens the public FAQ list directly

This UX intentionally steers common questions toward deterministic approved FAQ content before free-text/AI usage.

## False escalation guard
Normal private free-text now passes an Input Quality Gate after the inquiry/flood protections and after FAQ/admin text routing, but before the lower FAQ/AI/handoff path.

Deterministic no-AI/no-case examples:
- numbers only such as `1`, `12`, `123`
- punctuation/symbol only
- single-character noise
- URL-only, username-only, or phone-number-only input
- repeated-character garbage
- acknowledgement-only text such as `ok`, `yes`, basic greetings/thanks when no usable question is present

Behavior:
- return a localized clarification asking for a more complete question
- point the user to `/faq`
- do not call AI
- do not create a new escalation case
- do not mirror junk into Staff Inbox as a normal unresolved question

The gate deliberately avoids length-only blocking. Short meaningful topics such as `fees?`, `tuition`, `admission`, `CDM`, `accreditation`, etc. continue to FAQ/AI handling.

Human-controlled conversations and active admin/setup sessions bypass the quality gate.

## AI clarification vs handoff
The grounded agent output contract now allows `answer | clarify | handoff`.

- `clarify`: incomplete/ambiguous/fragmentary input that needs more context before either an answer or useful staff review. No case should be created.
- `handoff`: sufficiently specific, meaningful School of Nursing question that staff could reasonably review or act on, but approved knowledge cannot safely answer.

For minimal downstream compatibility, parsed `clarify` decisions are normalized into the existing terminal answered-response path with an internal `clarify:` reason marker. This prevents case creation without widening every runtime consumer in this slice.

## Spam protection architecture
### Inquiry rate limit
- 10 private free-text inquiries / 10 minutes
- next inquiry triggers cooldown before FAQ/AI/escalation
- repeat hits within 24h: 30 min → 2h → 12h
- never auto-permanently-ban
- rejected spam does not create cases or call AI
- blocked notice at most once per 5 minutes
- safe commands remain available
- Owner/Sudo bypass this inquiry window

### Interaction Flood Guard
- normal users: 20 private interactions / 60 seconds
- active cooldown/restriction/permanent-ban users: 6 / 60 seconds
- threshold breach → 5-minute UI flood block
- first blocked interaction may warn; later blocked traffic is silent-dropped
- Owner/Sudo bypass
- `Exempt 1h` bypasses inquiry limiting only, not flood protection

## `/limits` admin surface
Owner/Sudo controls:
- `🔓 Unlock Now`
- `🧪 Exempt 1h`
- `⏳ Restrict 2h`
- `Reset Strikes`

Owner-only:
- `🚫 Permanently Ban` with confirmation
- `✅ Unban User`

## Deployment online notice retry
Production `/health` still performs best-effort command sync and one online notice per revision.

Previous flaw: the revision was claimed before Telegram delivery; if all sends failed, that revision could remain permanently marked as notified.

Current behavior:
- atomically claim the revision before sending to prevent duplicate concurrent notices
- if at least one Owner/Sudo delivery succeeds, keep the claim
- if every delivery fails, release the revision claim so a later successful `/health` request can retry
- notice failure never fails production health

## Escalation Inbox
`/cases` remains Owner/Sudo only in private bot chat or active Staff Inbox. `🗑 Delete Case` requires confirmation and deletes only the case plus its `escalation_messages`; preserve user, original `questions` log, and linked FAQ.

The new false-escalation guard is intended to keep `/cases` focused on real knowledge gaps and actionable staff work rather than typos/junk fragments.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.

Sudo additionally: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.

Owner additionally: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.

Command schema revision: **9**. Expected Sudo total: **12**. Expected Owner total: **19**.

## Migrations
Current migrations: `0001` through `0026`.

Latest relevant migrations:
- `0019_user_rate_limits.sql`
- `0021_rate_limit_notice_throttle.sql`
- `0023_interaction_flood_guard.sql`
- `0024_interaction_flood_guard_no_fk.sql`
- `0025_manual_interaction_flood_guard.sql`
- `0026_manual_false_escalation_guard.sql`

## Canonical Worker stack
Wrangler entrypoint remains `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts` — private interaction flood gate
2. `rate_limit_entry.ts` — `/limits` + normal-user inquiry rate gate
3. `faq_ai_entry.ts` — FAQ authoring interception, then forwards normal text to Input Quality Gate
4. `input_quality_entry.ts` — deterministic false-escalation filter
5. `cases_entry.ts` — `/cases`
6. lower Staff/monitoring/FAQ/AI/runtime layers

`agent_policy.ts` owns AI clarify-vs-handoff policy. `deployment_notice_entry.ts` owns retry-safe production-online notice delivery.

## Validation boundary
Do not declare the newest slice production-green until the production workflow passes:
- typecheck
- local + remote migrations through `0026`
- Worker dry-run/deploy
- production health
- exact 19-command Owner Telegram read-back

Live acceptance after deploy:
1. send `1`, `123`, `...`, a single emoji, URL-only, `ok` → localized clarification; no AI answer/handoff; no new `/cases` record
2. send `fees?`, `CDM?`, `admission?` → normal FAQ/AI path still works
3. send a meaningful but incomplete school question that AI classifies as clarify → clarification returned; no case
4. send a specific unanswered School of Nursing question → real handoff and case still occur
5. verify human-control short replies are not filtered
6. verify active admin/setup wizard text is not filtered
7. verify missed online-notice delivery can retry on a later successful `/health`
8. verify existing FAQ-first onboarding, inquiry limits, flood guard, `/limits`, ban/unban, and `/cases` remain intact
