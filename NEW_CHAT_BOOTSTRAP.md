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
The project is main-only and production-live. FAQ-first onboarding, false-escalation filtering, the rotated Telegram bot token, and automatic webhook cutover are live-accepted.

Newest issue: after rotating `AI_CONFIG_MASTER_KEY`, Owner could open `/ai` and select Gemini but submitting a Gemini API key produced no visible response. The replacement master-key string was independently validated as Base64 decoding to exactly 32 bytes, so the newest source slice hardens AI credential-message routing rather than replacing the key again.

Newest implementation on `main`:
- new `src/ai_setup_entry.ts` consumes active Owner-private `awaiting_ai_*` text before FAQ/cases/monitoring/UX lower routing
- canonical `consumeAiSetupText()` remains the encryption/storage authority
- secret input is deleted after processing
- success/error feedback is explicit
- failure to send the setup result is no longer silently acknowledged
- `rate_limit_entry.ts` now forwards to `ai_setup_entry.ts`
- `secure_entry.ts` retains its old lower AI-setup path only as a fallback
- production deploy notice now treats Owner delivery as authoritative; Sudo delivery cannot suppress an Owner retry

Do not call this newest slice production-green until workflow + live `/ai` credential acceptance are verified.

## AI credential setup contract
`AI_CONFIG_MASTER_KEY` must be Base64 for exactly 32 random bytes.

Rotation semantics:
- credentials encrypted under the previous master key cannot be decrypted with the new master key
- after rotating the secret, re-enter each provider API key through `/ai`
- the newly submitted provider key is encrypted under the current master key and upserted into `ai_provider_credentials`

Active setup flow:
1. Owner runs `/ai` privately
2. selects provider
3. provider setup creates `awaiting_ai_*` session
4. next non-command private Owner text is intercepted by `ai_setup_entry.ts`
5. `consumeAiSetupText()` validates/encrypts/stores it
6. submitted secret message is deleted
7. bot must send an explicit success/error message
8. success offers `Fetch models`
9. model fetch decrypts with the current master key and validates provider access
10. test ping must pass before binding Primary/Fallback

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
6. `getWebhookInfo` must read back the production `/telegram/webhook`
7. exact Owner command registry verification must pass 19/19

The current new bot is already responding to commands, proving inbound webhook delivery is working after token rotation.

## Deployment online notice contract
A revision is claimed atomically. Owner is the authoritative recipient:
- Owner send success keeps the claim
- Owner send failure releases the claim for a later `/health` retry
- Sudo notifications are best-effort only after Owner success
- Sudo success cannot suppress an Owner retry
- notice failure never fails health

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
- editable manuals

## False escalation contract
Obvious junk/low-information private input is clarified without AI or case creation. Do not length-block short meaningful school topics. Human-controlled conversations and active admin/setup sessions bypass the quality gate.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations / manuals
Current migration range: `0001` through `0026`. No new migration is required for the AI routing hardening slice.

## Next exact validation
After the triggered production workflow is green:
1. confirm new `🟢 Bot is Online!` reaches Owner for the new revision
2. `/start`, `/language`, `/faq` still respond
3. Owner `/ai` → Gemini → send API key
4. submitted API-key message must disappear
5. bot must immediately return either explicit success or explicit configuration error; silence is a failure
6. on success, press `Fetch models`
7. confirm Gemini model list loads
8. select model → Test Ping → bind only after ping passes
9. verify FAQ, false-escalation, limits/flood guard, `/cases`, and Staff Inbox remain intact

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals, and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with repository/live reality.
