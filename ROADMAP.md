# ROADMAP

Last updated: 2026-08-21

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Deterministic FAQ first, Human Staff continuity second, grounded AI as supplementary help.

## Repository policy
- `main` is canonical development + production.
- historical `test` is dormant/reference-only.
- relevant main pushes run the production workflow.

## Current checkpoint
Core FAQ/Human Staff production behavior remains authoritative. The newest integration slice adds a minimal read-only remote control surface for IANEO Orchestrator without replacing Telegram-native management.

### IANEO remote bridge — implemented, live auth verification pending

`src/interaction_guard_entry.ts` now exposes:

`GET /internal/v1/status`

Security contract:
- dedicated `IANEO_SERVICE_TOKEN` Worker secret;
- Bearer authorization required;
- missing token -> HTTP 503 `internal_control_unconfigured`;
- wrong/missing bearer -> HTTP 401 `unauthorized`;
- no Telegram bot-to-bot forwarding;
- no user identities, names, chat IDs, question bodies, or other private records returned.

The first payload is intentionally read-only and aggregate-only:
- service/environment identity;
- monitoring mode;
- handoff route + whether Staff Inbox is configured;
- total users;
- total questions;
- pending questions;
- active escalation cases;
- active staff count;
- Sudo Admin count;
- human-controlled conversation count.

This endpoint must not be considered live-integrated until `IANEO_SERVICE_TOKEN` is configured in the FAQ Worker, the same credential is configured as IANEO's `FAQ_SERVICE_TOKEN`, and an authenticated request through IANEO is verified.

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

## Command registry
Schema revision **11**. Public 4, Sudo 12, Owner 19.

## Validation boundary
For the new IANEO bridge:
1. production workflow for source commit `01dabf8e...` must be green;
2. unauthenticated `/internal/v1/status` must not disclose data;
3. before token configuration, endpoint may correctly return 503;
4. after token configuration, correct bearer must return HTTP 200 with aggregate status only;
5. wrong bearer must return 401;
6. existing `/health` and Telegram webhook behavior must remain unchanged;
7. IANEO must consume this endpoint through direct HTTPS using its own `FAQ_SERVICE_TOKEN` secret.

Existing input-quality, FAQ integrity/edit, staff availability, human-control lease, AI outage, and Owner command validation remain required production boundaries.
