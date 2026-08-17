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
- production Worker after validated merge: `school-of-nursing-faq-bot`

## Current checkpoint
The repo-side application architecture is largely wired on `test` without requiring live Cloudflare mutation:
- multilingual FAQ foundation
- Owner/Sudo authorization
- `/whoami` and human-readable identity formatting
- role-scoped Telegram command registry with automatic `setMyCommands` sync
- AI provider/key/model/Test Ping/Primary/Fallback settings
- NanoGPT subscription/all modes
- strict AI policy + fail-safe + actual grounded inference runtime
- Male/Female AI persona
- group + dedicated human handoff
- shadow monitoring + Take Over/Return to AI
- D1 dynamic FAQ store + Telegram CRUD + revision history + change notifications
- migration-aware dynamic FAQ/AI runtime entrypoint

Cloudflare live D1 still has only migration 0001. Migrations 0002–0005 are repository-only and not yet applied live. No test or production Worker exists yet.

## Runtime entrypoint
`wrangler.jsonc` points to:

`src/runtime_entry.ts`

`src/runtime_entry.ts` wraps the older `src/index.ts` and provides:
- webhook-secret verification for intercepted flows
- non-fatal command-menu synchronization
- `/whoami`
- command-scope self-healing
- `/faq` command/callback/session handling
- FAQ mutation notification fan-out
- migration-aware dynamic FAQ lookup
- dynamic AI approved-context construction
- grounded Primary → Fallback inference
- fail-safe human handoff
- routine AI/FAQ shadow mirroring

Transition safety:
- when migration 0005 is available, private user questions use D1 dynamic FAQ + grounded AI runtime
- if `faq_entries` is unavailable, requests fall through to legacy `src/index.ts` static FAQ handling instead of crashing

The old `deploy/worker.mjs` is stale Foundation-only code and must not be deployed as the current application.

## Public UX / commands
`/start` is public-only. Never mix privileged controls into it.

Public menu:
- `/start`
- `/whoami`

`/language` remains supported but hidden from the command menu.

Sudo Admin menu additionally:
- `/admin`
- `/admins`
- `/faq`

Owner menu additionally:
- `/sudo`
- `/ai`
- `/staff`

Command files:
- `src/command_menu.ts`
- `src/command_sync.ts`

Registry content is its own fingerprint. Any registered command change causes the first webhook after deployment to re-sync Telegram command scopes automatically. Sudo grant/revoke immediately refreshes the target private scope. Command visibility is UX only; server-side role checks remain authoritative.

## Identity rule
Canonical display:

`Name (@username) — ID: <numeric Telegram ID>`

Use name/username + immutable ID together on management surfaces whenever stored metadata exists. Bare IDs are only a fallback when identity metadata has never been observed.

Current identity-aware surfaces include:
- `/whoami`
- `/admins`
- Sudo grant/revoke confirmations
- Staff status/add/remove/dedicated assignment
- case claim/resolve messages
- FAQ-change actor notifications

## Dynamic FAQ knowledge
Original approved source: `SCHOOL of Nursing FAQ.docx`, 22 FAQs.

Migration `0005_dynamic_faq.sql` provides:
- `faq_entries`
- `faq_revisions`

Modules:
- `src/faq_store.ts`
- `src/faq_admin.ts`
- `src/faq_notify.ts`

Behavior after migration 0005:
- if `faq_entries` is empty, the 22 code-bundled canonical FAQs seed automatically
- deterministic matching reads active D1 FAQ rows
- AI approved context is rebuilt from active D1 FAQs on every user request
- Owner + Sudo Admin use `/faq` for add/edit/disable/restore
- disable is soft-delete
- every mutation creates a revision snapshot
- every mutation notifies Owner + all Sudo Admins + Staff Inbox group when configured
- FAQ edits become effective for deterministic answers and AI grounding on the next request; no embedding/vector rebuild is required at current FAQ scale

