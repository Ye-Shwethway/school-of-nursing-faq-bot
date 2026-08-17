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
- validation Worker: `school-of-nursing-faq-bot-test`
- production Worker only after validated merge: `school-of-nursing-faq-bot`

## Current checkpoint
Repo-side application and build preparation are green on `test`.

Implemented:
- multilingual public FAQ UX
- Owner/Sudo authorization
- `/whoami` + human-readable identity formatting
- automatically managed role-scoped Telegram command menus
- multi-provider AI settings, encrypted keys, model fetch, Test Ping, Primary/Fallback
- NanoGPT subscription/all modes
- strict AI grounding policy + fail-safe + actual inference runtime
- Male/Female AI persona
- group + dedicated human handoff
- shadow monitoring + atomic Take Over/Return to AI
- D1 dynamic FAQ store + Owner/Sudo CRUD + revision history + change notifications
- migration-aware dynamic FAQ/AI cutover
- validated generated Worker deployment artifact + SHA-256 sidecar

Cloudflare live D1 still has migration 0001 only. Migrations 0002–0005 are not live. No test or production Worker exists yet.

## Canonical Worker runtime
`wrangler.jsonc` entrypoint:

`src/runtime_entry.ts`

The superseded `src/entry.ts` was removed.

`src/index.ts` remains intentionally as the migration-transition fallback runtime.

`src/runtime_entry.ts` provides:
- webhook-secret validation for intercepted flows
- non-fatal scoped command-menu sync
- `/whoami`
- FAQ CRUD callbacks/sessions and mutation fan-out
- migration-aware dynamic FAQ matching
- per-request approved AI context
- grounded Primary → Fallback inference
- fail-safe human handoff
- shadow mirroring for dynamic FAQ/AI answers

If migration 0005 is absent, private user questions safely fall through to the retained static FAQ runtime instead of crashing.

## Public commands
`/start` is public-only. Never mix privileged controls into it.

Normal user menu:
- `/start`
- `/whoami`

`/language` remains supported but hidden from the command menu.

Sudo Admin adds:
- `/admin`
- `/admins`
- `/faq`

Owner adds:
- `/sudo`
- `/ai`
- `/staff`

Command files:
- `src/command_menu.ts`
- `src/command_sync.ts`

Command arrays are the registry fingerprint. A code change to the registered commands causes the first webhook after deployment to call Telegram `setMyCommands` for public, Owner, and current Sudo scopes. Grant/revoke refreshes the affected private scope. Visibility never replaces server-side authorization.

## Identity rule
Canonical management display:

`Name (@username) — ID: <immutable numeric Telegram ID>`

Use identity metadata + ID together whenever available. Username is metadata only; numeric ID is authority.

Applied to `/whoami`, `/admins`, Sudo grant/revoke, staff status/add/remove/dedicated assignment, case claim/resolve, and FAQ-change actor notifications.

## Dynamic FAQ knowledge
Approved source: `SCHOOL of Nursing FAQ.docx`, 22 FAQs.

Migration 0005:
- `faq_entries`
- `faq_revisions`

Files:
- `src/faq_store.ts`
- `src/faq_admin.ts`
- `src/faq_notify.ts`
- `docs/FAQ_MANAGEMENT.md`

After migration 0005:
- empty `faq_entries` auto-seeds the original 22 approved FAQs
- active D1 rows drive deterministic FAQ matching
- the same active D1 snapshot builds AI approved context on every user request
- Owner + Sudo Admin `/faq` supports add/edit/disable/restore
- disable is soft-delete
- every mutation writes revision history
- mutation notifications go to Owner + all Sudo Admins + Staff Inbox if configured
- content changes affect deterministic answers and AI grounding on the next request

## AI settings/runtime
Owner-only `/ai` providers:
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- NanoGPT Subscription only
- NanoGPT Subscription + Paid/all-visible
- Custom OpenAI-compatible HTTPS

