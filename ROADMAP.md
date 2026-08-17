# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Canonical FAQ answers first, grounded configurable AI second, anonymous human staff handoff when automation cannot answer safely.

## Branch policy
- `test` = active development/validation
- `main` = verified canonical/production
- no direct implementation on `main`
- merge only after the current test checkpoint is green

## Locked architecture
- Telegram Bot API webhook
- Cloudflare Workers + D1
- deterministic approved FAQ matching before AI
- configurable multi-provider grounded AI fallback
- primary + fallback model binding
- strict AI output decision: `answer` or `handoff`
- silent Staff Inbox shadow monitoring with alert escalation
- conversation-level `Take Over` / `Return to AI`
- group or dedicated-staff human handoff
- atomic single-staff ownership before human reply
- anonymous staff relay to users
- Bot Owner / Sudo Admin / Staff authority separated by immutable Telegram user ID
- public repo; secrets never committed

## Phase 0 — Foundation
Status: IMPLEMENTED ON `test`; CLOUDFLARE RUNTIME VALIDATION PENDING

Completed:
- Worker routes `GET /health`, `POST /telegram/webhook`
- D1 database `school-of-nursing-faq-bot-db`
- D1 ID `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- migration 0001 live and verified
- validation Worker target `school-of-nursing-faq-bot-test`

Cloudflare note:
- first Worker upload was safely rejected with error `10021` because compatibility date `2026-08-18` was still future in Cloudflare UTC
- no Worker/binding/secret/schema drift occurred
- keep compatibility dates UTC-safe

## Phase 1 — Telegram FAQ MVP
Status: CORE IMPLEMENTED; LIVE VALIDATION PENDING

Implemented:
- 22 canonical FAQ records from `SCHOOL of Nursing FAQ.docx`
- Burmese facts authoritative
- English + Simplified Chinese meaning-preserving translations
- deterministic matcher
- `/start`, `/language`
- persisted language preference
- canonical-answer logging
- unresolved-question logging

Pending:
- matcher validation across 22 FAQs × 3 languages
- live language persistence
- live FAQ answer/logging
- EN/ZH wording review

## Phase 2 — Owner / Sudo Admin
Status: CORE IMPLEMENTED; LIVE VALIDATION PENDING

Implemented:
- Owner from `BOT_OWNER_TELEGRAM_ID`
- D1 `sudo_admin` role
- `/admin`, `/admin status`, `/admin help`, `/admins`
- Owner-only Sudo grant/revoke by Telegram user ID
- audit logging

Pending:
- live Owner config
- unauthorized-user negative tests
- live grant/revoke/list tests

## Phase 3 — Configurable grounded AI
Status: SETTINGS + POLICY CORE IMPLEMENTED; INFERENCE ORCHESTRATION PENDING

Owner-only `/ai` settings supports:
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- NanoGPT — Subscription only
- NanoGPT — Subscription + Paid/all-visible
- Custom OpenAI-compatible HTTPS endpoint

Implemented:
- encrypted provider key storage using AES-256-GCM
- Cloudflare-only master secret `AI_CONFIG_MASTER_KEY`
- best-effort deletion of Telegram API-key messages
- live model catalog fetch
- explicit model Test Ping
- bind only after successful ping
- Primary + Fallback binding, including cross-provider combinations
- NanoGPT dual catalog/ping routes with one shared encrypted credential
- Owner-selectable Male/Female AI persona
- strict system prompt in `src/agent_policy.ts`
- policy doc `docs/AI_AGENT_POLICY.md`

AI contract:
- School of Nursing scope only
- approved context is the only school-specific factual authority
- no invented policy-sensitive facts
- ambiguous/missing/current-case-specific facts → `handoff`
- malformed model output is unsafe and must not become a user answer
- persona changes style only, never facts/authority/handoff threshold

Migration 0002 adds AI settings/model tables.

Pending:
- apply migration 0002 live
- provision `AI_CONFIG_MASTER_KEY`
- live provider model-list/ping/binding tests
- actual grounded inference orchestration using Primary then Fallback

## Phase 4 — Human Staff Handoff
Status: GROUP + DEDICATED ROUTING CORE IMPLEMENTED; LIVE VALIDATION PENDING

Implemented from migration 0003:
- `bot_settings`
- `staff_members`
- `escalation_cases`
- `escalation_messages`
- handoff route `auto | group | dedicated`
- `/staff status`
- `/staff route auto|group|dedicated`
- `/staff inbox here`
- `/staff dedicated <telegram_user_id>` with private-delivery probe
- `/staff add <telegram_user_id>` / `/staff remove <telegram_user_id>`
- unresolved case routing
- atomic case claim
- claimant-only replies
- anonymous relay as `School of Nursing Staff`
- resolve action
- D1 queue preservation + Owner warning when no destination accepts delivery

## Phase 5 — Shadow Monitoring + Conversation Takeover
Status: CORE IMPLEMENTED ON `test`; LIVE TELEGRAM VALIDATION PENDING

Migration `0004_shadow_monitoring.sql` adds:
- `conversation_control`
- `monitoring_topics`
- conversation-control mode index

Implemented runtime behavior:
- recommended default monitoring mode: `all_alerts`
- Owner monitoring controls:
  - `/staff monitoring`
  - `/staff monitoring all_alerts|silent_all|alerts_only|off`
  - inline mode buttons
- `all_alerts`: routine conversation mirror is silent; handoff/risk events remain alerts
- `silent_all`: routine mirror remains silent with no extra monitoring alerts
- `alerts_only`: routine mirror disabled; critical handoff still delivered
- `off`: routine monitoring disabled; required human handoff is never disabled
- Staff Inbox forum topic attempted per Telegram user and persisted in `monitoring_topics`
- graceful fallback to Staff Inbox main chat when topic creation is unavailable
- incoming private user text mirrored in routine-monitor modes
- deterministic FAQ bot responses mirrored silently
- mirror messages expose `Take Over`
- conversation takeover stored in D1 and first successful claimant wins
- human-control mode blocks automated FAQ/AI answering for that user
- claimant can relay replies from the Staff Inbox topic anonymously
- `Return to AI` restores automation; Owner may override the claimant for return-to-AI
- case-level Take Over also moves the user's conversation into human-control mode
- resolving the current escalation returns the conversation to AI

Contract:
- human-control traffic has precedence over notification preferences; an active human takeover must not lose user follow-up merely because routine monitoring is off
- critical handoff is independent of shadow-monitoring mode
- grounded AI answers will use the same mirror/takeover path once AI inference is wired

Docs: `docs/SHADOW_MONITORING.md`.

Pending:
- apply migration 0004 live
- verify forum-topic creation against the actual Staff Inbox supergroup
- verify silent delivery (`disable_notification=true`)
- verify atomic Take Over race behavior
- verify claimant-only topic relay
- verify Return to AI
- verify monitoring modes and fallback when forum topics are unavailable

## Phase 6 — Test deployment and production promotion
Status: PLANNED

- regenerate a current bundled Worker artifact; old `deploy/worker.mjs` is stale Foundation-only code
- apply migrations 0002 + 0003 + 0004 to test D1
- deploy `school-of-nursing-faq-bot-test`
- configure minimum test secrets
- run focused runtime tests
- wire grounded Primary/Fallback AI inference through `src/agent_policy.ts`
- validate AI answer/handoff + shadow monitoring together
- merge verified checkpoint to `main`
- only then deploy production Worker `school-of-nursing-faq-bot`

## Phase 7 — Operations
Status: PLANNED

- unresolved-case review tooling
- user lookup/follow-up
- FAQ update workflow
- retention/privacy policy
- stale-case reminders/reassignment if later needed
- right-sized observability

## Canonical content rule
Burmese FAQ facts remain authoritative. EN/ZH preserve meaning. Policy-sensitive facts must never be invented or silently altered by AI.

## Next recommended slice
Finish build/type validation for the combined current source, then return to Cloudflare: apply migrations 0002–0004, deploy the current `test` Worker, and validate foundation + FAQ + admin + AI settings/persona + both human handoff routes + shadow monitoring + Take Over/Return to AI. After those runtime primitives are green, wire grounded Primary/Fallback inference before any production merge.
