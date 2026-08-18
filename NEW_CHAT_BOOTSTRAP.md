# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Development branch: `test`
Canonical branch: `main`

## Startup sequence
Read in order:
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. task-relevant source/docs only

Treat live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Branch contract
- work on `test`
- do not implement directly on `main`
- TEST Worker: `school-of-nursing-faq-bot-test`
- production Worker only after validated merge: `school-of-nursing-faq-bot`

## Current verified runtime checkpoint
The Creator manually completed the TEST deployment/configuration path and verified the important live flow:

`FAQ miss → Gemini grounded agent → Telegram reply`

The earlier API-key routing bug was fixed by `src/secure_entry.ts`: pending Owner AI setup input is consumed before normal question/handoff routing, API-key messages are deleted best-effort, and provider credentials are encrypted before D1 storage.

`main` is not promoted yet.

## Current canonical Worker stack
Wrangler entrypoint:

`src/ux_entry.ts`

Layer order:
1. `ux_entry.ts` — Telegram UX Polish v1, transient reset/cancel semantics, AI generation guard
2. `secure_entry.ts` — AI secret/setup safety guard
3. `runtime_entry.ts` — dynamic FAQ/grounded AI/command integration
4. `index.ts` — retained legacy/migration-transition application fallback

Do not bypass this order when producing the Worker artifact.

## Telegram UX Polish v1
Implemented on `test`:
- AI `typing` chat action while grounded provider generation is in flight; refreshed every ~4 seconds
- AI answer/handoff replies target the originating question
- `ui:close` shared callback with `✕ Close` on configuration menus surfaced by the UX layer
- AI, FAQ and monitoring callback menus prefer `editMessageText` instead of adding new messages
- `/cancel` clears the current `admin_sessions` wizard/setup only
- `/reset` clears transient session/conversation control state only
- `/reset` preserves language, FAQ data, AI credentials/model bindings, persona, roles and monitoring configuration
- human-control follow-up traffic is explicitly relayed to the monitoring destination even if routine mirroring is disabled

Canonical navigation grammar:
- `← Back` = parent screen
- `✕ Close` = dismiss menu
- `Cancel` = active operation only

See `docs/TELEGRAM_DESIGN_RULES.md`.

## Conversation race guard — migration 0006
File:
`migrations/0006_conversation_control_version.sql`

Adds:
`conversation_control.control_version INTEGER NOT NULL DEFAULT 0`

`src/monitoring.ts` now:
- returns control `version`
- creates missing conversation-control rows with version 0
- increments version on successful Take Over
- increments version on Return to AI
- increments version on `/reset`

Grounded AI UX flow captures the version before provider work and re-reads it before any reply. If mode/version changed, stale AI output is discarded.

Migration 0006 must be applied before deploying the UX v1 Worker.

## Public commands
Normal user menu:
- `/start`
- `/whoami`

`/language` remains supported but hidden.

Sudo Admin adds:
- `/admin`
- `/admins`
- `/faq`

Owner adds:
- `/sudo`
- `/ai`
- `/staff`

Visibility is UX only; server-side authorization remains authoritative.

## Dynamic FAQ knowledge
Active D1 FAQ rows remain the common source for deterministic answers and per-request AI grounding.

Owner + Sudo Admin `/faq`:
- add/edit/disable/restore
- soft delete
- revision history
- Owner/Admin/Staff Inbox mutation notification

## AI runtime
Owner-configurable providers include OpenAI, Anthropic, Gemini, OpenRouter, Groq, Mistral, NanoGPT modes and Custom OpenAI-compatible HTTPS.

Runtime contract remains:
`Dynamic FAQ → Primary AI → Fallback AI → Human Handoff`

School-specific answers remain strictly grounded in active approved FAQ context. Provider/config failures fail closed to human handoff.

## Human handoff / monitoring
- group, dedicated, or auto route
- atomic claim
- anonymous claimant response
- monitoring modes: all_alerts / silent_all / alerts_only / off
- Take Over pauses automation
- claimant or Owner Return to AI
- human-control messages take precedence over routine monitoring preferences

## Repository validation
Workflow:
`.github/workflows/test-typecheck.yml`

Current gates:
- Node 22 dependency install
- strict TypeScript typecheck
- local D1 migrations 0001 → 0006
- Wrangler test-environment dry-run
- generated `deploy/worker.mjs` + SHA-256 refresh
- `cloudflare-test-handoff` artifact includes migration 0006

## Direct GitHub → Cloudflare TEST deployment
Workflow:
`.github/workflows/deploy-test.yml`

Purpose: eliminate manual `worker.mjs` / migration handoffs between GitHub-side and Cloudflare-side chats.

Trigger: manual `workflow_dispatch` only for the first production-safe version.

Pipeline:
1. checkout current `test`
2. Node 22 + dependencies
3. verify `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` GitHub Actions secrets exist
4. strict TypeScript typecheck
5. `wrangler d1 migrations apply school-of-nursing-faq-bot-db --remote --env test`
6. `wrangler deploy --env test`
7. verify `https://school-of-nursing-faq-bot-test.ye-shwethway13.workers.dev/health` reports `ok=true` and `environment=test`

This workflow targets only the TEST Worker configured by the `test` Wrangler environment. It does not deploy the production Worker.

Required GitHub Actions repository secrets, configured once by the Creator:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The Cloudflare API token must be restricted to the project account and have the permissions needed to edit Workers plus D1. Telegram runtime secrets remain Cloudflare Worker secrets and are not copied into GitHub.

## Exact next live work
1. Creator adds the two GitHub Actions repository secrets above.
2. Run `Deploy TEST to Cloudflare` manually from GitHub Actions.
3. Confirm remote migration 0006, TEST deploy, and health step are green.
4. Validate Telegram UX v1:
   - AI typing indicator during a deliberately slower AI response
   - deterministic FAQ stays fast
   - AI answer replies to original question
   - `✕ Close`
   - Back/edit-in-place navigation
   - `/cancel` cancels setup without deleting saved configuration
   - `/reset` clears transient conversation state without deleting persistent configuration
   - Take Over while AI is in flight suppresses the stale AI answer
   - `/reset` while AI is in flight suppresses the stale AI answer
   - human-controlled user follow-up reaches staff even in `alerts_only` or `off`

Do not merge `main` until these TEST checks are green.

## Next proposed slice
After UX v1 live validation only: latency/route telemetry + answer-presentation polish. Keep it bounded; no feature expansion before live evidence.
