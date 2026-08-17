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
4. task-relevant docs/source only

Treat live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Branch contract
- work on `test`
- do not implement directly on `main`
- validation Worker: `school-of-nursing-faq-bot-test`
- production Worker after validated merge: `school-of-nursing-faq-bot`

## Current checkpoint
The `test` branch contains:
- Foundation + multilingual FAQ MVP core
- Owner/Sudo authorization
- `/whoami` identity flow
- role-scoped self-managed Telegram command menus
- AI provider settings + model fetch/Test Ping/Primary/Fallback binding
- NanoGPT subscription/all dual paths
- strict AI policy + AI fail-safe contract
- Male/Female AI persona
- group + dedicated human handoff
- silent shadow monitoring + conversation Take Over/Return to AI
- D1 dynamic FAQ store + CRUD/revision/notification core

Cloudflare live D1 still has only migration 0001. Migrations 0002–0005 are repository-only and not yet applied live. Test Worker has not yet been successfully deployed.

## Runtime entrypoint
`wrangler.jsonc` now points to:

`src/entry.ts`

`src/entry.ts` wraps `src/index.ts` to provide:
- automatic Telegram command-registry synchronization
- `/whoami`
- command-scope self-healing on `/start` and `/whoami`
- immediate target-scope refresh after Sudo grant/revoke

The old `deploy/worker.mjs` is stale Foundation-only code. Do not deploy it as the current application build.

## Public UX + commands
`/start` is public-only UI. Do not mix Owner/Admin controls into it.

Normal users see only:
- `/start`
- `/whoami`

`/language` remains functional but hidden from the command menu; language selection is available through `/start`.

`/whoami` private response uses:
`Name (@username) — ID: <numeric Telegram ID>`

The immutable numeric ID is the authority key. Usernames are metadata only.

Current Sudo Admin command menu adds:
- `/admin`
- `/admins`

Current Owner menu additionally adds:
- `/sudo`
- `/ai`
- `/staff`

Command definitions: `src/command_menu.ts`.
Automatic sync: `src/command_sync.ts`.
Identity formatting: `src/identity.ts`.
Docs: `docs/COMMANDS_AND_IDENTITY.md`.

The command fingerprint is derived from the registry arrays. Adding a runtime-ready command to the registry changes the fingerprint automatically; the first webhook after deployment calls Telegram `setMyCommands` for public, Owner, and current Sudo Admin private scopes. No BotFather command update is required.

Command visibility is UX only; server-side role checks remain authoritative.

## Admin identity rule
Management UI must show name/username + immutable ID together whenever metadata exists.

Current `/admins`, Sudo grant, and Sudo revoke output follow this rule through `src/identity.ts`.

## FAQ current source + dynamic cutover
Original canonical source: `SCHOOL of Nursing FAQ.docx`, 22 FAQs.

Current live-code matcher still uses hard-coded `src/faq.ts` because migration 0005 has not been applied.

Dynamic FAQ core already exists:
- `src/faq_store.ts`
- `src/faq_admin.ts`
- `src/faq_notify.ts`
- `migrations/0005_dynamic_faq.sql`
- `docs/FAQ_MANAGEMENT.md`

Target D1 behavior:
- Owner + Sudo Admin CRUD from Telegram
- add/edit/disable/restore
- soft delete via inactive state
- revision snapshots for every mutation
- mutation notification to Owner + all Sudo Admins + Staff Inbox group when configured
- active D1 FAQ rows become the shared source for deterministic matching and AI approved context

Safety boundary:
- `/faq` is intentionally NOT exposed in the command registry yet
- first seed/verify the existing 22 FAQs in migration-0005 storage
- switch deterministic matcher + AI context to D1
- wire FAQ callbacks/text sessions/notifications into runtime
- only then add `/faq` to the Admin/Owner command registry; it will appear automatically via fingerprint sync

## AI provider settings
Owner-only `/ai`.

