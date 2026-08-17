# Telegram Commands and Identity

Last updated: 2026-08-18

## Public landing
`/start` is the public School of Nursing landing surface.

It must contain only user-facing actions such as language selection and normal inquiry guidance. Owner/Admin controls must never be mixed into `/start`.

## Public command visibility
Normal users see only:

- `/start`
- `/whoami`

`/language` remains a supported compatibility command but is intentionally hidden from the public command menu because language selection is available through the `/start` UI.

## `/whoami`
Available to every user in the bot's private chat.

The response includes:

- first/last name when Telegram provides them
- `@username` when available
- immutable numeric Telegram user ID

Canonical display format:

`Name (@username) — ID: 123456789`

If no stored name is available:

`Unknown name — ID: 123456789`

The numeric ID is the authority key used when Owner grants Sudo Admin or Staff access. Usernames are never authority.

## Management identity rule
Administrative and staff-management screens must not show a bare Telegram ID when identity metadata is available.

Always display human-readable identity and immutable ID together. This applies to:

- Owner display
- Sudo Admin lists
- grant/revoke confirmations
- Staff lists/status where user metadata is available
- future user lookup and case-management screens

## Role-scoped command menus
The Worker manages Telegram commands through the Bot API rather than requiring manual BotFather updates.

Public/private default:

- `/start`
- `/whoami`

Current Sudo Admin private scope adds:

- `/admin`
- `/admins`

Current Owner private scope adds:

- `/sudo`
- `/ai`
- `/staff`

Owner inherits Admin + public commands.

Only runtime-ready commands are exposed. `/faq` will be added to the Admin/Owner registry when migration 0005 and the dynamic FAQ runtime cutover are complete; adding it to the registry will make it appear automatically without BotFather.

## Automatic synchronization
Command definitions live in `src/command_menu.ts`.

The command-registry fingerprint is derived from the command arrays themselves. When code changes the registry, the first webhook after deployment detects a changed fingerprint and calls Telegram `setMyCommands` to synchronize:

1. public private-chat scope
2. Owner private-chat scope
3. every current Sudo Admin private-chat scope

No BotFather command update is required.

`/start` and `/whoami` also self-heal the current user's role scope.

After `/sudo grant <id>` or `/sudo revoke <id>`, the affected user's private command scope is refreshed immediately.

## Security boundary
Telegram command visibility is UX, not authorization.

All privileged handlers must still verify immutable Telegram user ID and server-side role state. Manually typing a hidden command must never bypass Owner/Admin authorization.

## Failure behavior
Command-menu synchronization is best-effort and non-fatal.

A Telegram command API outage or missing pre-migration `bot_settings` table must not crash FAQ answering, human handoff, or other bot behavior. The next eligible request retries synchronization.
