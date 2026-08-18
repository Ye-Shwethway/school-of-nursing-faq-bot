# Cloudflare Handoff

Last updated: 2026-08-18

## Current TEST checkpoint
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Branch: `test`

Cloudflare account:
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1 database: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- binding: `DB`
- TEST Worker: `school-of-nursing-faq-bot-test`
- production Worker: `school-of-nursing-faq-bot`

The Creator reports that the manual TEST deployment/configuration recovery succeeded and the live bot now passes:

`FAQ miss → Gemini grounded agent → Telegram reply`

The earlier AI API-key routing issue is therefore no longer the current blocker.

Before any mutation, read back the actual Cloudflare Worker/D1 state. Treat that read-back as authoritative if it differs from this report.

## Branch/environment rule
- deploy only the `test` artifact to `school-of-nursing-faq-bot-test`
- do not deploy or modify production during this refinement handoff
- do not merge `test` into `main`
- preserve existing TEST secrets, D1 binding, webhook and `APP_ENV=test`

## Current application entrypoint
Wrangler entrypoint:

`src/ux_entry.ts`

Runtime stack:
1. `ux_entry.ts` — Telegram UX Polish v1 and AI generation control guard
2. `secure_entry.ts` — AI secret/setup routing guard
3. `runtime_entry.ts` — dynamic FAQ/AI integration
4. `index.ts` — retained fallback application runtime

Do not reconstruct or independently patch the generated Worker.

## New migration required before UX v1 Worker
Apply exact repository migration:

`migrations/0006_conversation_control_version.sql`

It adds:

`conversation_control.control_version INTEGER NOT NULL DEFAULT 0`

This column is required by the new runtime. Apply migration 0006 before uploading the new Worker.

Do not reapply or rewrite migrations 0001–0005 unless Cloudflare read-back proves they are actually missing. The currently functioning Gemini/D1 runtime strongly indicates the earlier application migrations are already present, but verify rather than assume.

After migration 0006 verify:
- `conversation_control.control_version` exists
- existing rows have a usable default value
- existing user/admin/FAQ/AI credential data remains intact

## Exact deployment artifact
Use only the current generated files from `test`:
- `deploy/worker.mjs`
- `deploy/worker.sha256`

Verify SHA-256 against the sidecar immediately before upload. Do not rely on an older checksum copied into a chat because the Test Build workflow refreshes the artifact after source changes.

Repository build gates before artifact refresh:
1. Node 22 dependency install
2. strict TypeScript typecheck
3. local D1 migrations 0001 → 0006
4. Wrangler `--dry-run --env test`
5. generated Worker + checksum refresh

The `cloudflare-test-handoff` GitHub Actions artifact now includes migration 0006 plus the generated Worker/checksum.

## Preserve runtime configuration
Do not rotate, remove, print or replace existing values unless explicitly requested:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `BOT_OWNER_TELEGRAM_ID`
- `AI_CONFIG_MASTER_KEY`
- provider credentials encrypted in D1
- current Primary/Fallback model binding
- Staff Inbox / dedicated responder settings
- Telegram webhook

## UX v1 live validation
After migration 0006 and TEST redeploy, validate:

1. `GET /health` remains HTTP 200 and environment remains `test`.
2. A deterministic FAQ still returns immediately and does not unnecessarily invoke AI.
3. A natural-language FAQ miss that Gemini can answer from approved context shows Telegram native `typing` while generation is in flight.
4. AI answer is sent as a reply to the originating question.
5. AI/FAQ/monitoring callback navigation edits the existing menu where possible instead of flooding chat.
6. `✕ Close` dismisses the current bot-owned menu.
7. `← Back` returns to the parent screen.
8. `/cancel` clears only the current wizard/setup and does not delete saved AI provider/model configuration.
9. `/reset` clears transient session/conversation state and returns the conversation to automated mode while preserving language, FAQ knowledge, AI credentials, model bindings, persona, roles and monitoring settings.
10. Start a deliberately slow AI request, then use staff `Take Over`; the old in-flight AI result must not be delivered.
11. Start a deliberately slow AI request, then issue `/reset`; the old in-flight AI result must not be delivered.
12. While human control is active, user follow-up must reach the staff monitoring destination even when routine monitoring mode is `alerts_only` or `off`.
13. AI provider-key setup still consumes secret input before normal question routing and the secret-like Telegram message remains best-effort deleted.

## Stop boundary
After focused TEST validation, stop and report:
- migration 0006 result
- Worker deployment/version
- exact deployed artifact checksum
- health result
- each UX validation result
- any runtime error or behavioral regression
- confirmation that production was untouched

Do not promote `main` or production until the GitHub-side session reviews this evidence.