Setup:
provider → encrypted key → fetch models → select → Test Ping → bind Primary/Fallback.

Required Worker secret:
`AI_CONFIG_MASTER_KEY` = base64 encoding of exactly 32 random bytes.

Files:
- `src/agent_policy.ts`
- `src/ai_fail_safe.ts`
- `src/ai_runtime.ts`

Runtime:
`Dynamic FAQ → Primary AI → Fallback AI → Human Handoff`.

AI may use only approved active FAQ context for School-specific facts. Missing/ambiguous/current-case-specific facts hand off. Missing credentials/bindings, decrypt failure, timeout, auth/rate-limit/provider/network failure, malformed model output, or unavailable model must not crash the user flow.

Persona: Owner-selectable Male/Female; presentation only.

## Human handoff
Routes:
- `auto`: Staff Inbox group first, dedicated private responder fallback
- `group`: Staff Inbox only
- `dedicated`: assigned private responder only

Dedicated assignment requires successful private delivery probe.

Cases persist in D1, use atomic single claimant, claimant-only anonymous response as `School of Nursing Staff`, resolve lifecycle, and best-effort Owner warning when staff notification cannot be delivered.

## Shadow monitoring
Migration 0004 + `src/monitoring.ts`.

Modes:
- `all_alerts` recommended
- `silent_all`
- `alerts_only`
- `off`

Routine traffic can mirror silently into Staff Inbox forum topics. Critical human handoff remains active regardless of routine monitoring setting.

`Take Over` atomically moves a conversation into human mode and stops automated FAQ/AI replies. Claimant responds anonymously. Claimant or Owner can `Return to AI`.

## D1 state
Live Cloudflare:
- 0001 verified

Repository-only / not live:
- 0002 AI settings
- 0003 handoff/persona
- 0004 shadow monitoring
- 0005 dynamic FAQ/revisions

All migrations 0001→0005 have passed Wrangler **local D1 migration validation** in GitHub Actions.

## Repository build validation
Workflow:
`.github/workflows/test-typecheck.yml`

Current focused validation passes:
- Node 22 install ✅
- TypeScript strict typecheck ✅
- local D1 migrations 0001→0005 ✅
- Wrangler test-environment dry-run bundle ✅
- generated deployment artifact refresh ✅

Latest dry-run evidence:
- total upload ~182.21 KiB
- gzip ~39.71 KiB
- `DB` binding → `school-of-nursing-faq-bot-db`
- `APP_ENV=test`

Current exact deployment files:
- `deploy/worker.mjs`
- `deploy/worker.sha256`

Current expected SHA-256:
`2f15bd2d97ec86917741603b41eccf6c0a49f88172283ed5fc10021925cddff0`

The Test Build workflow regenerates the artifact and checksum whenever the Worker bundle changes.

## Verified Cloudflare checkpoint
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- binding: `DB`
- workers.dev subdomain: `ye-shwethway13`
- no test Worker
- no production Worker

First upload failed before creation with:
`10021: Can't set compatibility date in the future: 2026-08-18`

No infrastructure drift occurred.

## Exact next live work
Use `docs/CLOUDFLARE_HANDOFF.md`.

After Cloudflare UTC reaches `2026-08-18`:
1. apply exact migrations 0002→0005
2. deploy exact current `deploy/worker.mjs` to `school-of-nursing-faq-bot-test`
3. verify health/bindings/D1 integrity
4. configure Telegram secrets, Owner ID, and `AI_CONFIG_MASTER_KEY`
5. run focused Telegram validation for public UX, scoped commands, FAQ CRUD/dynamic knowledge, AI Primary/Fallback/fail-safe, group/dedicated handoff, monitoring, Take Over/Return to AI

Do not merge `main` until that live evidence is green.

## Current stop boundary
There is no remaining feature implementation required before live validation. Repository build/type/migration/bundle preparation is green. The next meaningful boundary requires Cloudflare/Telegram runtime access.
