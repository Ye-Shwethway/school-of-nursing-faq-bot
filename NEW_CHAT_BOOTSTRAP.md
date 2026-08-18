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

Latest diagnosed issue was not an AI/handoff failure: a Sudo/Admin had previously pressed `Take Over` for a normal user and never returned the conversation to AI. While `conversation_control.mode='human'`, later user text is intentionally relayed to Staff Inbox and does not enter FAQ/AI. The missing operational control was a reliable Bot Owner override of another Admin's stale takeover plus claimant notification.

Newest implementation on `main`:
- `src/latest_return_entry.ts` explicitly intercepts Owner `conv:return:<user_id>` when another Admin is the active claimant
- uses canonical `returnConversationToAi()` to force AI mode
- cleans latest Return-to-AI button state
- sends localized AI-return notice to the user
- notifies the displaced claimant Admin privately
- if claimant DM fails, sends a fallback note in the Staff Inbox topic
- also records a concise Owner-override note in the Staff Inbox topic
- case/question/user history is preserved
- migration `0027_manual_owner_takeover_override.sql` documents the rule in Owner/Admin manuals

Do not call this newest override slice production-green until workflow + live Owner-override acceptance are verified.

## Human-control authority contract
- Sudo/Admin may Take Over a conversation.
- Human mode suppresses normal FAQ/AI handling for that user and relays their text to Staff Inbox.
- The active claimant may Return to AI.
- Bot Owner is higher authority than any claimant and may force Return to AI regardless of who claimed the conversation.
- Owner override must clear the active human claim and notify the previous claimant.
- Owner override must tell the user the automated assistant is active again.
- Owner override must be visible to staff even if the claimant cannot receive a private bot DM.
- Historical case/question/user records are not deleted by returning control to AI.

## Handoff acknowledgement contract
For a real AI→human escalation, user acknowledgement remains reply-first with plain-private-message fallback if Telegram rejects reply targeting. Staff Inbox success does not substitute for user-facing acknowledgement.

## AI credential setup contract
`AI_CONFIG_MASTER_KEY` is Base64 for exactly 32 random bytes. After rotation, provider keys encrypted under the old key must be entered again through `/ai`. `ai_setup_entry.ts` intercepts Owner-private credential text early, deletes secret messages and requires explicit success/error feedback. Gemini save + AI use are live-accepted.

## Canonical Worker stack
Wrangler entrypoint: `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts` — private Interaction Flood Guard
2. `rate_limit_entry.ts` — `/limits` + inquiry rate gate
3. `ai_setup_entry.ts` — Owner-private AI setup text
4. `faq_ai_entry.ts` — FAQ authoring
5. `input_quality_entry.ts` — deterministic false-escalation filter
6. `cases_entry.ts` — `/cases`
7. lower Staff/manual/deploy/latest-return/monitoring/UX/security/runtime stack

`latest_return_entry.ts` owns latest Return-to-AI button movement/cleanup and explicit Owner override handling.

## Telegram deployment / token rotation contract
Every production deploy:
1. deploy Worker
2. verify production bindings + `/health`
3. arm one-time Telegram cutover nonce
4. call `/ops/telegram/cutover`
5. run Telegram `setWebhook` with current bot token + webhook secret
6. verify `getWebhookInfo` points to production `/telegram/webhook`
7. verify exact Owner command registry 19/19

## Deployment online notice contract
Owner is the authoritative recipient. Owner send failure releases the revision claim for later `/health` retry. Sudo success cannot suppress an Owner retry. Notice failure never fails health.

## Existing product surfaces
- multilingual deterministic/dynamic FAQ
- public role-aware `/faq`
- FAQ-first `/start`/`/language`
- Owner/Sudo FAQ management + multilingual AI-assisted drafting
- `/cases` escalation archive
- Staff Inbox Take Over / Resolve / Return-to-AI
- Owner override of stale Admin Take Over
- `/limits`, progressive inquiry limits, Interaction Flood Guard
- Owner-only permanent ban/unban
- Input Quality Gate + AI clarify-vs-handoff policy
- editable manuals

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations / manuals
Current migration range: `0001` through `0027`.
Newest migration: `0027_manual_owner_takeover_override.sql`.

## Next exact validation
After production workflow green:
1. Sudo/Admin Take Over a normal user
2. confirm user text relays under human mode
3. leave claimant active
4. Bot Owner presses `Return to AI`
5. Owner override must succeed despite different claimant
6. user receives localized automated-assistant-return notice
7. displaced Admin receives private notification; if bot cannot DM them, Staff Inbox fallback note appears
8. Staff Inbox topic shows concise Owner override transition
9. next user question enters normal FAQ/AI again
10. case/question history remains unchanged

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals, and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with live repository reality.