Providers/modes:
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- NanoGPT Subscription only
- NanoGPT Subscription + Paid/all-visible
- Custom OpenAI-compatible HTTPS

Flow:
provider → encrypted key → fetch models → select model → Test Ping → bind Primary/Fallback.

Required secret:
`AI_CONFIG_MASTER_KEY` = base64 encoding of exactly 32 random bytes.

## AI policy + fail-safe
Policy: `src/agent_policy.ts` / `docs/AI_AGENT_POLICY.md`.
Fail-safe: `src/ai_fail_safe.ts` / `docs/AI_FAIL_SAFE.md`.

Strict runtime order:
`deterministic FAQ → AI readiness → Primary → Fallback → Human Handoff`.

AI unavailable/failing is a handoff condition, never a crash condition. Missing key/model/binding, decrypt failure, network/provider failure, timeout, 429/5xx, malformed structured output, or both model failures must route safely to humans.

AI may answer only from approved School of Nursing context. Missing/ambiguous/current-case-specific facts must hand off.

Grounded inference orchestration is not yet wired; deterministic no-match currently goes directly to humans.

## AI persona
Owner can select Male/Female persona from `/ai` inline buttons.
Persona changes presentation only; never facts, authority, grounding, or handoff threshold.

## Human handoff
Routing modes:
- `auto`: Staff Inbox group first, dedicated staff fallback
- `group`: Staff Inbox only
- `dedicated`: assigned private responder only

Owner commands include:
- `/staff status`
- `/staff route auto|group|dedicated`
- `/staff inbox here`
- `/staff dedicated <telegram_user_id>`
- `/staff add <telegram_user_id>`
- `/staff remove <telegram_user_id>`
- `/staff monitoring ...`

Dedicated assignment requires a successful private delivery probe.
Cases use atomic single-responder claim, anonymous user relay, and D1 queue preservation if notification delivery fails.

## Shadow monitoring / takeover
Migration 0004 + `src/monitoring.ts`.

Modes:
- `all_alerts` recommended default
- `silent_all`
- `alerts_only`
- `off`

Routine user/bot traffic can mirror silently to a Staff Inbox forum topic per user. Critical handoff remains enabled in every monitoring mode.

`Take Over` atomically moves a conversation from AI mode to human mode; automated replies stop. Claimant replies anonymously. Claimant or Owner can `Return to AI`.

Docs: `docs/SHADOW_MONITORING.md`.

## D1 migrations
Live in Cloudflare:
- `0001_initial.sql` — verified

Repository-only / not yet live:
- `0002_ai_settings.sql`
- `0003_handoff_persona.sql`
- `0004_shadow_monitoring.sql`
- `0005_dynamic_faq.sql`

## Verified Cloudflare checkpoint
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- binding: `DB`
- workers.dev subdomain: `ye-shwethway13`
- no production Worker
- no test Worker yet

First upload failed before creation with:
`10021: Can't set compatibility date in the future: 2026-08-18`

No infrastructure drift occurred.

## Validation state
Pending:
- current build/type validation
- regenerate current deployable Worker artifact
- prepare/verify migration-0005 seed data from the 22 canonical FAQs
- apply migrations 0002–0005 live in order
- dynamic FAQ runtime cutover + `/faq` runtime wiring
- deploy test Worker
- configure Telegram test secrets + Owner ID
- live command-scope and `/whoami` tests
- live name+ID admin list tests
- live FAQ/language tests
- live AI provider/persona/fail-safe tests
- live group/dedicated handoff tests
- live shadow monitoring / Take Over / Return to AI tests
- grounded Primary/Fallback inference orchestration

Do not merge to `main` yet.

## Next recommended slice
Complete the dynamic FAQ cutover first: seed the 22 approved FAQs into migration-0005 D1 format, wire `src/faq_admin.ts` callbacks/text sessions + `src/faq_notify.ts`, switch deterministic lookup and AI approved context to active D1 FAQs with safe migration behavior, then expose `/faq` through the command registry. After that, build/type validate and move to Cloudflare test deployment.
