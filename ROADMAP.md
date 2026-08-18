# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, human handoff when automation cannot answer safely.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **FAQ-FIRST + FALSE-ESCALATION GUARD LIVE; TOKEN-ROTATION WEBHOOK CUTOVER LIVE; AI CREDENTIAL SAVE LIVE; HANDOFF USER-ACK FALLBACK IMPLEMENTED ON MAIN; PRODUCTION/LIVE HANDOFF VERIFICATION REQUIRED**.

Live-confirmed before the newest handoff slice:
- rotated Telegram bot token is working inbound and outbound
- webhook cutover is live
- `/language`, `/faq`, false-escalation filtering, and normal bot commands work
- rotated `AI_CONFIG_MASTER_KEY` is accepted after AI credential-routing hardening
- Gemini API key can be saved and AI is usable again

Observed newest issue:
- a normal user asked a meaningful unanswered School question
- AI correctly chose human handoff
- escalation case and Staff Inbox/group message were created successfully
- the normal user's private chat received no handoff acknowledgement and remained silent
- source review showed the user-facing `sendMessage` was attempted only once as a reply to the original message, while Telegram API failures are normalized to `null` and were not retried

## Handoff acknowledgement reliability fix
`src/monitoring_message_entry.ts` now uses `sendUserReplyWithFallback()` for the user-facing handoff acknowledgement:
1. try to reply directly to the original user question
2. if Telegram rejects/fails that reply-target form, immediately retry the same localized handoff copy as a plain private message
3. Staff Inbox/group escalation remains independent from this fallback

This keeps the preferred reply UX while preventing a valid escalation from leaving the user silent solely because Telegram rejected `reply_parameters`.

Design rule: once a meaningful unresolved question enters the accepted handoff path, Staff Inbox delivery must not substitute for the user-facing acknowledgement.

## AI credential-entry hardening
`src/ai_setup_entry.ts` sits directly after the inquiry-rate layer and before FAQ/other lower routing.

For an active `awaiting_ai_*` Owner session it:
- accepts only non-command setup text from configured Owner
- requires private chat for secret entry
- calls canonical `consumeAiSetupText()`
- deletes submitted secret-input messages
- sends explicit success/error feedback
- forwards all non-AI-setup traffic unchanged

Canonical top flow:
1. `interaction_guard_entry.ts`
2. `rate_limit_entry.ts`
3. `ai_setup_entry.ts`
4. `faq_ai_entry.ts`
5. `input_quality_entry.ts`
6. `cases_entry.ts`
7. lower Staff/monitoring/UX/security/runtime stack

## AI master-key contract
`AI_CONFIG_MASTER_KEY` must be Base64 for exactly 32 random bytes. Rotating it makes credentials encrypted under the previous key undecryptable. Re-enter provider API keys through `/ai` after rotation so they are encrypted under the current key.

## Telegram deployment / token rotation
Every production deploy:
1. validates/deploys Worker
2. verifies production bindings + `/health`
3. arms one-time Telegram cutover nonce in D1
4. calls `/ops/telegram/cutover`
5. current bot token + webhook secret are used for `setWebhook`
6. `getWebhookInfo` must point to `/telegram/webhook`
7. Owner command registry is set and read back exactly (19/19)

## Deployment online notice
Owner is the authoritative deploy-notice recipient. Owner delivery failure releases the revision claim for retry; Sudo delivery cannot suppress an Owner retry. Notice failure never fails production health.

## Existing product contracts
- FAQ-first `/start`/`/language` onboarding with localized Browse FAQ
- public localized `/faq`
- Owner/Sudo FAQ management and multilingual drafting
- `/cases` escalation archive
- Staff Inbox Take Over / Resolve / Return-to-AI
- `/limits` controls, progressive inquiry limits, interaction flood guard, Owner-only ban/unban
- deterministic false-escalation filter before FAQ/AI/handoff
- AI `answer | clarify | handoff` policy
- reliable localized user acknowledgement for accepted handoffs

## False escalation guard
Obvious low-information input is clarified without AI/case creation. Short meaningful school questions remain eligible for normal FAQ/AI. Human-controlled conversations and active admin/setup sessions bypass this filter.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations
Current migrations: `0001` through `0026`. No schema migration is required for the handoff acknowledgement fallback.

## Validation boundary
Do not call the newest handoff slice production-green until the triggered production workflow passes and live Telegram acceptance confirms:
1. production deploy/typecheck/health/binding preservation pass
2. Telegram webhook cutover/read-back passes
3. Owner command read-back remains 19/19
4. ask a meaningful unanswered School question from a normal user
5. Staff Inbox/group receives the escalation case
6. the user's private chat receives the localized handoff acknowledgement
7. acknowledgement should reply to the original question when possible; plain-message fallback is acceptable when reply form fails
8. `/cases` contains the same escalation without duplicate cases
9. FAQ answers, AI answers, AI setup, false-escalation filtering, limits/flood guard, and human takeover remain intact
