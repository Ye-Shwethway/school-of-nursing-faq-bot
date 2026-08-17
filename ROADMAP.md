# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch policy
- `test` = active development/validation
- `main` = verified canonical/production
- no direct implementation on `main`
- merge only after the current test checkpoint is green

## Locked architecture
- Telegram Bot API webhook
- Cloudflare Workers + D1
- public-only `/start` landing
- `/whoami` for every user
- role-scoped command menus managed by Worker `setMyCommands`; no recurring BotFather command maintenance
- immutable Telegram numeric IDs for authority; management surfaces display name/username + ID together
- D1-managed active FAQ knowledge with revision history
- deterministic FAQ lookup before AI
- configurable multi-provider grounded AI with Primary + Fallback
- AI failures are human-handoff conditions, never crash paths
- human routing supports Staff Inbox group and dedicated private responder
- silent shadow monitoring + alert escalation
- atomic conversation/case Take Over and anonymous staff relay
- public repo; credentials only in Cloudflare/secure encrypted storage

## Phase 0 — Foundation
Status: IMPLEMENTED ON `test`; CLOUDFLARE RUNTIME VALIDATION PENDING

- Worker routes: `GET /health`, `POST /telegram/webhook`
- D1: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- migration 0001 is live and verified
- test Worker target: `school-of-nursing-faq-bot-test`
- first upload was rejected before creation by Cloudflare error 10021 because compatibility date 2026-08-18 was still future in UTC; no infrastructure drift occurred

## Phase 1 — Public Telegram FAQ UX
Status: CORE IMPLEMENTED; LIVE VALIDATION PENDING

- 22 approved FAQs from `SCHOOL of Nursing FAQ.docx`
- Burmese facts authoritative; English + Simplified Chinese preserve meaning
- `/start` shows public language/inquiry UX only
- `/language` remains supported but hidden from the command menu
- user language persists in D1
- `/whoami` returns human-readable Telegram identity + immutable ID

## Phase 2 — Owner / Sudo Admin / Identity
Status: CORE IMPLEMENTED; LIVE VALIDATION PENDING

- Owner from `BOT_OWNER_TELEGRAM_ID`
- D1 `sudo_admin` role
- `/admin`, `/admins`, Owner-only `/sudo grant|revoke`
- privileged mutations audited
- `/admins`, grant/revoke confirmations, staff status/claim output, and FAQ-change notifications use name/username + ID when metadata exists

## Phase 3 — Self-managed scoped command menus
Status: IMPLEMENTED; LIVE TELEGRAM VALIDATION PENDING

Modules:
- `src/command_menu.ts`
- `src/command_sync.ts`
- `src/runtime_entry.ts`

Visibility:
- public: `/start`, `/whoami`
- Sudo Admin: public + `/admin`, `/admins`, `/faq`
- Owner: admin + `/sudo`, `/ai`, `/staff`

Command registry content is its own fingerprint. A registry change causes the first webhook after deployment to synchronize public, Owner, and current Sudo Admin command scopes through Telegram `setMyCommands`. Sudo grant/revoke also refreshes the affected private scope. Sync failures are best-effort and must not block bot runtime.

## Phase 4 — Configurable grounded AI
Status: SETTINGS + POLICY + RUNTIME ORCHESTRATION IMPLEMENTED; LIVE PROVIDER VALIDATION PENDING

Owner-only `/ai` supports:
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- NanoGPT Subscription only
- NanoGPT Subscription + Paid/all-visible
- Custom OpenAI-compatible HTTPS

Implemented:
- AES-256-GCM encrypted provider credentials using Cloudflare-only `AI_CONFIG_MASTER_KEY`
- provider model fetch
- explicit Test Ping
- bind only after successful ping
- cross-provider Primary + Fallback
- NanoGPT dual catalog/inference routes with shared encrypted credential
- Male/Female AI persona
- strict grounded policy: `src/agent_policy.ts`
- availability/fail-safe contract: `src/ai_fail_safe.ts`
- runtime inference: `src/ai_runtime.ts`

Runtime order:
`Dynamic deterministic FAQ → Primary AI → Fallback AI → Human Handoff`.

A safe Primary answer is returned immediately. Primary failure or handoff may try the configured Fallback. If neither produces a valid grounded answer, the user is routed to humans. Missing bindings/keys, decrypt failures, timeout, auth/rate-limit/provider/network errors, malformed model JSON, and model removals are fail-closed for automated answering.

