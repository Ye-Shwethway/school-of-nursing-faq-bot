# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence

Read in order:

1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant canonical docs/source

Treat live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Current checkpoint

The project is production-live and main-only.

Current working/currently implemented surfaces include:

- multilingual deterministic FAQ
- public `/faq` command for normal users
- role-aware FAQ library: read-only localized browsing for normal users; management controls for Owner/Sudo
- paginated FAQ list with human-readable localized question labels instead of internal slugs
- compact two-column FAQ rows only for short labels; long labels use full rows
- localized public FAQ detail view
- grounded configurable Primary/Fallback AI
- production Telegram webhook
- Owner identity and Sudo Admin roles
- visible `/language`
- Staff Inbox per-user topics
- Take Over / Return to AI
- Sudo-to-staff invite provisioning
- Staff Inbox switching
- `/noti on|off`
- `/available` / `/unavailable`
- all-staff-unavailable user messaging
- staff-topic reply relay back to the original user
- returning-unavailable staff pending-case reminder with inline availability choice
- editable Owner/Admin manuals
- Owner/Admin manual coverage for current staff operations
- Owner manual cleaned of stale TEST deployment guidance
- Owner `/clearmessage` retained as best-effort only

There is no additional active required implementation slice after the public FAQ library UX change.

## Main-only operating model

- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- no TEST deploy/build workflow is active.
- `.github/workflows/deploy-production.yml` is the single production workflow.
- relevant `main` pushes automatically validate and deploy production.

Do not revive a TEST→main promotion model unless the Owner explicitly redesigns the architecture.

## Public FAQ library contract

`/faq` is public.

Normal users:

- can browse active FAQs only
- see labels in their saved Burmese, English, or Simplified Chinese language
- see approved questions/topics rather than internal keys
- receive 8-item pagination with compact two-column packing when labels are short
- see only the selected-language question and answer in detail view
- never receive Add/Edit/Disable/Restore, inactive FAQ, key, version, or revision controls

Owner/Sudo retain the `/faq` management surface with Browse, Add, Inactive, Help, Edit, Disable, and Restore.

The Telegram UX layer already handles FAQ callback navigation edit-in-place first and appends the shared `✕ Close` control.

No D1 migration was required for this slice.

## Command registry

Public:

`/start`, `/language`, `/faq`, `/whoami`

Sudo Admin adds:

`/admin`, `/admins`, `/adminmanual`, `/noti`, `/available`, `/unavailable`

Owner additionally has:

`/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`

Command schema revision: `6`.

Production exact Owner read-back target remains **17 commands**. Privileged command ordering remains compatible with the existing workflow read-back contract.

## Staff presence / notification behavior

Migration `0012_staff_presence_notifications.sql` adds staff presence and Staff Inbox notification state.

Inside the active Staff Inbox, authorized operators can use:

- `/noti on`
- `/noti off`
- `/available`
- `/unavailable`

`/noti off` suppresses Telegram push notifications only. Messages/cases remain visible and handoff remains active.

Staff without an explicit presence row default to available until marked unavailable.

## Unavailable handoff behavior

If deterministic FAQ and grounded Primary/Fallback AI cannot answer:

- escalation is retained/routed
- if at least one staff member is available, user receives normal handoff copy
- if no staff are available, user is told staff are currently unavailable and to try again later

No immediate staff response is promised when nobody is available.

## Staff reconnect / reply behavior

Authorized staff can later write normal text inside the affected user's Staff Inbox topic.

The runtime:

- maps `(staff_chat_id, message_thread_id)` back to the original Telegram user
- marks the replying staff member available
- takes human control when allowed
- leaves another staff member's existing claim intact rather than stealing it
- relays the staff text to the user's private chat under the neutral School of Nursing staff label
- reports private-delivery failure back into the topic

## Returning unavailable staff reminder

If an authorized staff member is still marked unavailable and later interacts with the bot privately while new open cases are waiting, the bot can show a pending-count reminder with:

- `✅ Mark me Available & Review`
- `⏸ Stay Unavailable`

The latest pending-case ID is acknowledged per staff member so an unchanged pending set does not repeatedly spam them. A newly-created case can trigger another reminder.

## Staff Inbox and Sudo lifecycle

Owner `/sudo grant <telegram_user_id>`:

- grants `sudo_admin`
- enables staff authorization
- refreshes the user's command scope best-effort
- checks Staff Inbox membership
- creates a one-use invite when needed and Telegram permissions allow it
- attempts private invite delivery to the new Sudo Admin
- falls back to sending the link to Owner if the target cannot receive the DM

`/sudo revoke` removes Sudo and disables bot-side staff authorization. It does not currently auto-kick an already-joined Telegram group member.

Owner can switch Staff Inbox by using `/staff` in the desired group and choosing `Use / Switch to this Staff Inbox`.

## Cleanup limitation

`/clearmessage` is Owner-only and best-effort. Telegram history/update/deletion behavior prevents a guaranteed full-history purge. Do not treat this utility as a security/data-retention eraser.

## AI master-key contract

`AI_CONFIG_MASTER_KEY` must be a Cloudflare `secret_text` containing Base64 for exactly 32 random bytes.

Changing the key invalidates provider credentials encrypted under the previous key; re-enter those credentials through `/ai` after rotation.

## Manuals

Current manual-related migrations:

- `0009_manuals.sql`
- `0010_manual_newline_cleanup.sql`
- `0013_manual_staff_operations.sql`
- `0014_manual_returning_staff_prompt.sql`
- `0015_owner_manual_main_only_cleanup.sql`

`0015` removes stale TEST guidance from the live Owner manual while preserving the old section bodies in manual revision history.

Manual content remains separate from FAQ knowledge and AI grounding.

## Canonical Worker stack

Wrangler entrypoint: `src/staff_presence_entry.ts`.

1. `staff_presence_entry.ts` — availability, `/noti`, returning-staff reminder, topic reply relay
2. `clear_message_entry.ts` — best-effort Staff Inbox cleanup
3. `manual_entry.ts` — manuals + command sync
4. `deployment_notice_entry.ts` — production ops/deploy notice
5. `latest_return_entry.ts` — latest Return-to-AI control
6. `monitoring_message_entry.ts` — FAQ/AI/handoff + availability-aware copy
7. `staff_ux_entry.ts` — Staff Inbox UX + Sudo invite lifecycle
8. `ux_entry.ts` — edit-in-place FAQ/AI/monitoring navigation + shared close control
9. `secure_entry.ts`
10. `runtime_entry.ts`
11. `index.ts`

## Production workflow contract

`.github/workflows/deploy-production.yml` validates:

- production credentials/runtime bindings
- install/typecheck
- local migrations
- production Worker dry run
- remote D1 migrations
- production Worker deploy
- runtime-binding preservation
- production `/health`
- nonce-gated Owner command resync
- exact Telegram Owner command read-back

## Current migrations

`0001` through `0015`.

Latest: `migrations/0015_owner_manual_main_only_cleanup.sql`.

## Documentation checkpoint

On 2026-08-18, root/docs documentation was reconciled against the live main-only production architecture and updated with the public role-aware FAQ library contract.

## Next exact sequence

No implementation is currently required after this slice.

When a new requirement or verified production defect arrives:

1. reconcile from live `main`
2. inspect only task-relevant source/docs
3. implement a small bounded slice directly on `main`
4. use focused validation plus the single production workflow
5. update `ROADMAP.md` and this file before stopping

## Documentation rule

After every meaningful behavior/architecture/schema/deployment slice, keep `ROADMAP.md` and `NEW_CHAT_BOOTSTRAP.md` synchronized with live repository reality.
