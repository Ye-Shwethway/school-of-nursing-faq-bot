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
The project is main-only and production-live. Owner private-chat `/cases` has already been live-accepted. The newest source slice on `main` adds **FAQ-first onboarding after language selection** on top of the existing two-layer spam protection and `/limits` controls. Do not call the newest source slice production-green until the single production workflow is verified.

## Current product surfaces
- multilingual deterministic/dynamic FAQ
- public role-aware `/faq` with localized paginated read-only browsing for normal users
- FAQ-first `/start`/`/language` onboarding: choose language → delete picker → localized `/faq`-first confirmation → direct `📚 Browse FAQ` button
- free-text questions positioned as the path only when the FAQ library does not cover the topic
- Owner/Sudo FAQ management
- one-language multilingual FAQ authoring with Primary→Fallback AI translation drafts
- manual translation fallback and explicit `✅ Approve & Save`
- `/cases` Owner/Sudo escalation archive, 6/page, Open/Claimed/Resolved/All
- case → Add as FAQ / Find Related FAQ
- persisted escalation reason + linked FAQ
- confirmed permanent case deletion for typo/test/junk cases
- Staff Inbox per-user topics, Take Over/Resolve/Return-to-AI, notifications/presence/reply relay
- `/limits` Owner/Sudo user-limit management
- private command/callback/message flood protection
- Owner-only permanent ban/unban
- editable Owner/Admin manuals covering current operations

## FAQ-first onboarding contract
`/start` and `/language` use the existing one-shot picker: `မြန်မာ` · `English` · `简体中文`.

After a valid selection:
1. persist the language
2. delete the picker message
3. send one localized confirmation
4. tell the user to check `/faq` first for common questions
5. explain that they may type a free-text question if the FAQ library does not cover it
6. show one localized `📚 Browse FAQ` button using the existing public FAQ callback path

This is intentional product guidance to favor deterministic approved FAQ content before unnecessary free-text/AI calls. Never silent-close the picker and never tell the user only that they can now send a question.

## Spam protection contract
Two independent gates are active for normal private users.

### Inquiry rate gate
Applies to private free-text inquiries before FAQ/AI/handoff processing.

Default window:
- 10 free-text inquiries / 10 minutes
- the next inquiry triggers cooldown
- repeat limit hits within 24h: 30 minutes → 2 hours → 12 hours
- never auto-permanently-ban

When inquiry-blocked:
- do not run deterministic/AI/handoff processing for rejected text
- do not call AI
- do not create a new escalation case
- keep previously accepted/logged questions
- return neutral localized system copy with approximate wait time and `/faq`
- throttle repeated blocked warnings to at most one per 5 minutes
- keep `/faq`, `/language`, `/start`, `/whoami`, and other safe commands available

Owner/Sudo accounts bypass the normal-user inquiry window.

### Interaction Flood Guard
Runs before lower private command/callback/free-text handling.

Policy:
- count private commands + inline-button callbacks + messages
- normal users: 20 interactions / 60 seconds
- active cooldown/restriction/permanent-ban users: 6 interactions / 60 seconds
- threshold breach → 5-minute UI flood block
- first blocked interaction may show one localized warning
- additional blocked interactions are silently dropped; warning repeats at most once per 5 minutes
- Owner/Sudo bypass this flood guard
- `Exempt 1h` does not bypass flood protection

This keeps safe commands available without leaving `/faq` or callback navigation open to unlimited command/button spam.

## `/limits` contract
Owner/Sudo only; allowed in private bot chat or configured active Staff Inbox group.

Entry points:
- `/limits` — pager of users with history/active state
- `/limits <telegram_user_id>` — direct lookup, including a normal test account that has not hit a limit yet

Owner + Sudo controls:
- `🔓 Unlock Now` — clears cooldown/temporary restriction and resets the immediate inquiry window; it does not grant Exempt
- `🧪 Exempt 1h` — temporary QA/trusted bypass of the free-text inquiry limiter only; Interaction Flood Guard remains active
- `⏳ Restrict 2h` — blocks free-text inquiries for 2 hours and removes any active Exempt; safe commands remain under the tighter flood threshold
- `Reset Strikes` — clears progressive strike/window history; it is not an exemption

