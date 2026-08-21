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

IANEO integration now uses a scalable authenticated capability registry. Telegram-native Owner/Admin commands remain unchanged and are never replayed bot-to-bot.

## IANEO internal control plane

Canonical implementation:
- `src/internal_control.ts` — capability manifest + generic action dispatcher
- `src/interaction_guard_entry.ts` — delegates `/internal/v1/...` before normal Telegram routing

Authenticated surfaces:
- `GET /internal/v1/capabilities`
- `GET /internal/v1/status`
- `POST /internal/v1/actions/<action-id>`

Authentication:
- FAQ Worker secret: `IANEO_SERVICE_TOKEN`
- header: `Authorization: Bearer <token>`
- missing configured secret -> 503
- invalid/missing bearer -> 401

## Current capabilities

Reads:
- `operations.status`
- `monitoring.status`
- `handoff.status`
- `admins.summary`
- `cases.summary`

Bounded writes now implemented:
- `monitoring.set`
  - choice input `mode`
  - values: `all_alerts`, `silent_all`, `alerts_only`, `off`
- `handoff.set`
  - choice input `route`
  - values: `auto`, `group`, `dedicated`

Both writes:
- declare safety=`write`;
- require explicit confirmation;
- reuse existing domain functions rather than Telegram command text;
- attribute mutation to the configured Bot Owner ID;
- validate choice values server-side.

Additional target validation:
- group handoff cannot be selected unless Staff Inbox is configured;
- dedicated handoff cannot be selected unless dedicated staff is configured.

Capability metadata now supports reusable single-choice input descriptors (`name`, `label`, `type=choice`, `choices`). IANEO should render choice selection and confirmation generically rather than adding per-command UI handlers.

Sensitive capabilities remain disabled.

## Architecture rule

Telegram command registry and IANEO capability registry are separate interfaces over shared domain behavior. The Telegram Owner registry still contains 19 commands, but remote exposure is opt-in by capability. New remote-safe actions should normally be one registry/domain entry, not a new endpoint + new adapter method + new callback handler.

## Verified integration evidence before this write slice

- matching service credential configured as FAQ `IANEO_SERVICE_TOKEN` and IANEO `FAQ_SERVICE_TOKEN`;
- secret-bearing versions active at 100% traffic after Cloudflare version mismatch repair;
- IANEO Operational Summary live;
- dynamic read actions live-tested through `cases.summary`.

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
1. production workflow for `src/internal_control.ts` write-capability change must be green;
2. capability discovery must return five reads plus the two writes with choice metadata;
3. writes without confirmation must fail with `confirmation_required`;
4. invalid modes/routes must fail closed;
5. monitoring mutation must persist and read back;
6. handoff mutation must enforce route prerequisites and persist/read back;
7. existing reads, `/internal/v1/status`, Telegram webhook, `/health`, schedules and Owner/Admin commands must remain unchanged;
8. sensitive actions remain disabled.

## Next exact work
1. update IANEO to render generic choice inputs from capability metadata;
2. pass selected params + explicit confirmation through generic action dispatch;
3. live-test monitoring mode change and restoration;
4. live-test handoff route change and restoration;
5. only after bounded writes are proven, consider Sudo/AI/message-clearing capabilities with stronger audit/confirmation design.

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file, FAQ policy, manuals, and relevant design rules synchronized with repository reality.
