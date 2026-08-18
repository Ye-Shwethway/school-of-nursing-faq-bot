# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, human handoff when automation cannot answer safely.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **FAQ-FIRST ONBOARDING + FALSE ESCALATION GUARD LIVE; PRODUCTION DEPLOY NOW AUTOMATES TELEGRAM WEBHOOK CUTOVER; LATEST CUTOVER RUN REQUIRES LIVE INBOUND-COMMAND VERIFICATION**.

Live-confirmed:
- `/language` saves the selected language and returns the FAQ-first localized confirmation in production.
- false-escalation filtering accepts the intended junk/fragment tests without creating cases.
- the rotated Telegram bot token is valid for outbound Bot API calls because the new bot received the production-online message.
- the previous production workflow could deploy and sync commands without re-registering the webhook after a bot-token rotation, leaving inbound commands unavailable on the new bot.

Implemented/current:
- public localized `/faq` library for normal users
- FAQ-first `/start` or `/language` onboarding with direct `📚 Browse FAQ`
- Owner/Sudo FAQ management and multilingual FAQ authoring
- `/cases` Owner/Sudo Escalation Inbox with confirmed case deletion
- Staff Inbox Take Over / Resolve / Return-to-AI, presence, notifications, topic reply relay
- `/limits` Owner/Sudo rate-limit management, temporary exemption/restriction, Owner-only permanent ban/unban
- 10 inquiries / 10 min progressive inquiry cooldown
- private Interaction Flood Guard for command/button/message floods
- Input Quality Gate to suppress obvious low-information false escalations before FAQ/AI/handoff
- AI clarification decision for meaningful but incomplete/ambiguous input
- production online-notice retry when Telegram delivery fails completely
- automatic nonce-gated Telegram webhook cutover + read-back in the production workflow
- manuals and design rules synchronized with current behavior

## FAQ-first onboarding
`/start` and `/language` open the one-shot language picker. After a language is saved:
- delete the picker message
- send one localized confirmation
- tell the user to check `/faq` first for common questions
- explain that free-text inquiry is for questions not covered there
- show one localized `📚 Browse FAQ` inline button that opens the public FAQ list directly

## False escalation guard
Normal private free-text passes an Input Quality Gate after inquiry/flood protection and FAQ/admin text routing, but before the lower FAQ/AI/handoff path.

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

The gate deliberately avoids length-only blocking. Short meaningful topics such as `fees?`, `tuition`, `admission`, `CDM`, `accreditation`, etc. continue to FAQ/AI handling. Human-controlled conversations and active admin/setup sessions bypass the quality gate.

## AI clarification vs handoff
The grounded agent output contract allows `answer | clarify | handoff`.

- `clarify`: incomplete/ambiguous/fragmentary input that needs more context before either an answer or useful staff review. No case should be created.
- `handoff`: sufficiently specific, meaningful School of Nursing question that staff could reasonably review or act on, but approved knowledge cannot safely answer.

For minimal downstream compatibility, parsed `clarify` decisions are normalized into the existing terminal answered-response path with an internal `clarify:` reason marker.

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
Production `/health` performs best-effort command sync and one online notice per revision. The revision is atomically claimed before sending; if every Owner/Sudo Telegram delivery fails, the claim is released so a later successful `/health` can retry. Notice failure never fails production health.

## Automatic Telegram webhook cutover
The production Worker already exposes the nonce-gated `/ops/telegram/cutover` endpoint. The production workflow now uses it on every deploy after health succeeds:
1. generate a random one-time cutover nonce
2. store it in production D1 as `telegram_cutover_nonce`
3. POST to `/ops/telegram/cutover` with `X-Cutover-Nonce`
4. runtime calls Telegram `setWebhook` using the current `TELEGRAM_BOT_TOKEN` and existing `TELEGRAM_WEBHOOK_SECRET`
5. runtime reads back `getWebhookInfo` and requires the Worker `/telegram/webhook` URL
6. only then proceed to exact Owner command registry verification

This closes the bot-token-rotation gap: replacing `TELEGRAM_BOT_TOKEN` in Cloudflare and running the production workflow now re-registers inbound Telegram delivery automatically. `TELEGRAM_WEBHOOK_SECRET` does not need rotation unless intentionally changed or exposed.

## Escalation Inbox
`/cases` remains Owner/Sudo only in private bot chat or active Staff Inbox. `🗑 Delete Case` requires confirmation and deletes only the case plus its `escalation_messages`; preserve user, original `questions` log, and linked FAQ.

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
3. `faq_ai_entry.ts` — FAQ authoring interception
4. `input_quality_entry.ts` — deterministic false-escalation filter
5. `cases_entry.ts` — `/cases`
6. lower Staff/monitoring/FAQ/AI/runtime layers

`agent_policy.ts` owns AI clarify-vs-handoff policy. `deployment_notice_entry.ts` owns retry-safe online notice plus nonce-gated Telegram cutover endpoints.

## Validation boundary
The production workflow must pass:
- typecheck
- local + remote migrations through `0026`
- Worker dry-run/deploy
- production binding preservation
- production health
- **Telegram webhook cutover + read-back**
- exact 19-command Owner Telegram read-back

Live acceptance after the latest deploy:
1. new bot `/start` receives a response, proving Telegram → Worker webhook delivery
2. `/language` and `/faq` work on the new bot
3. Owner command menu remains 19/19
4. `1`, `123`, `...`, single emoji, URL-only, `ok` → localized clarification; no new `/cases`
5. `fees?`, `CDM?`, `admission?` → normal FAQ/AI path
6. meaningful incomplete school question → clarification; no case
7. specific unanswered School of Nursing question → real handoff/case
8. human-control and admin/setup text bypass quality filtering
