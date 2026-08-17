# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch policy
- `test` = active development/validation
- `main` = verified canonical/production
- no direct implementation on `main`
- merge only after live test validation is green

## Locked architecture
- Telegram Bot API webhook on Cloudflare Workers + D1
- public-only `/start`; `/whoami` for every user
- role-scoped commands managed automatically by Worker `setMyCommands`
- immutable Telegram numeric IDs for authority; management UI shows name/username + ID
- D1-managed active FAQ knowledge + revision history
- deterministic FAQ → grounded Primary AI → grounded Fallback AI → Human Handoff
- AI/provider/config failure is a handoff condition, never a crash path
- Staff Inbox group or dedicated private responder
- silent shadow monitoring + alert escalation
- atomic Take Over / Return to AI
- anonymous human relay
- public repo; no plaintext credentials in source

## Phase 0 — Foundation
Status: REPO GREEN; LIVE CLOUDFLARE VALIDATION PENDING

- `/health` and `/telegram/webhook`
- D1 `school-of-nursing-faq-bot-db`
- D1 ID `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- migration 0001 live and verified
- test Worker target `school-of-nursing-faq-bot-test`
- first Worker upload was rejected before creation by Cloudflare error 10021 because compatibility date `2026-08-18` was still future in UTC; no infrastructure drift occurred

## Phase 1 — Public Telegram FAQ UX
Status: IMPLEMENTED; LIVE VALIDATION PENDING

- 22 approved FAQ records from `SCHOOL of Nursing FAQ.docx`
- Burmese facts authoritative; English + Simplified Chinese preserve meaning
- `/start` contains only public language/inquiry UX
- `/language` supported but hidden from public command menu
- D1 language persistence
- `/whoami` displays human-readable identity + immutable ID

## Phase 2 — Owner / Sudo Admin / Identity
Status: IMPLEMENTED; LIVE VALIDATION PENDING

- Owner from `BOT_OWNER_TELEGRAM_ID`
- D1 `sudo_admin` role
- `/admin`, `/admins`, Owner-only `/sudo grant|revoke`
- audit logging
- management surfaces use name/username + ID whenever metadata exists

## Phase 3 — Self-managed scoped command menus
Status: IMPLEMENTED; LIVE TELEGRAM VALIDATION PENDING

Files:
- `src/command_menu.ts`
- `src/command_sync.ts`
- `src/runtime_entry.ts`

Visibility:
- public: `/start`, `/whoami`
- Sudo Admin: public + `/admin`, `/admins`, `/faq`
- Owner: admin + `/sudo`, `/ai`, `/staff`

Command arrays are their own registry fingerprint. A registry change triggers automatic scope synchronization on the first webhook after deployment. Sudo grant/revoke refreshes the affected private scope immediately. Visibility is UX only; server-side authorization remains authoritative.

## Phase 4 — Configurable grounded AI
Status: SETTINGS + POLICY + RUNTIME IMPLEMENTED; LIVE PROVIDER VALIDATION PENDING

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
- AES-256-GCM encrypted provider credentials with `AI_CONFIG_MASTER_KEY`
- model catalog fetch
- explicit Test Ping
- bind only after successful ping
- cross-provider Primary + Fallback
- NanoGPT dual routes with shared credential
- Male/Female persona
- strict grounded policy in `src/agent_policy.ts`
- availability/fail-safe in `src/ai_fail_safe.ts`
- inference orchestration in `src/ai_runtime.ts`

Runtime order:
`Dynamic FAQ → Primary AI → Fallback AI → Human Handoff`.

Missing keys/bindings, decrypt failure, timeout, 401/403, 429, 5xx, network/provider outage, malformed model output, and removed models fail closed to human handling.

## Phase 5 — Human Staff Handoff
Status: IMPLEMENTED; LIVE VALIDATION PENDING

Migration 0003 provides:
- `bot_settings`
- `staff_members`
- `escalation_cases`
- `escalation_messages`

Routes:
- `auto`: group first, dedicated responder fallback
- `group`: Staff Inbox only
- `dedicated`: assigned private responder only

Features:
- private-delivery probe before dedicated assignment
- atomic claim
- claimant-only reply
- anonymous `School of Nursing Staff` relay
- resolve lifecycle
- D1 queue preservation + best-effort Owner warning on undelivered case

## Phase 6 — Shadow Monitoring + Conversation Takeover
Status: IMPLEMENTED; LIVE VALIDATION PENDING

Migration 0004 provides:
- `conversation_control`
- `monitoring_topics`

Modes:
- `all_alerts` recommended
- `silent_all`
- `alerts_only`
- `off`

Routine conversation traffic can mirror silently into one Staff Inbox forum topic per user. Critical handoff remains active independently. `Take Over` atomically pauses automated FAQ/AI answers; claimant answers anonymously; claimant or Owner can `Return to AI`.

## Phase 7 — Dynamic FAQ Knowledge + Telegram CRUD
Status: IMPLEMENTED + RUNTIME WIRED; LIVE D1 VALIDATION PENDING

Migration 0005 provides:
- `faq_entries`
- `faq_revisions`

Files:
- `src/faq_store.ts`
- `src/faq_admin.ts`
- `src/faq_notify.ts`
- `src/runtime_entry.ts`
- `docs/FAQ_MANAGEMENT.md`

Implemented:
- automatic seed of original 22 FAQs when dynamic table is empty
- active D1 FAQ rows drive deterministic matching
- same active D1 snapshot builds AI approved context per request
- Owner + Sudo Admin `/faq` CRUD wizard
- add/edit/disable/restore; disable is soft-delete
- revision snapshot on every mutation
- change notification to Owner + all Sudo Admins + Staff Inbox when configured
- mutation actor shown with identity + ID

Migration-aware cutover:
- migration 0005 present → dynamic FAQ + grounded AI path
- dynamic storage absent → request safely falls through to retained legacy static FAQ runtime

## Phase 8 — Repository validation + deploy artifact
Status: GREEN

Focused GitHub workflow: `.github/workflows/test-typecheck.yml`.

Validated on `test` with Node 22:
- dependency install ✅
- `npm run typecheck` ✅
- local Wrangler D1 migrations 0001 → 0005 ✅
- `wrangler deploy --dry-run --env test` ✅
- generated Worker artifact refresh ✅

Dry-run evidence:
- total upload about `182.21 KiB`
- gzip about `39.71 KiB`
- binding `DB` → `school-of-nursing-faq-bot-db`
- `APP_ENV=test`

Deployment artifact:
- `deploy/worker.mjs`
- checksum: `deploy/worker.sha256`
- current SHA-256: `2f15bd2d97ec86917741603b41eccf6c0a49f88172283ed5fc10021925cddff0`

The workflow regenerates the bundle and checksum when code/config changes. `src/entry.ts` was removed as superseded; canonical Wrangler entry is `src/runtime_entry.ts`.

## Phase 9 — Live test deployment
Status: BLOCKED ONLY ON CLOUDFLARE/TELEGRAM RUNTIME SETUP

Exact handoff: `docs/CLOUDFLARE_HANDOFF.md`.

Required next live work:
1. after Cloudflare UTC reaches compatibility date `2026-08-18`, apply migrations 0002 → 0005
2. deploy exact `deploy/worker.mjs` to `school-of-nursing-faq-bot-test`
3. verify `/health`, 404, malformed webhook, D1 binding/integrity
4. configure `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `BOT_OWNER_TELEGRAM_ID`, `AI_CONFIG_MASTER_KEY`
5. validate public UX, scoped commands, admin identity, FAQ CRUD/dynamic knowledge, AI provider flow, Primary/Fallback/fail-safe, both handoff routes, shadow monitoring, Take Over/Return to AI

Only after the live `test` checkpoint is green: merge to `main` and deploy production Worker `school-of-nursing-faq-bot`.

## Canonical content rule
Dynamic storage changes delivery, not factual authority. Active approved FAQ content is the only School-specific factual authority for deterministic answers and AI grounding. AI must never invent missing policy-sensitive facts.

## Next action
No further feature expansion is required before live validation. Preserve this checkpoint and move to the exact Cloudflare handoff when the UTC compatibility-date boundary and Cloudflare access permit it. Do not merge `main` yet.
