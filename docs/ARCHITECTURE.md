# Architecture

Last updated: 2026-08-18

## Runtime pipeline

Telegram update → Cloudflare Worker → identity/language/session handling → deterministic FAQ match → grounded Primary AI → grounded Fallback AI → human Staff Inbox handoff.

If no staff member is currently available, the escalation is retained and the user is told staff are unavailable and to try again later. Authorized staff can later reconnect from the user's Staff Inbox topic and relay a reply back to the user's private chat.

## Canonical Worker stack

Wrangler entrypoint: `src/staff_presence_entry.ts`.

1. staff availability, `/noti`, returning-staff pending reminder, topic reply relay
2. best-effort Staff Inbox cleanup
3. manuals + command synchronization
4. production deployment/ops endpoints
5. latest Return-to-AI control
6. monitoring, FAQ/AI answer path, handoff
7. Staff Inbox UX + Sudo invite lifecycle
8. Telegram UX/navigation polish
9. secure AI setup interception
10. dynamic FAQ/AI runtime
11. compatibility fallback + `/health`

## Persistence

Cloudflare D1 stores operational application state including:

- users and language preference
- submitted questions
- FAQ knowledge and revisions
- AI provider/model configuration metadata and encrypted credentials
- Owner/Sudo/staff authorization state
- escalation cases and conversation control
- per-user monitoring topic mappings
- staff presence and notification settings
- Owner/Admin manuals and revisions
- recent group-message ledger used by best-effort cleanup

## Authorization

`BOT_OWNER_TELEGRAM_ID` is a Cloudflare runtime secret and authoritative for Owner bootstrap. Sudo Admin and staff authorization use immutable Telegram numeric user ID. Username is display/search metadata only.

## Staff Inbox

The preferred human-operations surface is a private Telegram supergroup with Topics enabled. Each user maps to one isolated topic by `(telegram_user_id, staff_chat_id)`.

Owner can switch the active Staff Inbox from `/staff`. Sudo grant enables staff authorization and, when needed, provisions a one-use group invite link.

## Notification and availability boundary

`/noti off` silences Staff Inbox push notifications without disabling monitoring or discarding cases.

`/available` and `/unavailable` control staff presence. When all staff are unavailable, unanswered cases stay queued. Returning unavailable staff can receive a pending-case prompt with inline choices to become available or remain unavailable.

## FAQ and AI boundary

Approved FAQs use stable canonical data. Policy-sensitive facts are deterministic data, not model-generated facts.

AI is a grounded fallback interpreter, never the source of institutional truth. Both Primary and Fallback models must answer only from approved context. Insufficient grounding produces a human handoff rather than guessing.

## Deployment

`main` is the only active development/canonical/production branch. Relevant `main` pushes automatically run `.github/workflows/deploy-production.yml`.

The historical `test` branch is dormant/reference-only and has no active deployment role.

## Privacy

The public repository contains code/schema/docs only. Production user/question records and secrets remain in Cloudflare/D1 and are accessible only through authorized operational paths.
