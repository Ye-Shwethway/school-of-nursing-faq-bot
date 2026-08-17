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
- public `/start` landing with no privileged controls mixed into the user UI
- role-scoped Telegram command menus managed by the bot through `setMyCommands`
- immutable Telegram user ID for Owner/Admin/Staff authority; management UI shows name + username + ID together
- deterministic approved FAQ matching before AI
- D1-managed dynamic FAQ knowledge with revision history
- configurable multi-provider grounded AI fallback with Primary + Fallback binding
- AI fail-safe: unavailable/failing AI becomes a human-handoff condition, never a crash path
- silent Staff Inbox shadow monitoring with alert escalation
- conversation-level `Take Over` / `Return to AI`
- group or dedicated-staff human handoff
- atomic single-staff ownership before human reply
- anonymous staff relay to users
- public repo; secrets never committed

## Phase 0 — Foundation
Status: IMPLEMENTED ON `test`; CLOUDFLARE RUNTIME VALIDATION PENDING

- Worker routes `GET /health`, `POST /telegram/webhook`
- D1 database `school-of-nursing-faq-bot-db`
- D1 ID `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- migration 0001 live and verified
- validation Worker target `school-of-nursing-faq-bot-test`
- first Worker upload was safely rejected with Cloudflare error `10021` because compatibility date `2026-08-18` was still future in Cloudflare UTC; no infrastructure drift occurred

## Phase 1 — Telegram FAQ MVP
Status: CORE IMPLEMENTED; LIVE VALIDATION PENDING

- original 22 FAQ records from `SCHOOL of Nursing FAQ.docx`
- Burmese facts authoritative; EN/ZH translation layers
- deterministic matcher
- `/start` language selector and hidden compatibility `/language`
- D1 language persistence
- canonical answer/unresolved logging

## Phase 2 — Owner / Sudo Admin + Identity
Status: CORE IMPLEMENTED; LIVE VALIDATION PENDING

- Owner from `BOT_OWNER_TELEGRAM_ID`
- D1 `sudo_admin` role
- `/admin`, `/admin status`, `/admin help`, `/admins`
- Owner-only `/sudo grant <id>` / `/sudo revoke <id>`
- audit logging
- `/whoami` available to every private user
- canonical identity format: `Name (@username) — ID: <numeric id>`
- `/admins` and grant/revoke confirmations use stored human identity + immutable ID rather than bare IDs when metadata exists

## Phase 3 — Dynamic role-scoped command menus
Status: CORE IMPLEMENTED ON `test`; LIVE TELEGRAM VALIDATION PENDING

Runtime entrypoint: `src/entry.ts`.

- public users see only `/start` and `/whoami`
- current Sudo Admin menu adds `/admin`, `/admins`
- current Owner menu additionally adds `/sudo`, `/ai`, `/staff`
- `/language` remains functional but hidden from the public command menu
- command definitions live in `src/command_menu.ts`
- command fingerprint is derived from the registry itself; adding/removing a registered command automatically changes the fingerprint
- first webhook after a changed deployment syncs public, Owner, and all current Sudo Admin command scopes via Telegram `setMyCommands`
- `/start` and `/whoami` self-heal the caller's private command scope
- Sudo grant/revoke immediately refreshes the target user's private command scope
- command-menu sync is best-effort/non-fatal; server-side authorization remains authoritative
- `wrangler.jsonc` now uses `src/entry.ts` as the Worker entrypoint

Docs: `docs/COMMANDS_AND_IDENTITY.md`.

## Phase 4 — Configurable grounded AI
Status: SETTINGS + POLICY + FAIL-SAFE CORE IMPLEMENTED; INFERENCE ORCHESTRATION PENDING

Owner-only `/ai` supports:
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- NanoGPT Subscription only
- NanoGPT Subscription + Paid/all-visible
- Custom OpenAI-compatible HTTPS endpoint

Implemented:
- encrypted API-key storage using AES-256-GCM and Cloudflare-only `AI_CONFIG_MASTER_KEY`
- model catalog fetch + Test Ping + Primary/Fallback binding
- NanoGPT dual catalog/ping routes with one shared credential
- Owner-selectable Male/Female persona
- strict grounded system prompt in `src/agent_policy.ts`
- AI fail-safe contract in `src/ai_fail_safe.ts` / `docs/AI_FAIL_SAFE.md`

Fail-safe order:
`deterministic FAQ → AI readiness → Primary → Fallback → Human Handoff`.

Missing key/binding, decrypt failure, timeout, provider/network error, rate limit, malformed output, or both model failures must never crash the user flow.

## Phase 5 — Human Staff Handoff
Status: GROUP + DEDICATED ROUTING CORE IMPLEMENTED; LIVE VALIDATION PENDING

Migration 0003:
- `bot_settings`
- `staff_members`
- `escalation_cases`
- `escalation_messages`

Routing:
- `auto`: Staff Inbox group first, dedicated staff fallback
- `group`: Staff Inbox only
- `dedicated`: assigned private responder only

Core behavior:
- private-delivery probe before dedicated assignment
- atomic case claim
- claimant-only anonymous reply as `School of Nursing Staff`
- resolve action
- undelivered cases remain queued in D1 and trigger best-effort Owner warning

## Phase 6 — Shadow Monitoring + Conversation Takeover
Status: CORE IMPLEMENTED; LIVE VALIDATION PENDING

Migration 0004:
- `conversation_control`
- `monitoring_topics`

Modes:
- `all_alerts` (recommended default)
- `silent_all`
- `alerts_only`
- `off`

Behavior:
- routine user/bot traffic can mirror silently to Staff Inbox forum topics
- critical handoff remains active regardless of routine monitoring mode
- `Take Over` atomically moves a user conversation to human control
- automated answers stop while human control is active
- claimant replies anonymously
- claimant or Owner can `Return to AI`

Docs: `docs/SHADOW_MONITORING.md`.

## Phase 7 — Dynamic FAQ Management
Status: D1 STORE + CRUD UI CORE IMPLEMENTED; LIVE CUTOVER PENDING

Migration 0005:
- live FAQ entries
- FAQ revision history

Implemented modules:
- `src/faq_store.ts`
- `src/faq_admin.ts`
- `src/faq_notify.ts`
- `docs/FAQ_MANAGEMENT.md`

Design:
- Owner + Sudo Admin CRUD from Telegram
- add/edit/disable/restore; disable is soft-delete
- every mutation creates a revision snapshot
- mutation notification fan-out to Owner, all Sudo Admins, and Staff Inbox group when configured
- active D1 FAQ snapshot will become the shared source for deterministic matching and AI approved context

Current safety boundary:
- migration 0005 is not live yet
- `src/index.ts` still uses the original hard-coded FAQ matcher
- `/faq` is intentionally not exposed in the command registry until the D1 migration + runtime source switch are complete
- after cutover, adding `/faq` to the Admin registry will make it appear automatically without BotFather

## Phase 8 — Test deployment and production promotion
Status: PLANNED

Before test deployment:
- build/type validate current combined source
- regenerate current bundled Worker artifact; old `deploy/worker.mjs` is stale
- apply migrations 0002–0005 to test D1 in order
- seed/verify the 22 canonical FAQs into migration 0005 storage before dynamic FAQ cutover
- wire deterministic matcher + AI grounding to D1 FAQ source
- expose `/faq` only after that cutover is green

Then:
- deploy `school-of-nursing-faq-bot-test`
- configure minimum test secrets
- validate command scopes, `/whoami`, identity display, FAQ flow, Admin/Owner controls, AI settings/fail-safe, human handoff, monitoring, CRUD notifications, and dynamic knowledge
- wire grounded Primary/Fallback inference through `src/agent_policy.ts`
- merge verified checkpoint to `main`
- only then deploy production Worker `school-of-nursing-faq-bot`

## Canonical content rule
Policy-sensitive School of Nursing facts must never be invented or silently altered. Dynamic FAQ management changes the storage mechanism, not the authority rule: approved active FAQ content remains the only school-specific factual source for deterministic answers and AI grounding.

## Next recommended slice
Complete dynamic FAQ cutover safely: prepare migration-0005 seed data for the existing 22 FAQs, switch deterministic matching and AI approved-context construction to active D1 FAQ rows with a safe fallback during migration, wire `/faq` callbacks/text sessions + mutation notifications into the runtime, then expose `/faq` in the Admin/Owner command registry. After that, build/type validate and move to Cloudflare test deployment.
