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
The project is main-only and production-live. FAQ-first onboarding and the deterministic false-escalation filter have been live-accepted.

The Telegram bot token was rotated in Cloudflare. The new token is confirmed valid for outbound Bot API calls because the new bot received the production-online message, but inbound commands were initially unavailable because the old production workflow did not re-register the webhook after a token rotation.

The latest deployment slice fixes that gap: `.github/workflows/deploy-production.yml` now performs an automatic nonce-gated Telegram webhook cutover + read-back after production health and before exact Owner command verification. The latest run requires live `/start` verification on the new bot before calling this cutover production-accepted.

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
- Input Quality Gate suppressing obvious junk/fragment false escalations
- AI clarify-vs-handoff policy
- retry-safe deploy-online notification
- automatic Telegram webhook cutover/read-back during production deployment
- editable Owner/Admin manuals covering current operations

## FAQ-first onboarding contract
`/start` and `/language` use the one-shot `မြန်မာ` · `English` · `简体中文` picker. After selection: persist language → delete picker → localized FAQ-first confirmation → localized `📚 Browse FAQ` button.

## False escalation / Input Quality Gate
Normal private free-text reaches this gate after flood/rate protection and FAQ-admin interception but before lower FAQ/AI/handoff processing.

Filter without AI/case creation:
- numbers only
- punctuation/symbol-only input
- single-character noise
- URL-only, username-only, or phone-number-only input
- repeated-character garbage
- acknowledgement-only/basic greeting/thanks with no usable school question

Do not use length alone. Short meaningful school topics such as `fees?`, `tuition`, `admission`, `CDM`, and `accreditation` continue normally. Human-controlled conversations and active admin/setup sessions bypass the gate.

## AI clarify vs handoff contract
Grounded AI semantics:
- `answer` — approved-grounding-supported answer
- `clarify` — meaningful but incomplete/ambiguous/fragmentary input requiring more detail; no case
- `handoff` — sufficiently specific School of Nursing question requiring real staff review/action because approved knowledge cannot safely answer

Do not use handoff for obvious junk or input that first requires clarification.

## Spam protection contract
### Inquiry rate gate
- 10 private free-text inquiries / 10 minutes
- repeat hits within 24h: 30 min → 2h → 12h
- no automatic permanent ban
- rejected text does not call AI/create case
- blocked warning max once / 5 min
- Owner/Sudo bypass

### Interaction Flood Guard
- normal: 20 private interactions / 60 sec
- active cooldown/restriction/permanent ban: 6 / 60 sec
- threshold breach → 5-minute flood block
- later blocked traffic silent-dropped
- Owner/Sudo bypass
- `Exempt 1h` never bypasses flood protection

## `/limits` contract
Owner/Sudo: Unlock Now, Exempt 1h, Restrict 2h, Reset Strikes. Owner-only: confirmed permanent ban + unban.

## Telegram deployment / token rotation contract
Production Worker exposes `/ops/telegram/cutover` in `deployment_notice_entry.ts`.

Every production deploy now:
1. validates and deploys Worker
2. resolves production origin
3. verifies `/health`
4. generates a random one-time cutover nonce
5. stores `telegram_cutover_nonce` in production D1
6. POSTs `/ops/telegram/cutover` with `X-Cutover-Nonce`
7. runtime calls Telegram `setWebhook` using the current Cloudflare `TELEGRAM_BOT_TOKEN` and `TELEGRAM_WEBHOOK_SECRET`
8. runtime verifies `getWebhookInfo` points to the production `/telegram/webhook`
9. workflow then performs the exact 19-command Owner set/read-back verification

Therefore, after future `TELEGRAM_BOT_TOKEN` rotations, running the production workflow is the canonical cutover. The webhook secret may remain unchanged unless intentionally rotated or compromised.

## Deployment online notice retry
A revision is claimed before notice delivery to avoid duplicate concurrent sends. If all Owner/Sudo Telegram sends fail, the claim is released so a later `/health` can retry. Notice failure does not fail health.

## Escalation Inbox contract
`/cases` remains Owner/Sudo only. The Input Quality Gate and AI clarification policy keep typo/junk/incomplete false cases out of this archive where possible.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations / manuals
Current migration range: `0001` through `0026`. Latest manual migration: `0026_manual_false_escalation_guard.sql`.

## Canonical Worker stack
Wrangler entrypoint: `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts`
2. `rate_limit_entry.ts`
3. `faq_ai_entry.ts`
4. `input_quality_entry.ts`
5. `cases_entry.ts`
6. lower Staff/monitoring/FAQ/AI/runtime stack

`agent_policy.ts` owns clarify-vs-handoff semantics. `deployment_notice_entry.ts` owns retry-safe online notices plus nonce-gated Telegram webhook cutover.

## Production workflow contract
`.github/workflows/deploy-production.yml` is the sole production workflow and must pass typecheck, migrations through `0026`, dry-run bundle, remote migrations, production deploy, binding preservation, `/health`, **Telegram webhook cutover/read-back**, and exact 19-command Owner Telegram read-back.

## Next exact validation
1. on the new bot, `/start` must receive a response — this proves inbound webhook delivery
2. `/language` and `/faq` must work
3. Owner command menu remains 19/19
4. filtered junk still produces clarification + FAQ CTA with no `/cases`
5. short meaningful FAQ queries still work
6. meaningful incomplete questions clarify without a case
7. specific unanswered questions still hand off

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals, and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with live repository reality.
