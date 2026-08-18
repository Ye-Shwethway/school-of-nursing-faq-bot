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
The project is main-only and production-live. FAQ-first onboarding, false-escalation filtering, rotated Telegram bot token + automatic webhook cutover, and rotated AI master-key credential save are live-accepted.

Newest observed issue: normal-user questions that correctly escalated to Staff Inbox could leave the user's private chat silent. Live evidence showed case/group delivery succeeded, including escalation reason and `BOT · Human handoff`, while no localized handoff acknowledgement appeared in the user chat.

Newest implementation on `main`:
- `src/monitoring_message_entry.ts` now sends the user-facing handoff acknowledgement with reply-first + plain-message fallback
- preferred path remains a reply to the original question
- if Telegram rejects/fails the reply-target form, the same localized acknowledgement is retried as a plain private message
- Staff Inbox delivery remains independent; group success no longer counts as sufficient user-facing UX
- `docs/TELEGRAM_DESIGN_RULES.md` now explicitly requires reliable handoff acknowledgement

Do not call this newest handoff slice production-green until workflow + live normal-user handoff acceptance are verified.

## Handoff acknowledgement contract
For a meaningful unresolved School question that enters human handoff:
1. question is logged pending
2. escalation case is created and routed to Staff Inbox
3. normal user must receive localized handoff acknowledgement in private chat
4. first attempt should reply to the original question
5. if reply-target delivery fails, retry immediately as a plain private message
6. Staff Inbox/topic/mirroring success must never substitute for this user-facing acknowledgement
7. do not create a duplicate case solely to retry the user message

## AI credential setup contract
`AI_CONFIG_MASTER_KEY` must be Base64 for exactly 32 random bytes. Credentials encrypted under an old master key cannot be decrypted after rotation; provider API keys must be entered again through `/ai`.

Active setup flow:
1. Owner runs `/ai` privately
2. selects provider
3. `awaiting_ai_*` session is created
4. `ai_setup_entry.ts` intercepts the next non-command Owner-private text
5. canonical `consumeAiSetupText()` encrypts/stores it
6. secret input message is deleted
7. explicit success/error is returned
8. Fetch models → Test Ping → bind

This flow is now live-accepted for Gemini after the master-key rotation.

## Canonical Worker stack
Wrangler entrypoint: `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts` — private interaction flood guard
2. `rate_limit_entry.ts` — `/limits` + normal-user inquiry rate gate
3. `ai_setup_entry.ts` — Owner-private AI credential setup interception
4. `faq_ai_entry.ts` — FAQ-authoring interception
5. `input_quality_entry.ts` — deterministic false-escalation filter
6. `cases_entry.ts` — `/cases`
7. lower Staff/manual/deploy/monitoring/UX/security/runtime stack

## Telegram deployment / token rotation contract
Every production deploy:
1. deploy Worker
2. verify bindings and `/health`
3. arm one-time `telegram_cutover_nonce`
4. call `/ops/telegram/cutover`
5. runtime calls Telegram `setWebhook` with current bot token + webhook secret
6. `getWebhookInfo` must read back production `/telegram/webhook`
7. exact Owner command registry verification must pass 19/19

The current new bot is already responding to commands, proving inbound webhook delivery is working after token rotation.

## Deployment online notice contract
Owner is the authoritative recipient. Owner send failure releases the revision claim for later `/health` retry. Sudo success cannot suppress an Owner retry. Notice failure never fails health.

## Existing product surfaces
- multilingual deterministic/dynamic FAQ
- public role-aware `/faq`
- FAQ-first `/start`/`/language` onboarding
- Owner/Sudo FAQ management + multilingual AI-assisted drafts
- `/cases` escalation archive
- Staff Inbox human takeover/resolve/return-to-AI
- `/limits`, progressive inquiry limits, interaction flood protection
- Owner-only permanent ban/unban
- deterministic Input Quality Gate
- AI clarify-vs-handoff policy
- reliable handoff acknowledgement fallback
- editable manuals

## False escalation contract
Obvious junk/low-information private input is clarified without AI or case creation. Do not length-block short meaningful school topics. Human-controlled conversations and active admin/setup sessions bypass the quality gate.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations / manuals
Current migration range: `0001` through `0026`. No migration is required for the handoff acknowledgement fallback.

## Next exact validation
After the triggered production workflow is green:
1. normal user asks a meaningful School question not covered by approved context
2. Staff Inbox/group receives one escalation case with the correct reason
3. user private chat receives the localized handoff acknowledgement
4. preferred: acknowledgement replies to the original question
5. acceptable fallback: same acknowledgement arrives as a plain private message if reply targeting fails
6. `/cases` contains one case only; no duplicate due to acknowledgement retry
7. FAQ answers and grounded AI answers still reply normally
8. AI setup remains usable
9. false-escalation, inquiry-limit/flood guard, staff takeover, and manuals remain intact

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals, and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with repository/live reality.