## Phase 5 — Human Staff Handoff
Status: CORE IMPLEMENTED; LIVE VALIDATION PENDING

Migration 0003:
- `bot_settings`
- `staff_members`
- `escalation_cases`
- `escalation_messages`

Routing:
- `auto`: group first, dedicated responder fallback
- `group`: Staff Inbox only
- `dedicated`: assigned responder private chat only

Features:
- dedicated private-delivery probe before assignment
- atomic case claim
- claimant-only reply
- anonymous relay as `School of Nursing Staff`
- resolve action
- D1 queue preservation and best-effort Owner warning when staff notification cannot be delivered
- staff status and claim surfaces show stored human identity + immutable ID

## Phase 6 — Shadow Monitoring + Conversation Takeover
Status: CORE IMPLEMENTED; LIVE VALIDATION PENDING

Migration 0004:
- `conversation_control`
- `monitoring_topics`

Modes:
- `all_alerts` recommended default
- `silent_all`
- `alerts_only`
- `off`

Routine user/assistant traffic can mirror silently into one Staff Inbox forum topic per user. Critical handoff is independent of routine monitoring. `Take Over` atomically moves a conversation into human control; automated FAQ/AI answers stop. Claimant replies anonymously and claimant/Owner can `Return to AI`.

## Phase 7 — Dynamic FAQ Knowledge + Telegram CRUD
Status: RUNTIME WIRED ON `test`; LIVE D1 VALIDATION PENDING

Migration 0005:
- `faq_entries`
- `faq_revisions`

Modules:
- `src/faq_store.ts`
- `src/faq_admin.ts`
- `src/faq_notify.ts`
- `src/runtime_entry.ts`
- `docs/FAQ_MANAGEMENT.md`

Implemented:
- automatic seed of the original 22 approved FAQs when the dynamic FAQ table is empty
- active D1 FAQ rows are deterministic lookup source
- same active D1 snapshot builds AI approved context on each user request
- Owner + Sudo Admin `/faq` CRUD wizard
- add/edit/disable/restore; disable is soft-delete
- revision snapshot on every mutation
- mutation notification to Owner + all Sudo Admins + Staff Inbox group when configured
- notification actor displayed by name/username + ID
- `/faq` now appears automatically in Admin/Owner scoped command menus

Migration-aware cutover behavior:
- if migration 0005 is present, `src/runtime_entry.ts` uses the dynamic FAQ + AI path
- if dynamic FAQ storage is absent during a transitional deployment, the request falls through to the legacy `src/index.ts` static FAQ path instead of crashing

## Phase 8 — Focused validation and test deployment
Status: IN PROGRESS

Focused GitHub Actions workflow:
- `.github/workflows/test-typecheck.yml`
- Node 22
- install dependencies
- `npm run typecheck`
- push-to-`test` only; no deployment mutation

Local clone/install remains unavailable in the current assistant environment because DNS cannot resolve `github.com`, so GitHub Actions is the canonical remote typecheck surface for now.

Before Cloudflare deployment:
- get latest typecheck green
- replace/remove stale Foundation-only `deploy/worker.mjs` with a current build artifact strategy
- apply migrations 0002 → 0003 → 0004 → 0005 in order
- verify 22 FAQ seed + revision tables
- provision minimum test secrets
- deploy `school-of-nursing-faq-bot-test`

Live validation then covers:
- `/health`, webhook secret and malformed webhook
- `/start`, language persistence, `/whoami`
- role-scoped commands and Sudo scope refresh
- FAQ CRUD/revisions/change fan-out/dynamic answer updates
- AI provider fetch/ping/binding/persona
- Primary/Fallback/fail-safe/handoff
- group and dedicated staff routing
- monitoring topics, silent mirrors, Take Over, anonymous reply, Return to AI

Only after the `test` checkpoint is green: merge to `main` and deploy `school-of-nursing-faq-bot` production.

## Canonical content rule
Dynamic storage changes the delivery mechanism, not factual authority. Active approved FAQ content is the only School-specific factual authority for deterministic answers and AI grounding. AI must never invent missing policy-sensitive facts.

## Next recommended slice
Resolve the focused typecheck to green. Then prepare an exact Cloudflare handoff for migrations 0002–0005 + current `src/runtime_entry.ts` Worker deployment and live Telegram validation. Do not merge `main` before that evidence is green.
