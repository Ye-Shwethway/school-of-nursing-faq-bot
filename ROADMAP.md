# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, human handoff when automation cannot answer safely.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **TWO-LAYER SPAM PROTECTION + USER LIMIT ADMIN CONTROLS IMPLEMENTED ON MAIN; PRODUCTION WORKFLOW VERIFICATION REQUIRED**.

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
- inquiry blocked-warning throttled to at most once per 5 minutes
- private Interaction Flood Guard for command/button/message spam
- manuals and design rules synchronized with Exempt/Restrict semantics and flood protection

## Spam protection architecture
Spam protection has two separate gates.

### 1. Inquiry rate limit
Normal-user private free-text inquiries pass through this gate before FAQ/AI/handoff processing.

Default policy:
- 10 free-text inquiries / 10 minutes
- inquiry after the limit triggers cooldown before FAQ/AI/escalation work
- repeat limit hits within 24h progress: 30 min → 2h → 12h
- automatic permanent bans are forbidden
- rejected spam text does not create escalation cases and does not call AI
- blocked-user warning is sent at most once per 5 minutes while the block remains active
- `/faq`, `/language`, `/start`, `/whoami`, and other safe commands remain available
- Owner/Sudo accounts do not consume the normal-user inquiry window

Persistent inquiry state is stored in `user_rate_limits` from migration `0019_user_rate_limits.sql`; `0021_rate_limit_notice_throttle.sql` adds blocked-notice throttling state.

### 2. Interaction Flood Guard
Runs at the top of private Telegram interaction handling before command/callback/free-text work.

Policy:
- count private commands + inline callbacks + messages
- normal users: 20 interactions / 60 seconds
- active cooldown/restriction/permanent-ban users: 6 interactions / 60 seconds
- threshold breach → 5-minute UI flood block
- first blocked interaction may show one localized warning; additional blocked traffic is silently dropped
- flood warning repeats at most once per 5 minutes
- Owner/Sudo bypass the flood guard
- `Exempt 1h` bypasses the inquiry limiter only and does not bypass flood protection

State is stored in `user_interaction_limits`. Migration `0023_interaction_flood_guard.sql` introduces the state; `0024_interaction_flood_guard_no_fk.sql` removes the user foreign-key dependency so the guard can run before first-user bootstrap.

## `/limits` admin surface
Allowed only for Owner/Sudo in:
- private bot chat
- configured active Staff Inbox group

Entry points:
- `/limits` — pager of users with limit history/active state
- `/limits <telegram_user_id>` — direct lookup, useful for pre-exempting a normal QA/test account

Owner/Sudo controls:
- `🔓 Unlock Now` — clears cooldown/temporary restriction and resets the immediate inquiry window; does not create an exemption
- `🧪 Exempt 1h` — bypasses only the free-text inquiry limiter for QA/trusted testing; flood guard remains active
- `⏳ Restrict 2h` — blocks free-text inquiries for 2h and clears any active exemption; safe commands remain under the tighter flood threshold
- `Reset Strikes` — clears progressive strike history/window counter

Owner-only controls:
- `🚫 Permanently Ban` — confirmation-gated indefinite free-text block
- `✅ Unban User` — clears ban and immediate cooldown/window state

A banned user cannot submit free-text inquiries; AI and new escalation creation do not run. Read-only `/faq` remains available but is protected by the tighter Interaction Flood Guard. Admin overrides and ban/unban actions are written to `admin_audit`.

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
Current migrations: `0001` through `0025`.

Latest spam-protection/manual migrations:
- `0019_user_rate_limits.sql`
- `0020_manual_spam_protection.sql`
- `0021_rate_limit_notice_throttle.sql`
- `0022_manual_limits_refinement.sql`
- `0023_interaction_flood_guard.sql`
- `0024_interaction_flood_guard_no_fk.sql`
- `0025_manual_interaction_flood_guard.sql`

## Canonical Worker stack
Wrangler entrypoint: `src/interaction_guard_entry.ts`.

Top layers:
1. `interaction_guard_entry.ts` — private interaction flood gate
2. `rate_limit_entry.ts` — `/limits` + normal-user free-text inquiry gate
3. `faq_ai_entry.ts` — multilingual FAQ authoring / AI translation
4. `cases_entry.ts` — `/cases`
5. lower canonical Staff/FAQ/AI/runtime layers unchanged

## Validation boundary
Do not declare this slice production-green until the latest production workflow passes:
- typecheck
- local + remote migrations through `0025`
- Worker dry-run/deploy
- production health
- exact 19-command Owner Telegram read-back

Live acceptance after deploy:
1. normal user sends 10 inquiries inside 10 min; next inquiry is blocked before AI/case creation
2. cooldown message shows approximate remaining time and `/faq`
3. repeated blocked free-text messages do not produce more than one warning per 5 minutes
4. `/faq` remains usable while limited under the interaction flood threshold
5. normal user exceeds 20 private interactions/60s → 5-minute flood block
6. restricted/banned user exceeds 6 private interactions/60s → 5-minute flood block
7. first flood block warns once; repeated blocked commands/callbacks/messages are silently dropped
8. `/limits <test_user_id>` → `Exempt 1h` allows continued inquiry QA but does not bypass flood protection
9. applying `Restrict 2h` removes active Exempt and blocks free-text inquiries
10. Owner/Sudo can Unlock and Reset Strikes; Owner can confirm permanent ban/unban
11. verify blocked inquiry/flood traffic did not create extra `/cases` records or AI calls
