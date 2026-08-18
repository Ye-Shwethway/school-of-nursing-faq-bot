# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, human handoff when automation cannot answer safely.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **FAQ-FIRST + FALSE-ESCALATION GUARD LIVE; TOKEN-ROTATION WEBHOOK CUTOVER LIVE-ACCEPTED; AI CREDENTIAL-ENTRY ROUTING HARDENED ON MAIN; PRODUCTION WORKFLOW/LIVE AI SAVE VERIFICATION REQUIRED**.

Live-confirmed before the newest slice:
- new Telegram bot token is working for inbound commands after webhook cutover
- `/language`, `/faq`, and false-escalation filtering work on the new bot
- outbound Telegram Bot API calls work

Observed issue prompting the newest slice:
- after rotating `AI_CONFIG_MASTER_KEY`, Owner could enter `/ai` and choose Gemini, but submitting the Gemini API key produced no visible success/error response
- the supplied replacement master key format was independently checked as valid Base64 decoding to exactly 32 bytes
- source review showed API-key text consumption lived low in `secure_entry.ts`, below several routing layers, leaving a silent interception/return gap even though the encryption/storage function itself had explicit success/error behavior
- production online notice also had an edge case: any successful Sudo delivery could keep the revision claim even if Owner delivery failed, preventing an Owner retry

## New AI credential-entry hardening
New `src/ai_setup_entry.ts` is inserted directly after the inquiry-rate layer and before FAQ/other lower routing.

For an active `awaiting_ai_*` Owner session it:
- only accepts non-command setup text from the configured Owner
- requires private chat for API-key entry
- calls canonical `consumeAiSetupText()` from `src/ai.ts`
- deletes submitted secret-input messages
- sends explicit success/error feedback
- returns a non-2xx webhook result if the bot cannot send the setup reply, rather than silently acknowledging the update
- forwards all non-AI-setup traffic unchanged

Canonical top flow is now:
1. `interaction_guard_entry.ts`
2. `rate_limit_entry.ts`
3. `ai_setup_entry.ts`
4. `faq_ai_entry.ts`
5. `input_quality_entry.ts`
6. `cases_entry.ts`
7. lower Staff/monitoring/UX/security/runtime stack

`secure_entry.ts` retains its existing migration-safe AI setup handler as a lower fallback; active production setup text should now be consumed earlier by `ai_setup_entry.ts`.

## AI master-key contract
`AI_CONFIG_MASTER_KEY` must be Base64 for exactly 32 random bytes. Rotating it intentionally makes credentials encrypted under the previous key undecryptable. After a rotation, provider API keys must be entered and saved again through `/ai` so they are re-encrypted with the new master key.

The configured replacement key supplied during this incident was locally validated as 32 decoded bytes, so current investigation is focused on live routing/runtime rather than key-generation format.

## Deployment online notice
The Owner is now the authoritative deploy-notice recipient:
- revision is claimed atomically before sending
- Owner delivery is attempted first
- if Owner delivery fails, the revision claim is released so a later `/health` can retry
- Sudo delivery is best-effort only after Owner success
- Sudo success can no longer suppress an Owner retry
- notification failure still never fails production health

## Telegram deployment / token rotation
Every production deploy:
1. validates/deploys Worker
2. verifies production bindings + `/health`
3. arms a one-time Telegram cutover nonce in D1
4. calls `/ops/telegram/cutover`
5. current `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` are used for `setWebhook`
6. `getWebhookInfo` read-back must point to `/telegram/webhook`
7. Owner command registry is set and read back exactly (19/19)

## Existing product contracts
- FAQ-first `/start`/`/language` onboarding with localized `📚 Browse FAQ`
- public localized `/faq`
- Owner/Sudo FAQ management and multilingual drafting
- `/cases` escalation archive
- Staff Inbox Take Over / Resolve / Return-to-AI
- `/limits` controls, progressive inquiry limits, interaction flood guard, Owner-only ban/unban
- deterministic false-escalation filter before FAQ/AI/handoff
- AI `answer | clarify | handoff` policy

## False escalation guard
Obvious low-information input such as numbers-only, punctuation/symbol-only, single-character noise, URL/username/phone-only input, repeated garbage, and acknowledgement-only greetings/thanks is clarified without AI/case creation. Short meaningful school queries such as `fees?`, `CDM?`, `admission?`, and `accreditation?` continue normally. Human-controlled conversations and active setup/admin sessions bypass this filter.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations
Current migrations: `0001` through `0026`. No schema migration is required for the AI credential-routing hardening slice.

## Validation boundary
Do not call the newest slice production-green until the production workflow passes and live Telegram acceptance confirms:
1. production deploy/typecheck/health/binding preservation pass
2. Telegram webhook cutover/read-back passes
3. Owner command read-back remains 19/19
4. Owner `/ai` → Gemini → submit API key produces an explicit response
5. submitted API-key Telegram message is deleted
6. success response offers `Fetch models`
7. `Fetch models` validates the re-encrypted Gemini key and returns model choices
8. test ping succeeds before binding
9. a new revision `🟢 Bot is Online!` reaches Owner; if Owner delivery fails, later `/health` can retry
10. existing FAQ, false-escalation, rate-limit, flood-guard, cases, and Staff Inbox behavior remains intact
