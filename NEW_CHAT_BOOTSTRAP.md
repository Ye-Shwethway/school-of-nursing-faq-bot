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
The project is main-only and production-live. Owner private-chat `/cases` has already been live-accepted. The newest source slice on `main` adds **normal-user spam protection, progressive cooldowns, `/limits` Owner/Sudo controls, direct test-user lookup, temporary exemptions/restrictions, blocked-warning throttling, and Owner-only permanent ban/unban**. Do not call this latest slice production-green until the single production workflow is verified.

## Current product surfaces
- multilingual deterministic/dynamic FAQ
- public role-aware `/faq` with localized paginated read-only browsing for normal users
- Owner/Sudo FAQ management
- one-language multilingual FAQ authoring with Primary→Fallback AI translation drafts
- manual translation fallback and explicit `✅ Approve & Save`
- `/cases` Owner/Sudo escalation archive, 6/page, Open/Claimed/Resolved/All
- case → Add as FAQ / Find Related FAQ
- persisted escalation reason + linked FAQ
- confirmed permanent case deletion for typo/test/junk cases
- Staff Inbox per-user topics, Take Over/Resolve/Return-to-AI, notifications/presence/reply relay
- `/limits` Owner/Sudo user-limit management
- Owner-only permanent ban/unban
- editable Owner/Admin manuals covering current operations

## Spam protection contract
Applies only to **normal-user private free-text inquiries** before FAQ/AI/handoff processing.

Default window:
- 10 free-text inquiries / 10 minutes
- the next inquiry triggers cooldown
- repeat limit hits within 24h: 30 minutes → 2 hours → 12 hours
- never auto-permanently-ban

When blocked:
- do not run deterministic/AI/handoff processing for the rejected text
- do not call AI
- do not create a new escalation case
- keep previously accepted/logged questions
- return neutral localized system copy with approximate wait time and `/faq`
- throttle repeated blocked warnings to **at most one per 5 minutes**
- keep `/faq`, `/language`, `/start`, and other safe commands available

Owner/Sudo accounts bypass the normal-user rate window.

## `/limits` contract
Owner/Sudo only; allowed in private bot chat or configured active Staff Inbox group.

Entry points:
- `/limits` — pager of users with history/active state
- `/limits <telegram_user_id>` — direct lookup, including a normal test account that has not hit a limit yet

Owner + Sudo controls:
- `🔓 Unlock Now`
- `🧪 Exempt 1h` — intended for temporary QA/testing bypass
- `⏳ Restrict 2h`
- `Reset Strikes`

Owner-only controls:
- `🚫 Permanently Ban` — requires confirmation
- `✅ Unban User`

Permanent ban blocks normal free-text inquiries before FAQ/AI/escalation but keeps `/faq` and safe commands available. Unban clears ban plus immediate cooldown/window state. All overrides and ban/unban operations write to `admin_audit`.

## Escalation Inbox contract
`/cases` is Owner/Sudo only in private bot chat or active Staff Inbox. Lists are newest-first, 6/page.

`🗑 Delete Case` requires explicit permanent-delete confirmation and deletes only the case + `escalation_messages`; preserve user, original `questions` record, and linked FAQ.

## Multilingual FAQ authoring
Owner/Sudo choose Burmese, English, or Simplified Chinese as authoritative source language, enter source question+answer, then use configured Primary→Fallback AI to draft the other two languages or fill them manually. AI remains draft-only. All three languages require review before `✅ Approve & Save`. AI failure never blocks manual completion.

## Language selector
`/language`: `မြန်မာ` · `English` · `简体中文`.
Successful selection: persist → delete picker → one localized confirmation. Never silent-close.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.

Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.

Owner additionally: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.

Command schema revision: **9**.
Sudo total: **12**.
Production exact Owner target: **19 commands**.

## Migrations / manuals
Current migration range: `0001` through `0022`.

Latest relevant migrations:
- `0019_user_rate_limits.sql`
- `0020_manual_spam_protection.sql`
- `0021_rate_limit_notice_throttle.sql`
- `0022_manual_limits_refinement.sql`

Owner/Admin manuals now cover the rate window, progressive cooldowns, `/limits`, direct lookup, testing exemption, temporary restriction, unlock/reset, Owner-only permanent ban/unban, and 5-minute blocked-warning throttle.

## Canonical Worker stack
Wrangler entrypoint: `src/rate_limit_entry.ts`.

Top layers:
1. `rate_limit_entry.ts` — `/limits` + normal-user free-text rate gate
2. `faq_ai_entry.ts` — FAQ authoring + AI translation
3. `cases_entry.ts` — `/cases`
4. existing Staff/manual/deploy/monitoring/UX/security/runtime/index stack

## Production workflow contract
`.github/workflows/deploy-production.yml` remains the sole production workflow and must validate credentials, typecheck, migrations, Worker dry-run, remote migrations, deploy, binding preservation, `/health`, nonce-gated command sync, and exact **19-command** Owner Telegram read-back including `/limits`.

## Next exact validation
After workflow green:
1. send 10 normal-user free-text inquiries inside 10 min
2. verify next inquiry is blocked before AI/case creation
3. verify repeated blocked spam produces no more than one warning per 5 min
4. verify `/faq` still works
5. `/limits <test_user_id>` → `Exempt 1h` and continue normal-user QA
6. test Unlock / Restrict 2h / Reset Strikes
7. Owner permanent-ban confirmation → free text blocked, `/faq` still available
8. Owner Unban → free text restored
9. verify blocked spam created no extra `/cases`

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals, and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with live repository reality.
