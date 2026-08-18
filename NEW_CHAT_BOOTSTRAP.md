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
The project is main-only and production-live. FAQ-first language confirmation has been live-accepted in Telegram, proving the prior onboarding deploy reached production even though that revision's online-notice message was missed.

The newest source slice on `main` adds **false-escalation filtering, AI clarification-before-handoff policy, retry-safe production-online notice delivery, and synchronized manuals/docs**. Do not call this newest slice production-green until the production workflow and live acceptance below are verified.

## Current product surfaces
- multilingual deterministic/dynamic FAQ
- public role-aware `/faq` with localized paginated read-only browsing
- FAQ-first `/start`/`/language` onboarding with localized Browse FAQ CTA
- Owner/Sudo FAQ management and multilingual AI-assisted drafting
- `/cases` escalation archive with Add as FAQ / Find Related FAQ / confirmed delete
- Staff Inbox human takeover/resolve/return-to-AI, presence, notifications, topic relay
- `/limits` Owner/Sudo limit management
- progressive free-text inquiry rate limiting
- private command/callback/message Interaction Flood Guard
- Owner-only permanent ban/unban
- new Input Quality Gate to suppress obvious junk/fragment false escalations
- AI clarify-vs-handoff policy
- retry-safe deploy-online notification
- editable Owner/Admin manuals covering current operations

## FAQ-first onboarding contract
`/start` and `/language` use the one-shot `မြန်မာ` · `English` · `简体中文` picker.

After selection:
1. persist language
2. delete picker
3. send localized confirmation
4. promote `/faq` first for common questions
5. say free-text may be used when FAQ does not cover the topic
6. show localized `📚 Browse FAQ`

This flow is live-confirmed in production as of 2026-08-18.

## False escalation / Input Quality Gate
Normal private free-text reaches this gate after flood/rate protection and FAQ-admin text interception, but before lower FAQ/AI/handoff processing.

Filter without AI/case creation:
- numbers only (`1`, `12`, `123`)
- punctuation/symbol-only input
- single-character noise
- URL-only input
- username-only input
- phone-number-only input
- repeated-character garbage
- acknowledgement-only/basic greeting/thanks with no usable school question

Filtered response:
- localized request for a more complete question
- localized `📚 Browse FAQ` button
- no AI call
- no escalation case
- no unresolved Staff Inbox escalation

Do not use length alone. Short meaningful school topics such as `fees?`, `tuition`, `admission`, `CDM`, `accreditation`, etc. must continue normally.

Bypasses:
- human-controlled conversations
- active admin/setup sessions

Implementation: `src/input_quality_entry.ts`. `src/faq_ai_entry.ts` forwards non-authoring normal text into this gate before `cases_entry.ts` and lower monitoring/AI flow.

## AI clarify vs handoff contract
`src/agent_policy.ts` now instructs the grounded AI to choose among:
- `answer` — grounded supported answer
- `clarify` — meaningful but incomplete/ambiguous/fragmentary input that needs more detail
- `handoff` — sufficiently specific meaningful School of Nursing question requiring real staff review/action because approved knowledge cannot safely answer

`clarify` must not claim staff review and must not create a case. For minimal compatibility, `parseAgentDecision()` normalizes `clarify` into the existing terminal answered-response path and prefixes the internal reason with `clarify:`.

Do not use handoff for obvious junk, standalone numbers, acknowledgement-only input, typo fragments, or messages that first need clarification.

## Spam protection contract
### Inquiry rate gate
- 10 private free-text inquiries / 10 minutes
- next inquiry triggers cooldown
- repeat hits within 24h: 30 minutes → 2 hours → 12 hours
- no automatic permanent ban
- rejected text does not call AI/create case
- blocked warning max once / 5 min
- Owner/Sudo bypass this window

### Interaction Flood Guard
- normal: 20 private interactions / 60 sec
- active cooldown/restriction/permanent ban: 6 / 60 sec
- threshold breach → 5-minute flood block
- first blocked interaction may warn; later blocked traffic silent-dropped
- Owner/Sudo bypass
- `Exempt 1h` bypasses inquiry rate only, never flood protection

## `/limits` contract
Owner/Sudo:
- `🔓 Unlock Now`
- `🧪 Exempt 1h`
- `⏳ Restrict 2h`
- `Reset Strikes`

Owner-only:
- `🚫 Permanently Ban` with confirmation
- `✅ Unban User`

## Deployment online notice retry
`src/deployment_notice_entry.ts` still atomically claims a revision before sending, preventing duplicate concurrent online notices.

New behavior:
- if at least one Owner/Sudo Telegram delivery succeeds, keep the revision claim
- if **all** Telegram deliveries fail, delete/release the revision claim
- next successful `/health` may retry that same revision
- notice failure never fails the health response

This fixes the observed case where production deploy succeeded but no `🟢 Bot is Online!` message appeared.

## Escalation Inbox contract
`/cases` remains Owner/Sudo only in private bot chat or active Staff Inbox.

`🗑 Delete Case` requires explicit permanent-delete confirmation and deletes only case + `escalation_messages`; preserve user, original question log, and linked FAQ.

The Input Quality Gate and AI clarification policy are intended to reduce typo/junk/incomplete false cases before they reach this archive.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.

Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.

Owner additionally: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.

Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations / manuals
Current migration range: `0001` through `0026`.

Newest manual migration:
- `0026_manual_false_escalation_guard.sql`

Owner/Admin manuals now explain obvious false-escalation filtering, short meaningful query exceptions, AI clarification, and the rule that real staff handoff requires a sufficiently specific actionable school question.

## Canonical Worker stack
Wrangler entrypoint: `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts` — interaction flood guard
2. `rate_limit_entry.ts` — `/limits` + inquiry rate gate
3. `faq_ai_entry.ts` — FAQ-authoring interception
4. `input_quality_entry.ts` — false-escalation filter
5. `cases_entry.ts` — `/cases`
6. lower Staff/monitoring/FAQ/AI/runtime stack

`agent_policy.ts` owns clarify-vs-handoff semantics. `deployment_notice_entry.ts` owns deploy-online retry behavior.

## Production workflow contract
`.github/workflows/deploy-production.yml` remains the sole production workflow. It must pass typecheck, migrations through `0026`, dry-run bundle, remote migrations, production deploy, binding preservation, `/health`, and exact 19-command Owner Telegram read-back.

## Next exact validation
After workflow green:
1. `1`, `123`, `...`, single emoji, URL-only, `ok` → clarification + FAQ CTA; no AI/case
2. `fees?`, `CDM?`, `admission?` → normal FAQ/AI path
3. meaningful incomplete school question → AI clarification; no case
4. specific unanswered school question → real handoff/case still works
5. human-control short replies such as `yes`/`1` are relayed, not filtered
6. active admin/setup wizard text is not filtered
7. verify `/cases` does not receive filtered junk
8. verify deploy-online notice appears for the new revision; if Telegram send fails completely, later `/health` can retry
9. recheck FAQ-first onboarding, flood guard, inquiry rate limit, `/limits`, restrict/exempt, ban/unban

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals, and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with live repository reality.
