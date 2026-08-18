# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence
Read in order:
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant canonical docs/source

Live repository plus verified Cloudflare/Telegram evidence outranks remembered chat context.

## Current checkpoint
The project is main-only and production-live. Owner private-chat `/cases` has already been live-accepted. The latest source slice on `main` adds **normal-user spam protection, progressive cooldowns, `/limits` Owner/Sudo controls, temporary testing exemption, and Owner-only permanent ban/unban**. Do not call this latest slice production-green until the single production workflow is verified.

## Current product surfaces
- multilingual deterministic/dynamic FAQ
- public role-aware `/faq`
- localized paginated read-only FAQ library for normal users
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
- inquiry after the limit triggers cooldown
- repeat limit hits within 24h: 30 minutes → 2 hours → 12 hours
- no automatic permanent ban

When blocked:
- do not call AI
- do not create a new escalation case
- preserve previously accepted/logged questions
- return neutral localized system copy with approximate remaining wait time
- point the user to `/faq`
- keep `/faq`, `/language`, `/start`, and other safe commands usable

Owner/Sudo traffic is not rate-limited by this normal-user gate.

Migration `0019_user_rate_limits.sql` stores rolling-window state, cooldown, strike history, exemption, temporary restriction, and permanent-ban metadata.

## `/limits` contract
Owner/Sudo only. Allowed in:
- private bot chat
- configured active Staff Inbox group

The pager shows users with limit history, active cooldown/restriction/exemption, or permanent ban. Detail shows immutable Telegram ID, status, current 10-minute window count, strikes, and relevant timestamps.

Owner + Sudo controls:
- `🔓 Unlock Now` — clear cooldown/temporary restriction and immediate window
- `🧪 Exempt 1h` — temporary QA/testing exemption
- `⏳ Restrict 2h` — temporary manual restriction
- `Reset Strikes` — reset progressive history/window counter

Owner-only:
- `🚫 Permanently Ban` — confirmation-gated
- `✅ Unban User`

Permanent ban blocks free-text inquiries before FAQ/AI/escalation but keeps read-only `/faq` and safe commands available. Unban clears ban plus immediate cooldown/window state. All admin overrides and ban/unban actions are audited in `admin_audit`.

## Escalation Inbox contract
`/cases` is Owner/Sudo only in private bot chat or the active Staff Inbox group. Lists are newest-first, 6/page.

Case detail may show Telegram identity, language, question, status, timestamps, stored reason, claimant, and linked FAQ.

`🗑 Delete Case` requires `🗑 Yes, Delete Permanently`. Delete only the case and its `escalation_messages`; preserve the user, original `questions` record, and any linked FAQ.

## Multilingual FAQ authoring
Owner/Sudo choose Burmese, English, or Simplified Chinese as the authoritative source language. They enter source question+answer, then either:
- `✨ Generate other 2 languages` using configured Primary then Fallback AI, or
- manual fill/edit.

AI is draft-only and may not invent/change policy facts. All three languages must be reviewed before `✅ Approve & Save`. AI failure must never block publication if admins can manually complete the translations.

## Language selector
`/language`: `မြန်မာ` · `English` · `简体中文`.
Successful selection: persist → delete picker → send one localized confirmation. Never silent-close.

## Command registry
Public (4):
`/start`, `/language`, `/faq`, `/whoami`

Sudo adds:
`/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`

Owner additionally:
`/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`

Command schema revision: **9**.
Sudo total: **12**.
Production exact Owner target: **19 commands**.

## Manuals / migrations
Manual migrations include current case/FAQ/spam workflows. Latest:
- `0017_manual_escalation_knowledge_pipeline.sql`
- `0018_manual_case_delete.sql`
- `0019_user_rate_limits.sql`
- `0020_manual_spam_protection.sql`

Current migration range: `0001` through `0020`.

## Canonical Worker stack
Wrangler entrypoint: `src/rate_limit_entry.ts`.

Top-to-bottom additions:
1. `rate_limit_entry.ts` — `/limits` + normal-user free-text rate gate
2. `faq_ai_entry.ts` — FAQ-authoring interception + AI translation
3. `cases_entry.ts` — `/cases`
4. existing Staff presence/manual/deploy/monitoring/staff UX/general UX/security/runtime/index stack

## Production workflow contract
`.github/workflows/deploy-production.yml` remains the only production workflow. It must validate:
- credentials/bindings
- install + typecheck
- local migrations
- Worker dry-run
- remote production migrations
- deploy
- post-deploy binding preservation
- `/health`
- nonce-gated command resync
- exact 19-command Owner Telegram read-back including `/limits`

## Next exact validation
After workflow green, live-test with a normal user:
1. first 10 free-text inquiries inside 10 minutes are accepted
2. next inquiry is blocked before AI/case creation
3. `/faq` still works during cooldown
4. Owner/Sudo `/limits` can unlock, exempt 1h, restrict 2h, reset strikes
5. use `Exempt 1h` on the normal QA account and continue testing
6. Owner permanent-ban confirmation blocks free text
7. `/faq` still works while banned
8. Owner unban restores free-text access
9. verify blocked spam created no extra `/cases`

## Documentation rule
After each behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals, and `docs/TELEGRAM_DESIGN_RULES.md` aligned with live repository reality.
