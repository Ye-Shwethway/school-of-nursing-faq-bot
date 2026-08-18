# Telegram Commands and Identity

Last updated: 2026-08-18

## Identity rule

Immutable Telegram numeric user ID is the authority key. Usernames and display names are metadata only.

`/whoami` is available to every user and should display human-readable identity together with the numeric ID when possible.

## Public command menu

All users see:

- `/start`
- `/language`
- `/whoami`

`/language` is intentionally visible so users can change interface language without reopening `/start`.

## Sudo Admin command menu

Sudo Admin inherits the public commands and adds:

- `/admin`
- `/admins`
- `/faq`
- `/adminmanual`
- `/noti`
- `/available`
- `/unavailable`

`/noti`, `/available`, and `/unavailable` are operational Staff Inbox commands. They are valid only where the handler's server-side authorization/context rules permit them.

## Owner command menu

Owner inherits the Sudo/Public set and additionally has:

- `/sudo`
- `/ai`
- `/staff`
- `/clearmessage`
- `/ownermanual`
- `/cancel`
- `/reset`

Expected Owner command count: **17**.

Canonical order:

`start`, `language`, `whoami`, `admin`, `admins`, `faq`, `adminmanual`, `noti`, `available`, `unavailable`, `sudo`, `ai`, `staff`, `clearmessage`, `ownermanual`, `cancel`, `reset`.

## Command synchronization

Definitions live in `src/command_menu.ts` and are synchronized through Telegram Bot API scopes. Command schema revision is currently `5`.

The production workflow performs an exact Owner command read-back after deployment. A menu is not considered canonical merely because commands were submitted; production verification must match the expected set and order.

Role changes also refresh the affected user's private command scope best-effort.

## Operational command semantics

- `/noti on|off` — enable/disable Staff Inbox push notifications without discarding group messages/cases.
- `/available` — mark the authorized staff member available.
- `/unavailable` — mark the authorized staff member unavailable.
- `/clearmessage` — Owner-only best-effort recent Staff Inbox cleanup; Telegram history/deletion limitations mean it is not a guaranteed full purge.
- `/cancel` — cancel the current setup/edit wizard only.
- `/reset` — clear transient conversation control/session state and return to AI mode; it does not erase persistent FAQ/AI/role configuration.

## Management display rule

Administrative screens should show readable identity plus immutable ID together whenever metadata is available. This applies to Owner, Sudo Admins, staff, grants/revokes, and case/user management.

## Security boundary

Telegram command visibility is UX, not authorization. Every privileged handler must verify numeric Telegram identity and server-side role/state. Manually typing a command must never bypass authority or Staff Inbox context checks.
