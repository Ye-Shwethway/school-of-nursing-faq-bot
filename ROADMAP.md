# ROADMAP

Last updated: 2026-08-21

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Deterministic FAQ first, Human Staff continuity second, grounded AI as supplementary help.

## Repository policy
- `main` is canonical development + production.
- historical `test` is dormant/reference-only.
- relevant main pushes run the production workflow.

## Current checkpoint
Core FAQ/Human Staff production behavior remains authoritative. IANEO integration uses a dedicated authenticated internal control plane rather than Telegram bot-to-bot forwarding.

### IANEO remote bridge — scalable capability registry

`src/internal_control.ts` is the canonical internal service-action registry. `src/interaction_guard_entry.ts` delegates `/internal/v1/...` requests to it before normal Telegram routing.

Authenticated surfaces:
- `GET /internal/v1/capabilities`
- `GET /internal/v1/status`
- `POST /internal/v1/actions/<action-id>`

Security contract:
- dedicated `IANEO_SERVICE_TOKEN` Worker secret;
- Bearer authorization required;
- missing token -> HTTP 503;
- wrong/missing bearer -> HTTP 401;
- no Telegram bot-to-bot command forwarding;
- capability manifest declares `read`, `write`, or `sensitive` safety plus confirmation metadata;
- sensitive actions remain disabled until separately authorized and audited.

Current registered reads:
- `operations.status`
- `monitoring.status`
- `handoff.status`
- `admins.summary`
- `cases.summary`

Current bounded writes:
- `monitoring.set` — choice input: `all_alerts`, `silent_all`, `alerts_only`, `off`;
- `handoff.set` — choice input: `auto`, `group`, `dedicated`.

Both writes require an explicit confirmed request. Target-side validation remains authoritative. `handoff.set` rejects `group` when Staff Inbox is not configured and rejects `dedicated` when no dedicated staff member is configured. Mutations reuse the existing domain functions and attribute the change to the configured Bot Owner ID.

The capability manifest now supports one reusable `choice` input descriptor (`name`, `label`, choices). IANEO should render this generically rather than hard-coding per-command buttons.

This architecture intentionally avoids one endpoint or one IANEO handler per Telegram Owner command. Telegram commands and remote capabilities are separate interfaces over shared domain functions. Current Telegram command registry remains schema revision **11**: Public 4, Sudo 12, Owner 19.

## Existing production contracts retained

### Input quality
Low-information input is guarded before deterministic FAQ matching and again lower in the stack. Authorized setup/edit sessions and active Human Take Over conversations bypass the gate.

### FAQ live/current/history
- `faq_entries` is the only live canonical FAQ store;
- one current row per `faq_key`;
- approved edits overwrite current row and increment version;
- `faq_revisions` stores audit/recovery history;
- `/faq repair` restores the newest clean archived snapshot as a new live version.

### FAQ edit UX
Draft editing keeps live content unchanged until Approve & Save. `✕ Cancel Edit` clears only the draft/session.

### Staff availability
Timezone: **Asia/Yangon / UTC+06:30**. Recurring schedules survive temporary manual state changes and resume at schedule boundaries unless explicitly cleared.

## Migrations
Current range: `0001` through `0035`.

## Validation boundary
For the bounded-write capability slice:
1. production workflow after the `src/internal_control.ts` change must be green;
2. capability discovery must list five reads plus `monitoring.set` and `handoff.set` with choice metadata;
3. missing confirmation for either write must return `confirmation_required`;
4. invalid choice values must fail closed;
5. `monitoring.set` must persist and read back the selected monitoring mode;
6. `handoff.set` must validate destination prerequisites and persist/read back the selected route;
7. existing read actions, `/health`, Telegram webhook, Owner commands and scheduled behavior must remain unchanged;
8. sensitive actions must remain unavailable.

Existing input-quality, FAQ integrity/edit, staff availability, human-control lease, AI outage, and Owner command validation remain required production boundaries.
