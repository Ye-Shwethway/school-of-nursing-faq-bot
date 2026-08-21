# ROADMAP

Last updated: 2026-08-21

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Deterministic FAQ first, Human Staff continuity second, grounded AI as supplementary help.

## Repository policy
- `main` is canonical development + production.
- historical `test` is dormant/reference-only.
- relevant main pushes run the production workflow.

## Current checkpoint
Core FAQ/Human Staff production behavior remains authoritative. IANEO integration now uses a dedicated authenticated internal control plane rather than Telegram bot-to-bot forwarding.

### IANEO remote bridge — scalable capability registry

`src/internal_control.ts` is the canonical internal service-action registry. `src/interaction_guard_entry.ts` delegates `/internal/v1/...` requests to it before normal Telegram routing.

Authenticated surfaces:

- `GET /internal/v1/capabilities` — discover available service actions and safety metadata;
- `GET /internal/v1/status` — backwards-compatible aggregate operational summary;
- `POST /internal/v1/actions/<action-id>` — generic action dispatcher.

Security contract:
- dedicated `IANEO_SERVICE_TOKEN` Worker secret;
- Bearer authorization required;
- missing token -> HTTP 503 `internal_control_unconfigured`;
- wrong/missing bearer -> HTTP 401 `unauthorized`;
- no Telegram bot-to-bot command forwarding;
- no private Telegram identities/question bodies returned by current actions;
- action manifest declares `read`, `write`, or `sensitive` safety and whether confirmation is required;
- current dispatcher enables read actions only. Write/sensitive registration is deferred until the matching confirmation/audit semantics are implemented.

Current registered read actions:
- `operations.status`
- `monitoring.status`
- `handoff.status`
- `admins.summary`
- `cases.summary`

This architecture intentionally avoids one endpoint or IANEO UI implementation per Telegram Owner command. New remote-safe functionality should be added as a capability registry entry backed by the existing domain function, not by replaying Telegram command text.

Current Telegram command registry remains schema revision **11**: Public 4, Sudo 12, Owner 19. Telegram commands and remote capabilities are separate interfaces over shared domain behavior; not every Telegram command must or should be exposed remotely.

## Input-quality precedence contract
Low-information/incomplete input must be evaluated **before deterministic FAQ matching, AI, or escalation** for normal private users.

`src/pre_faq_quality_entry.ts` sits before `faq_ai_entry.ts`; the older lower `src/input_quality_entry.ts` remains a secondary guard. Both bypass active authorized setup/edit sessions and active human-controlled conversations.

Greeting/noise coverage includes common English/Burmese/Chinese greetings, acknowledgements, thanks, bare yes/no, numeric-only, punctuation-only, URL-only, username-only, phone-like, repeated-character, and other very low-content input. Short meaningful School terms such as `fee`, `exam`, `cdm`, `loan`, and `bond` remain allowed through.

## FAQ current-row and archive contract
- D1 `faq_entries` is the only live canonical FAQ store.
- one current published row per stable `faq_key`.
- approved update overwrites current row and increments `version`.
- `faq_revisions` stores audit/recovery history.
- `src/faq.ts` is seed/bootstrap data after D1 exists.

## FAQ integrity and edit UX
`src/faq_store.ts` rejects command/control text and rendered management blocks as canonical FAQ content. Owner `/faq repair` restores the newest clean same-key revision snapshot as a new live version while preserving history.

Edit-from-one-language keeps the current live row unchanged until Approve & Save. `✕ Cancel Edit` clears only the draft/session.

## Staff availability contract
Timezone: **Asia/Yangon / UTC+06:30**.
- recurring schedule survives plain `/available` and `/unavailable`;
- plain state commands override until next schedule boundary;
- timed unavailability preserves recurring schedule;
- explicit cancel/clear removes recurring schedule;
- transitions are declared to private chat + Staff Inbox.

## Migrations
Current range: `0001` through `0035`.

## Validation boundary
For the capability-registry slice:
1. production workflow after `src/internal_control.ts` / `src/interaction_guard_entry.ts` changes must be green;
2. unauthenticated internal endpoints must not disclose data;
3. `GET /internal/v1/capabilities` with the correct bearer must list the five registered read actions;
4. `POST /internal/v1/actions/monitoring.status`, `handoff.status`, `admins.summary`, and `cases.summary` must return only their intended read-only data;
5. unknown actions must return 404;
6. non-read actions, when later declared, must remain blocked until explicitly enabled;
7. existing `/health`, Telegram webhook, FAQ behavior, Owner commands and production scheduled behavior must remain unchanged;
8. IANEO must consume capability discovery over direct HTTPS.

Existing input-quality, FAQ integrity/edit, staff availability, human-control lease, AI outage, and Owner command validation remain required production boundaries.