## AI settings
Owner-only `/ai`.

Providers:
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- NanoGPT Subscription only
- NanoGPT Subscription + Paid/all-visible
- Custom OpenAI-compatible HTTPS

Setup flow:
provider → encrypted key → fetch models → select → Test Ping → bind Primary/Fallback.

Required secret:
`AI_CONFIG_MASTER_KEY` = base64 encoding of exactly 32 random bytes.

## AI policy/runtime/fail-safe
Files:
- `src/agent_policy.ts`
- `src/ai_fail_safe.ts`
- `src/ai_runtime.ts`
- `docs/AI_AGENT_POLICY.md`
- `docs/AI_FAIL_SAFE.md`

Runtime order:
`Dynamic FAQ → Primary AI → Fallback AI → Human Handoff`.

AI can answer only from approved active FAQ context. It must not invent School-specific facts. Missing/ambiguous/current-case-specific information must hand off.

Primary provider failure or model handoff can fall through to configured Fallback. If neither yields a valid structured grounded answer, the system creates a human case. Missing key/binding, decrypt failure, timeout, auth/rate-limit/provider/network error, malformed JSON, or unavailable model must never crash the user flow.

Persona: Owner-selectable Male/Female; presentation only, never factual authority.

## Human handoff
Routing modes:
- `auto`: Staff Inbox group first, dedicated private responder fallback
- `group`: Staff Inbox only
- `dedicated`: assigned private responder only

Dedicated assignment requires successful private delivery probe.

Human cases:
- persist in D1
- atomic single claimant
- claimant-only response
- anonymous relay as `School of Nursing Staff`
- resolve lifecycle
- best-effort Owner warning if notification cannot be delivered

## Shadow monitoring / takeover
Migration 0004 + `src/monitoring.ts`.

Modes:
- `all_alerts` recommended
- `silent_all`
- `alerts_only`
- `off`

Routine traffic can mirror silently into Staff Inbox forum topics. Critical human handoff remains active regardless of routine monitoring mode.

`Take Over` atomically switches a user conversation to human mode; automated FAQ/AI replies stop. Claimant replies anonymously. Claimant or Owner can `Return to AI`.

## D1 migration state
Live in Cloudflare:
- 0001 — verified

Repository-only / not yet live:
- 0002 AI settings
- 0003 handoff/persona
- 0004 shadow monitoring
- 0005 dynamic FAQ/revisions

## Verified Cloudflare checkpoint
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- binding: `DB`
- workers.dev subdomain: `ye-shwethway13`
- no production Worker
- no test Worker

First upload failed before Worker creation with:
`10021: Can't set compatibility date in the future: 2026-08-18`

No infrastructure drift occurred.

## Validation
Focused workflow added:
`.github/workflows/test-typecheck.yml`

It runs Node 22 dependency install + `npm run typecheck` on pushes to `test`. Local assistant clone/install is still blocked by DNS resolution for github.com, so GitHub Actions is currently the remote compile-validation surface.

Still required before merge:
- latest typecheck green
- current deployment artifact strategy; never use stale `deploy/worker.mjs`
- apply migrations 0002–0005 in order
- verify dynamic FAQ seed (22 active rows) and revision schema
- deploy test Worker
- configure Telegram test secrets + Owner ID + AI master key
- live `/start`, `/whoami`, command scope, admin identity tests
- live FAQ CRUD/change-notification/dynamic-knowledge tests
- live provider fetch/ping/Primary/Fallback/fail-safe tests
- live group/dedicated handoff tests
- live shadow monitoring + Take Over/Return to AI tests

Do not merge to `main` yet.

## Next recommended slice
Resolve the focused GitHub typecheck to green. Then prepare one exact Cloudflare handoff covering migrations 0002–0005, current `src/runtime_entry.ts` deployment, secrets, and focused Telegram runtime validation. Stop before `main` merge until that evidence is green.
