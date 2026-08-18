# ROADMAP

Last updated: 2026-08-18

## Goal

Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch and deployment policy

- `main` is the single active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- no TEST workflow or TEST deployment is active.
- relevant `main` pushes run the single production validation/deployment workflow automatically.

## Current production checkpoint

Status: **PRODUCTION LIVE; MAIN-ONLY PIPELINE ACTIVE; PUBLIC FAQ LIBRARY + NORMAL-USER COMMAND-SCOPE FIX + LANGUAGE SELECTOR CLEANUP IMPLEMENTED**

Implemented/current:

- multilingual dynamic FAQ
- public `/faq` command for normal users
- role-aware FAQ surface: read-only localized library for normal users; management surface for Owner/Sudo
- localized FAQ labels using approved questions instead of internal slugs
- paginated FAQ browsing with compact two-column rows only when labels are short
- public FAQ detail view limited to the user's selected language
- normal users inherit the global private-chat command scope; stale per-chat command overrides are removed during command-schema synchronization
- visible `/language` for all users
- language selection is one-shot: save choice, show a short callback confirmation, then delete the selector message without sending a second persistent confirmation
- Owner/Sudo roles and scoped command menus
- encrypted configurable AI Primary/Fallback
- grounded AI + human handoff
- Staff Inbox per-user topic monitoring
- Take Over / Return to AI
- Sudo grant with staff authorization and Staff Inbox invite provisioning
- Staff Inbox switching from `/staff`
- Owner `/clearmessage` retained as best-effort only because Telegram deletion/history behavior prevents full-purge guarantees
- `/noti on|off` notification control
- `/available` / `/unavailable` staff presence
- all-staff-unavailable user messaging
- staff-topic reply relay back to the original user
- returning-unavailable staff pending-inquiry reminder with inline availability choice
- editable/addable Owner/Admin manuals
- Owner/Admin manuals updated for current staff operations
- stale TEST deployment guidance removed from Owner manual

## FAQ library UX

`/faq` is public. Normal users can browse only active FAQ entries and never receive Add/Edit/Disable/Restore controls, inactive entries, internal FAQ keys, or revision metadata.

FAQ browsing uses the user's saved Burmese, English, or Simplified Chinese language. Lists are paginated at 8 items per page. Two compact labels may share a row; longer labels receive their own row. Callback navigation uses edit-in-place first and provides `✕ Close`.

Owner/Sudo `/faq` remains the FAQ management entry point with Browse, Add, Inactive, Help, Edit, Disable, and Restore controls.

No schema migration was required; existing `faq_entries` data remains canonical.

## Language selector UX

`/language` opens a one-shot selector in the order `မြန်မာ` · `English` · `简体中文`.

After a valid selection is persisted, the bot acknowledges it through the callback toast and deletes the selector message. It does not leave the old selector behind and does not send a second persistent confirmation message. Users can reopen the selector at any time with `/language`.

## Command registry

Public (4):

`/start`, `/language`, `/faq`, `/whoami`

Sudo Admin additionally:

`/admin`, `/admins`, `/adminmanual`, `/noti`, `/available`, `/unavailable`

Owner additionally:

`/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`

Expected Owner total remains **17**. Command schema revision: **7**.

Normal users must not retain chat-specific command lists. `syncUserCommandScope()` clears a normal user's per-chat scope so Telegram falls back to the global `all_private_chats` public registry. Schema synchronization also removes stale overrides for already-known normal users, fixing command menus that were created before `/faq` became public.

Privileged command ordering remains compatible with the production exact Owner read-back contract.

## Staff notifications and availability

Migration `0012_staff_presence_notifications.sql` adds `staff_presence` and `staff_notifications_enabled`.

Active Staff Inbox commands:

- `/noti on` — normal Staff Inbox notification behavior
- `/noti off` — keep messages/cases visible but send them silently
- `/available` — mark current authorized staff available
- `/unavailable` — mark current authorized staff unavailable

Active staff without an explicit presence row default to available until they mark unavailable.

## Human continuity

When deterministic FAQ and grounded Primary/Fallback AI cannot answer:

- escalation remains stored and routed
- if at least one active staff member is available, user receives normal staff-handoff copy
- if available staff count is zero, user is told staff are currently unavailable, the question is retained, and they should try again later

Authorized staff can later reply inside that user's Staff Inbox topic. The bot maps the topic back to the original Telegram user, takes human control when allowed, marks the replying staff member available, and relays the staff text to the user's private chat without exposing staff identity.

## Returning unavailable staff prompt

When an authorized staff member is still marked unavailable and later interacts with the bot privately, the bot checks for open escalation cases. New pending cases can trigger the inline `Mark me Available & Review` / `Stay Unavailable` reminder, with per-staff acknowledgement preventing repeated spam for an unchanged pending set.

## Manuals

Manual storage/revision foundation:

- `0009_manuals.sql`
- `0010_manual_newline_cleanup.sql`
- `0013_manual_staff_operations.sql`
- `0014_manual_returning_staff_prompt.sql`
- `0015_owner_manual_main_only_cleanup.sql`

`0015` archives the old Owner deployment/safety bodies in manual revision history and replaces stale TEST guidance with the current main-only production model.

## AI configuration contract

`AI_CONFIG_MASTER_KEY` must be a Cloudflare `secret_text` containing Base64 for exactly 32 random bytes. Credentials encrypted with an older key must be re-entered through `/ai` after key rotation.

## Sudo access

Owner `/sudo grant <telegram_user_id>` grants Sudo authority, enables staff authorization, refreshes command scope best-effort, and provisions a one-use Staff Inbox invite when needed.

`/sudo revoke` removes Sudo authority and disables bot-side staff authorization. Automatic removal of an already-joined Telegram group member is not currently enabled.

## Staff Inbox cleanup

`/clearmessage` is Owner-only and best-effort. It must not be treated as a guaranteed full-history purge.

## Single production workflow

Canonical workflow: `.github/workflows/deploy-production.yml`.

Relevant `main` pushes perform production binding preflight, install/typecheck, local migration validation, Worker dry-run, remote migrations, deploy, binding postflight, `/health`, nonce-gated Owner command resync, and exact 17-command Owner read-back.

The production `/health` path invokes command-registry synchronization, so command schema revision 7 applies the public registry and stale normal-user scope cleanup during deployment validation.

## Canonical Worker stack

Wrangler entrypoint: `src/staff_presence_entry.ts`.

1. staff availability / `/noti` / returning-staff reminder / topic reply relay
2. best-effort Staff Inbox cleanup
3. manuals + command synchronization
4. production deploy notice / ops endpoints
5. latest Return-to-AI control
6. monitoring / FAQ / AI / human handoff
7. Staff Inbox UX + Sudo invite lifecycle
8. Telegram UX/navigation polish
9. secure AI setup interception + one-shot language callback cleanup
10. dynamic FAQ/AI runtime
11. compatibility fallback + `/health`

## Current migrations

`0001` through `0015`.

Latest canonical migration: `migrations/0015_owner_manual_main_only_cleanup.sql`.

## Next work

No additional feature slice is active after the language-selector cleanup. Continue from a new explicit product requirement or verified production defect.

When new work begins, use live repository and verified production evidence as authority, implement on `main` in small bounded slices, and update this file plus `NEW_CHAT_BOOTSTRAP.md` after meaningful changes.

## Deferred validation / optional future work

- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
- optional policy: automatically remove a revoked Sudo Admin from the Telegram Staff Inbox group
