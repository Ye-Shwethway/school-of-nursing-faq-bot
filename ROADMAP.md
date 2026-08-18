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

## Phase 0–8 — Foundation through repository build
Status: COMPLETE ON `test`

Implemented and repository-validated:
- multilingual public FAQ UX and 22 approved FAQ seeds
- Owner/Sudo authorization, `/whoami`, identity formatting and audit logging
- self-managed scoped command menus
- encrypted multi-provider AI settings, model fetch, Test Ping, Primary/Fallback
- strict grounded AI runtime and fail-safe human handoff
- group/dedicated handoff, anonymous claimant relay
- shadow monitoring and conversation takeover
- dynamic D1 FAQ knowledge + Owner/Sudo CRUD + revisions + change notifications
- generated Worker artifact workflow with TypeScript, local D1 migration and Wrangler dry-run gates

## Phase 9 — Live TEST runtime
Status: TEST RUNTIME FUNCTIONAL; CONTINUED VALIDATION/REFINEMENT

Creator manually completed the blocked deployment/configuration path and verified the important AI path in the TEST bot:

`FAQ miss → Gemini grounded agent → Telegram answer`

The earlier API-key routing bug was fixed by the secure setup guard so secret input is consumed before normal FAQ/AI/handoff routing.

Production remains outside this development slice and `main` is not promoted yet.

## Phase 10 — Telegram UX Polish v1
Status: IMPLEMENTED ON `test`; LIVE MIGRATION/REDEPLOY PENDING

New canonical entrypoint:
- `src/ux_entry.ts`

Wrangler now enters the UX layer first, then preserves the existing secure/runtime fallback stack.

Implemented:
- native Telegram `typing` progress for grounded AI generation, refreshed while the request is in flight
- no persistent “please wait” clutter
- AI answer/handoff replies attach to the originating question
- shared `ui:close` callback and `✕ Close` on AI, FAQ and monitoring configuration surfaces
- callback navigation prefers `editMessageText`, with send fallback
- `/cancel` = current wizard/setup only
- `/reset` = transient conversation/session reset; persistent language, FAQ knowledge, AI credentials/bindings, persona, roles and monitoring config are preserved
- active human-control user messages are relayed to the monitoring destination regardless of routine mirror mode
- AI generation captures conversation control version before provider work and re-checks before sending output

Migration 0006:
- `migrations/0006_conversation_control_version.sql`
- adds `conversation_control.control_version`
- Take Over, Return to AI and `/reset` increment the version
- stale AI output is discarded when control mode/version changes while a provider call is running

Repository validation evidence:
- the UX entrypoint + migration 0006 produced a validated regenerated Worker artifact through the existing Test Build pipeline
- pipeline gates include strict TypeScript typecheck, local D1 migrations and Wrangler `test` dry-run

## Telegram UX grammar
Canonical rules are in `docs/TELEGRAM_DESIGN_RULES.md`:
- `← Back` = parent screen
- `✕ Close` = dismiss menu
- `Cancel` = abandon active wizard only
- callback menus edit in place when possible

## Current deployment requirement
Before deploying the UX Polish v1 Worker to TEST:
1. apply migration `0006_conversation_control_version.sql` to the existing TEST/live D1 database
2. deploy the newly generated exact `deploy/worker.mjs`
3. preserve existing TEST Worker secrets, DB binding and `APP_ENV=test`
4. validate `/cancel`, `/reset`, Close, Back/edit-in-place, AI typing/reply-to, Take Over race suppression and human-control follow-up delivery

Do not deploy this Worker before migration 0006 because the new control runtime reads `control_version`.

## Next slice after UX v1 live validation
Keep it small:
- latency/route telemetry without secrets
- answer formatting polish
- provider/model latency comparison

Do not add these until UX v1 is live-green.
