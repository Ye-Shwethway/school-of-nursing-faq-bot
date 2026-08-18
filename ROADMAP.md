# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, human handoff when automation cannot answer safely.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **SPAM PROTECTION + USER LIMIT ADMIN CONTROLS IMPLEMENTED ON MAIN; PRODUCTION WORKFLOW VERIFICATION REQUIRED**.

Implemented/current:
- public localized `/faq` library for normal users
- Owner/Sudo FAQ management
- one-language multilingual FAQ authoring with Primary→Fallback AI draft generation
- manual translation fallback and explicit `✅ Approve & Save`
- AI-assisted FAQ edit drafts that do not replace live FAQ before approval
- `/cases` Owner/Sudo Escalation Inbox, Open/Claimed/Resolved/All, 6/page
- case → Add as FAQ / Find Related FAQ
- persisted escalation reason and linked FAQ
- confirmed permanent deletion of typo/test/junk cases with confirmation
- Staff Inbox Take Over / Resolve / Return-to-AI, presence, notifications, topic reply relay
- `/limits` Owner/Sudo rate-limit management with pager and direct `/limits <telegram_id>` lookup
- temporary testing exemption and manual temporary restriction
- Owner-only permanent ban/unban
- repeated blocked-user warning throttled to at most once per 5 minutes
- manuals and design rules synchronized with the current limits policy

## Spam protection policy
Normal-user private free-text inquiries pass through the rate-limit gate before FAQ/AI/handoff processing.

Default policy:
- 10 free-text inquiries / 10 minutes
- inquiry after the limit triggers cooldown before FAQ/AI/escalation work
- repeat limit hits within 24h progress: 30 min → 2h → 12h
- automatic permanent bans are forbidden
- rejected spam text does not create escalation cases and does not call AI
- blocked-user warning is sent at most once per 5 minutes while the block remains active
- `/faq`, `/language`, `/start`, and other safe commands remain available during cooldown/restriction/ban
- Owner/Sudo accounts do not consume the normal-user rate window

Persistent state is stored in `user_rate_limits` from migration `0019_user_rate_limits.sql`; `0021_rate_limit_notice_throttle.sql` adds blocked-notice throttling state.

## `/limits` admin surface
Allowed only for Owner/Sudo in:
- private bot chat
- configured active Staff Inbox group

Entry points:
- `/limits` — pager of users with limit history/active state
- `/limits <telegram_user_id>` — direct lookup, useful for pre-exempting a normal QA/test account

Owner/Sudo controls:
- `🔓 Unlock Now` — clears cooldown/temporary restriction and resets the immediate window
- `🧪 Exempt 1h` — temporary testing exemption
- `⏳ Restrict 2h` — temporary manual restriction
- `Reset Strikes` — clears progressive strike history/window counter

Owner-only controls:
- `🚫 Permanently Ban` — confirmation-gated
- `✅ Unban User` — clears ban and immediate cooldown/window state

A banned user cannot submit free-text inquiries; AI and new escalation creation do not run. Read-only `/faq` remains available. Admin overrides and ban/unban actions are written to `admin_audit`.

## Escalation Inbox
`/cases` remains Owner/Sudo only in private bot chat or active Staff Inbox. Lists are newest-first, 6/page. Case detail may expose user identity, language, question, status, timestamps, reason, claimant, and linked FAQ.

`🗑 Delete Case` requires confirmation and deletes only the escalation case plus its `escalation_messages`; it does not delete the user, original `questions` log, or linked FAQ.

## Multilingual FAQ authoring
Owner/Sudo choose Burmese, English, or Simplified Chinese as authoritative source language, write source question+answer, then either generate the other two languages using configured Primary/Fallback AI or fill them manually. AI output is draft-only. All three languages must be reviewed before `✅ Approve & Save`.

AI failure must never block FAQ creation. Translation prompts may not invent/change dates, fees, eligibility, accreditation, contacts, URLs, scholarship/loan/bond terms, or policy promises.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.

Sudo additionally: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.

Owner additionally: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.

Command schema revision: **9**.
Expected Sudo total: **12**.
Expected Owner total: **19**.
Production read-back contract includes `/limits`.

## Migrations
Current migrations: `0001` through `0022`.

Latest spam-protection/manual migrations:
- `0019_user_rate_limits.sql`
- `0020_manual_spam_protection.sql`
- `0021_rate_limit_notice_throttle.sql`
- `0022_manual_limits_refinement.sql`

## Canonical Worker stack
Wrangler entrypoint: `src/rate_limit_entry.ts`.

Top layers:
1. `rate_limit_entry.ts` — `/limits` + normal-user free-text spam gate
2. `faq_ai_entry.ts` — multilingual FAQ authoring / AI translation
3. `cases_entry.ts` — `/cases`
4. lower canonical Staff/FAQ/AI/runtime layers unchanged

## Validation boundary
Do not declare this slice production-green until the latest production workflow passes:
- typecheck
- local + remote migrations
- Worker dry-run/deploy
- production health
- exact 19-command Owner Telegram read-back

Live acceptance after deploy:
1. normal user sends 10 inquiries inside 10 min; next inquiry is blocked before AI/case creation
2. cooldown message shows approximate remaining time and `/faq`
3. repeated blocked messages do not produce more than one warning per 5 minutes
4. `/faq` remains usable while limited
5. `/limits <test_user_id>` → `Exempt 1h` allows continued normal-user QA
6. Owner/Sudo can Unlock, Restrict 2h, Reset Strikes
7. Owner permanent-ban confirmation blocks free text but keeps `/faq`
8. Owner Unban restores free-text access
9. verify blocked spam did not create extra `/cases` records
