# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, human handoff when automation cannot answer safely.

## Branch / deployment policy
- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- relevant `main` pushes run `.github/workflows/deploy-production.yml`.

## Current checkpoint
Status: **FAQ-FIRST + FALSE-ESCALATION GUARD LIVE; TOKEN/WEBHOOK ROTATION LIVE; AI CREDENTIAL SAVE LIVE; OWNER TAKEOVER OVERRIDE IMPLEMENTED ON MAIN; PRODUCTION/LIVE OVERRIDE VERIFICATION REQUIRED**.

Live-confirmed:
- rotated Telegram bot token works inbound/outbound
- automatic production webhook cutover works
- `/language`, `/faq`, normal commands and false-escalation filtering work
- rotated `AI_CONFIG_MASTER_KEY` works after re-saving Gemini credentials
- grounded AI is usable again

Latest operational diagnosis:
- a normal user appeared silent while Staff Inbox still received their message
- the real cause was an earlier Sudo/Admin `Take Over` left active without `Return to AI`
- while conversation mode is `human`, normal user text is intentionally relayed to Staff Inbox instead of FAQ/AI processing
- the missing control was a reliable first-class Owner override of another Admin's stale takeover plus notification to that claimant

## Owner takeover override
Core `returnConversationToAi()` already recognizes Bot Owner as higher authority than the current claimant. The latest slice makes that authority explicit and reliable at the active `Return to AI` callback boundary in `src/latest_return_entry.ts`.

When Owner presses `Return to AI` on a conversation currently claimed by another Admin:
1. read current conversation-control state
2. Owner force-returns the user to `ai` mode
3. clear the active claimant/control button state
4. send the user the localized “returned to automated assistant” notice
5. notify the previous claimant Admin privately that Owner overrode the claim
6. if direct claimant notification fails, post a fallback operational note in the Staff Inbox topic
7. post a concise Owner-override note in the Staff Inbox topic for team visibility
8. preserve case/question/user history; no deletion occurs

The previous claimant may Take Over again later if human handling is still needed.

## Handoff acknowledgement reliability
`src/monitoring_message_entry.ts` also keeps the user-facing handoff acknowledgement resilient: reply to the original question first, then retry as a plain private message if Telegram rejects the reply-target form. Staff Inbox success must not substitute for user-facing acknowledgement during an actual AI→human escalation.

## AI credential-entry hardening
`src/ai_setup_entry.ts` intercepts active Owner-private `awaiting_ai_*` setup text before lower routing. Provider keys are encrypted by canonical `consumeAiSetupText()`, secret messages are deleted, and explicit success/error feedback is required.

## Canonical Worker stack
Wrangler entrypoint remains `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts`
2. `rate_limit_entry.ts`
3. `ai_setup_entry.ts`
4. `faq_ai_entry.ts`
5. `input_quality_entry.ts`
6. `cases_entry.ts`
7. Staff/manual/deploy/latest-return/monitoring/UX/security/runtime layers

`latest_return_entry.ts` owns latest Return-to-AI button cleanup and the explicit Owner override path.

## Existing product contracts
- FAQ-first `/start`/`/language` onboarding with localized Browse FAQ
- public localized `/faq`
- Owner/Sudo FAQ management + multilingual AI-assisted drafting
- `/cases` escalation archive
- Staff Inbox Take Over / Resolve / Return-to-AI
- Owner override of stale Admin takeover
- `/limits`, progressive inquiry rate limit, Interaction Flood Guard, Owner-only ban/unban
- deterministic Input Quality Gate
- grounded AI `answer | clarify | handoff`
- reliable handoff acknowledgement fallback
- editable Owner/Admin manuals

## Human-control authority
- Sudo/Admin may Take Over an AI conversation.
- While human mode is active, user messages relay to Staff Inbox and AI must stay out.
- Active claimant may Return to AI.
- Bot Owner may Return to AI regardless of claimant identity.
- Owner override must notify the displaced claimant and visibly record the transition in Staff Inbox.
- Owner override does not resolve/delete historical cases automatically.

## Telegram deployment / token rotation
Every production deploy validates/deploys Worker, checks bindings + `/health`, performs nonce-gated `setWebhook` cutover/read-back using current bot token/webhook secret, then verifies exact Owner command registry 19/19.

## Deployment online notice
Owner is the authoritative deploy-notice recipient. Owner delivery failure releases the revision claim for retry; Sudo success cannot suppress an Owner retry. Notice failure never fails health.

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations
Current migrations: `0001` through `0027`.

Newest migration:
- `0027_manual_owner_takeover_override.sql` — documents Owner override semantics for Owner/Admin manuals

## Validation boundary
Do not call the newest Owner-override slice production-green until the production workflow passes and live Telegram acceptance confirms:
1. Sudo/Admin takes over a normal user
2. user messages are relayed under human control
3. without the claimant returning control, Bot Owner presses `Return to AI`
4. Owner action succeeds even though another Admin is claimant
5. user receives localized AI-return notice
6. previous claimant receives private override notification, or Staff Inbox fallback note if private DM is unavailable
7. Staff Inbox topic shows the Owner-override transition
8. next normal-user question proceeds through FAQ/AI again rather than remaining trapped in human mode
9. case/question history remains intact
10. existing FAQ, AI, handoff, limits/flood guard and manuals remain operational
