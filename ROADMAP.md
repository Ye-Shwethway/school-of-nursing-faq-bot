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
- human handoff supports private Staff Inbox group and dedicated private staff responder
- atomic single-staff claim before reply
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
- no invented dates, fees, accreditation, eligibility, policy, links, schedules, scholarships/loans/bonds, addresses, or exceptions
- ambiguous/missing/current-case-specific facts → `handoff`
- malformed model output is unsafe and must not become a user answer
- persona changes style only, never facts/authority/handoff threshold

Migration 0002 adds AI settings/model tables.

Pending:
- apply migration 0002 live
- provision `AI_CONFIG_MASTER_KEY`
- live provider model-list/ping/binding tests
- actual grounded inference orchestration using Primary then Fallback
- fallback-to-human semantics when both models fail or cannot ground an answer

## Phase 4 — Human Staff Handoff
Status: GROUP + DEDICATED ROUTING CORE IMPLEMENTED ON `test`; LIVE VALIDATION PENDING

Implemented:
- migration `0003_handoff_persona.sql`
- `bot_settings`
- `staff_members`
- `escalation_cases`
- `escalation_messages`
- Owner-selectable handoff route:
  - `auto` — group first, dedicated staff fallback
  - `group` — Staff Inbox only
  - `dedicated` — assigned staff private chat only
- `/staff status`
- `/staff route auto|group|dedicated`
- `/staff inbox here`
- `/staff dedicated <telegram_user_id>`
- `/staff add <telegram_user_id>`
- `/staff remove <telegram_user_id>`
- dedicated staff private-delivery probe before assignment is saved
- unresolved case creation and routing
- `Take Over` button
- atomic claim: only first authorized staff member can own a case
- claimant-only replies
- anonymous relay to user as `School of Nursing Staff`
- `Resolve` action
- user/staff relay audit rows
- undelivered cases remain queued in D1 and trigger a best-effort Owner warning

Dedicated staff requirement:
- Telegram bot must already be able to reach the staff member privately
- staff must open the bot and send `/start` before Owner assignment if the bot has never had a private chat with them

Recommended multi-staff topology:
- private Staff Inbox supergroup
- if no group is used, dedicated staff routing is a full second workflow
- `auto` is the recommended default

Concurrency rule:
- D1 `UPDATE ... WHERE status='open' AND claimed_by IS NULL`
- first successful update wins
- later staff receive `Already claimed`
- non-claimants cannot reply while the case is claimed

Current temporary behavior:
- until grounded AI runtime is wired, deterministic no-match creates a human escalation directly
- after AI inference is wired, case creation moves behind `AgentDecision.action === 'handoff'`

Pending:
- apply migration 0003 live
- live Staff Inbox route test
- live dedicated-staff private route test
- multi-staff atomic claim race test
- anonymous reply/resolve test
- monitoring mode implementation: silent conversation mirror + alert escalation + Take Over/Return to AI
- optional claim release/Owner override

## Phase 5 — Production deployment
Status: PLANNED

- regenerate a current bundled Worker artifact; old `deploy/worker.mjs` is stale Foundation-only code
- apply migrations 0002 + 0003 to test D1
- deploy `school-of-nursing-faq-bot-test`
- configure minimum test secrets
- run focused runtime tests
- merge verified checkpoint to `main`
- only then deploy production Worker `school-of-nursing-faq-bot`

## Phase 6 — Operations
Status: PLANNED

- silent shadow monitoring / alert modes
- unresolved-case review tooling
- user lookup/follow-up
- FAQ update workflow
- retention/privacy policy
- stale-case reminders/reassignment if later needed
- right-sized observability

## Canonical content rule
Burmese FAQ facts remain authoritative. EN/ZH preserve meaning. Policy-sensitive facts must never be invented or silently altered by AI.

## Next recommended slice
Validate/build the combined current source, apply migrations 0002 and 0003 in Cloudflare, deploy the current `test` Worker, then validate health, FAQ flow, Owner/Sudo controls, AI settings/persona, both human handoff routes, atomic claim, and anonymous staff reply. Then wire grounded Primary/Fallback AI inference plus silent shadow monitoring/alert escalation before any production merge.
