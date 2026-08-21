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

Newest integration work adds a minimal authenticated remote read surface for IANEO Orchestrator while preserving all existing Telegram-native Owner/Admin behavior.

## IANEO remote bridge

Implemented in `src/interaction_guard_entry.ts`:

`GET /internal/v1/status`

The bridge is intentionally tiny, read-only, and aggregate-only.

Authentication:
- FAQ Worker secret: `IANEO_SERVICE_TOKEN`
- request header: `Authorization: Bearer <token>`
- no token configured -> HTTP 503 `internal_control_unconfigured`
- invalid/missing bearer -> HTTP 401 `unauthorized`

Returned information is limited to:
- service/environment identity
- monitoring mode
- handoff route + Staff Inbox configured boolean
- aggregate counts for users, questions, pending questions, active cases, active staff, Sudo Admins, and human-controlled conversations

It never returns Telegram user IDs, usernames, names, chat IDs, question bodies, or other private records.

The same credential must later be configured on IANEO as `FAQ_SERVICE_TOKEN`. Do not place the actual token in source/docs/chat.

### Current verification boundary
Source commit implementing the bridge: `01dabf8e...`.

Do not call the bridge live-integrated until:
1. FAQ production workflow is green;
2. `IANEO_SERVICE_TOKEN` exists in the FAQ Worker;
3. matching `FAQ_SERVICE_TOKEN` exists in the IANEO Worker;
4. wrong/missing bearer is confirmed blocked;
5. correct bearer returns HTTP 200 aggregate status;
6. IANEO Telegram UI successfully displays the operational status through direct HTTPS.

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
Command schema revision 11. Public 4; Sudo 12; Owner 19.

## Secrets boundary
Existing Worker secrets remain private. New bridge secret is `IANEO_SERVICE_TOKEN`. Never commit or expose its value.

## Next exact work
1. verify production workflow for the bridge source change;
2. configure dedicated bridge token in FAQ Worker and matching token in IANEO Worker;
3. verify unauthorized/authorized HTTP behavior;
4. extend IANEO `FaqAdapter` with `operations/status` capability;
5. add a read-only Operational Status action to the IANEO FAQ submenu;
6. live-test through Telegram;
7. only then consider later write/sensitive actions with explicit confirmation.

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file, FAQ policy, manuals, and relevant design rules synchronized with repository reality.