Owner-only controls:
- `🚫 Permanently Ban` — requires confirmation
- `✅ Unban User`

Permanent ban blocks normal free-text inquiries before FAQ/AI/escalation but keeps `/faq` and safe commands available under the tighter flood threshold. Unban clears ban plus immediate cooldown/window state. Admin overrides and ban/unban operations write to `admin_audit`.

## Escalation Inbox contract
`/cases` is Owner/Sudo only in private bot chat or active Staff Inbox. Lists are newest-first, 6/page.

`🗑 Delete Case` requires explicit permanent-delete confirmation and deletes only the case + `escalation_messages`; preserve user, original `questions` record, and linked FAQ.

## Multilingual FAQ authoring
Owner/Sudo choose Burmese, English, or Simplified Chinese as authoritative source language, enter source question+answer, then use configured Primary→Fallback AI to draft the other two languages or fill them manually. AI remains draft-only. All three languages require review before `✅ Approve & Save`. AI failure never blocks manual completion.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.

Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.

Owner additionally: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.

Command schema revision: **9**.
Sudo total: **12**.
Production exact Owner target: **19 commands**.

## Migrations / manuals
Current migration range: `0001` through `0025`.

Latest relevant migrations:
- `0019_user_rate_limits.sql`
- `0020_manual_spam_protection.sql`
- `0021_rate_limit_notice_throttle.sql`
- `0022_manual_limits_refinement.sql`
- `0023_interaction_flood_guard.sql`
- `0024_interaction_flood_guard_no_fk.sql`
- `0025_manual_interaction_flood_guard.sql`

Owner/Admin manuals explicitly distinguish Exempt vs Restrict and document interaction-flood thresholds, silent-drop behavior, Owner/Sudo bypass, and the fact that Exempt bypasses inquiry limits only.

## Canonical Worker stack
Wrangler entrypoint: `src/interaction_guard_entry.ts`.

Top layers:
1. `interaction_guard_entry.ts` — private commands/callbacks/messages flood gate
2. `rate_limit_entry.ts` — `/limits` + normal-user free-text inquiry rate gate
3. `faq_ai_entry.ts` — FAQ authoring + AI translation
4. `cases_entry.ts` — `/cases`
5. existing Staff/manual/deploy/monitoring/UX/security/runtime/index stack

`secure_entry.ts` owns the active one-shot language-selection save/delete/FAQ-first confirmation behavior.

## Production workflow contract
`.github/workflows/deploy-production.yml` remains the sole production workflow and must validate credentials, typecheck, migrations, Worker dry-run, remote migrations, deploy, binding preservation, `/health`, nonce-gated command sync, and exact **19-command** Owner Telegram read-back including `/limits`.

## Next exact validation
After workflow green:
1. `/start` → choose each language → verify picker deletion + FAQ-first localized confirmation
2. verify `📚 Browse FAQ` opens the public FAQ list directly
3. `/language` repeats the same one-shot FAQ-first behavior
4. send 10 normal-user free-text inquiries inside 10 min
5. verify next inquiry is blocked before AI/case creation
6. verify repeated blocked free-text spam produces no more than one warning per 5 min
7. verify `/faq` remains usable while limited
8. normal user exceeds 20 private interactions/60s → 5-minute flood block
9. restricted/banned user exceeds 6 private interactions/60s → 5-minute flood block
10. verify only first blocked flood interaction warns and subsequent blocked commands/callbacks/messages are silent-dropped
11. `/limits <test_user_id>` → `Exempt 1h`; verify inquiry QA continues but flood guard still applies
12. apply `Restrict 2h`; verify Exempt disappears and free-text is blocked
13. Owner permanent-ban confirmation → free text blocked, `/faq` remains available under tight flood guard
14. Owner Unban → free text restored
15. verify blocked inquiry/flood traffic created no extra `/cases` or AI calls

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals, and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with live repository reality.
