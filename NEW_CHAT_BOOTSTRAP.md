# NEW CHAT BOOTSTRAP

Last updated: 2026-08-21
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant canonical docs/source

Live repository plus verified production evidence outranks remembered chat context.

## Current checkpoint
Main-only production Telegram FAQ assistant. FAQ and Human Staff are primary continuity; grounded AI is supplementary.

IANEO integration has advanced from one aggregate status endpoint to a scalable authenticated internal capability registry. Telegram-native Owner/Admin commands remain unchanged and are not replayed bot-to-bot.

## IANEO internal control plane

Canonical implementation:
- `src/internal_control.ts` — capability manifest + generic action dispatcher
- `src/interaction_guard_entry.ts` — delegates `/internal/v1/...` before normal Telegram routing

Authenticated surfaces:
- `GET /internal/v1/capabilities`
- `GET /internal/v1/status` (backwards compatibility)
- `POST /internal/v1/actions/<action-id>`

Authentication:
- FAQ Worker secret: `IANEO_SERVICE_TOKEN`
- request header: `Authorization: Bearer <token>`
- missing configured secret -> 503
- invalid/missing bearer -> 401

Current remote-safe read capabilities:
- `operations.status`
- `monitoring.status`
- `handoff.status`
- `admins.summary`
- `cases.summary`

Each capability declares:
- id
- label/description
- safety: `read`, `write`, or `sensitive`
- `requiresConfirmation`

Current dispatcher intentionally executes only `read` actions. This gives future Owner-control expansion one reusable service-action registry rather than one HTTP endpoint/UI implementation per Telegram command.

Important architecture rule:
- Telegram command registry and IANEO capability registry are separate interfaces over shared domain behavior.
- Do not forward `/admin`, `/sudo`, `/staff`, `/ai`, etc. as Telegram bot-to-bot messages.
- When a command becomes useful remotely, expose the underlying domain operation as one capability entry.
- Not every Owner command needs remote exposure.

## Verified integration evidence before this slice

The dedicated service credential is configured on both production Workers:
- FAQ: `IANEO_SERVICE_TOKEN`
- IANEO: `FAQ_SERVICE_TOKEN`

A Cloudflare version mismatch was fixed by activating secret-bearing production versions at 100% traffic.

IANEO successfully displayed the production FAQ Operational Summary through authenticated direct HTTPS, including monitoring/handoff and aggregate workload counts. Secret values are never documented.

## Existing production contracts retained

### Input quality
Low-information greetings/noise are guarded before deterministic FAQ matching and again lower in the stack. Active authorized setup/edit sessions and Human Take Over conversations bypass the gate.

### FAQ live/current/history
- `faq_entries` = one current row per `faq_key`
- approved edits overwrite current row and increment version
- `faq_revisions` = history/recovery only
- `/faq repair` restores newest clean archived snapshot as a new live version

### FAQ edit UX
Draft edit keeps live content unchanged until Approve & Save. `✕ Cancel Edit` clears only the draft/session.

### Staff availability
Timezone Asia/Yangon / UTC+06:30. Recurring schedules survive temporary manual state changes and resume at schedule boundaries unless explicitly cleared.

## Commands
Telegram command schema revision remains 11. Public 4; Sudo 12; Owner 19.

## Secrets boundary
Existing Worker secrets remain private. IANEO bridge secret is `IANEO_SERVICE_TOKEN`. Never commit or expose its value.

## Current validation boundary
1. production workflow for capability-registry source changes must be green;
2. correct bearer must read `/internal/v1/capabilities`;
3. wrong/missing bearer must remain blocked;
4. each of the five read actions must return its intended limited payload;
5. unknown action must return 404;
6. existing `/internal/v1/status` must remain compatible with current IANEO production until dynamic discovery is deployed;
7. Telegram webhook, `/health`, schedules, FAQ behavior and Owner/Admin commands must remain unchanged.

## Next exact work
1. deploy/verify FAQ capability registry;
2. deploy IANEO dynamic capability discovery;
3. live-test Telegram FAQ menu showing discovered actions;
4. verify Monitoring, Handoff, Admin Summary and Cases Summary reads;
5. then register selected write actions in the same registry, with IANEO confirmation UX and server-side authorization/audit requirements;
6. add sensitive actions such as Sudo/AI configuration only after their explicit confirmation and audit design is validated.

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file, FAQ policy, manuals, and relevant design rules synchronized with repository reality.
