# Human Staff Handoff

Last updated: 2026-08-18

## Goal
Escalate unresolved School of Nursing questions to authorized human staff without exposing staff identities to end users and without allowing multiple staff members to answer the same case simultaneously.

## Supported routing modes
Owner controls the human handoff route:

- `auto` — prefer the private Staff Inbox group when configured; otherwise use the dedicated staff responder.
- `group` — send handoff cases only to the Staff Inbox group.
- `dedicated` — send handoff cases only to the assigned staff member's private bot chat.

`auto` is the recommended default because it keeps the group workflow available while providing a no-group fallback.

Owner commands:

- `/staff status`
- `/staff route auto|group|dedicated`
- `/staff inbox here`
- `/staff dedicated <telegram_user_id>`
- `/staff add <telegram_user_id>`
- `/staff remove <telegram_user_id>`

## Staff Inbox workflow
The recommended multi-staff topology is a **private Staff Inbox supergroup**, not a broadcast channel.

Why:
- each staff member has an immutable Telegram user ID available to the bot
- inline Take Over / Resolve controls work naturally
- staff can reply to the bot's case message
- the bot can enforce server-side authorization and ownership of a case
- a plain channel is optimized for broadcasting and is awkward for multi-staff reply ownership

If a channel is required for organizational reasons, use a linked private discussion group for the actual claim/reply workflow.

## Dedicated staff workflow
A Telegram group is optional.

Owner may assign one staff member as the dedicated human responder with:

`/staff dedicated <telegram_user_id>`

Before the assignment is saved, the Worker sends a private probe message to that Telegram user ID. The assignment is accepted only when Telegram confirms the bot can reach the private chat.

Telegram bots cannot initiate a private conversation with an arbitrary user who has never opened the bot. Therefore the staff member must first open the School of Nursing bot and send `/start`.

A successful dedicated assignment also enables that Telegram user ID in `staff_members`.

When a case is routed to the dedicated staff member:

1. Bot sends the case card directly to that staff member's private chat.
2. Staff taps **Take Over**.
3. The case is atomically claimed in D1.
4. Staff replies directly to the case message.
5. Worker relays the answer to the student as `School of Nursing Staff` without revealing staff identity.
6. Staff resolves the case when complete.

The same D1 case ownership and anonymous relay rules are used for group and dedicated routes.

## User experience
When deterministic FAQ and grounded AI cannot answer safely:

1. Create an escalation case in D1.
2. Tell the user that the question has been forwarded to authorized School of Nursing staff.
3. Do not promise a response time.
4. Route the case according to `handoff_route`.

If no valid destination is configured or Telegram delivery fails, the case remains queued in D1 rather than being lost. The Worker also attempts to notify the configured Bot Owner that the queued case was not delivered to a staff destination.

The user never sees the staff member's Telegram identity.

A human response is relayed by the bot using the neutral sender label:

`School of Nursing Staff`

## Staff case card
Case cards may include:

- case ID
- routing mode
- user's language
- Telegram user ID
- username when available
- user name when available
- exact question
- AI handoff reason when safe to expose internally
- prior canonical FAQ match state if relevant

Inline controls:

- `Take Over`
- `Resolve`
- `Release` may be added later for operational reassignment

## Single-responder rule
Claiming is atomic in D1.

Canonical pattern:

```sql
UPDATE escalation_cases
SET status = 'claimed', claimed_by = ?1, claimed_at = CURRENT_TIMESTAMP
WHERE id = ?2
  AND status = 'open'
  AND claimed_by IS NULL;
```

The Worker checks whether the update changed exactly one row.

- first authorized staff member wins
- later Take Over attempts return `Already claimed`
- replies from staff other than the claimant are rejected
- the same rule applies even if multiple staff members tap at nearly the same time

## Anonymous staff reply
A claimant replies directly to the bot's original case message, whether that message is in the Staff Inbox group or a dedicated private staff chat.

Worker logic:

1. map `staff_chat_id + reply_to_message.message_id` to the escalation case
2. verify sender is an active staff member
3. verify case is claimed by that sender
4. relay response to the original user's private chat through the bot
5. store the relay in `escalation_messages`
6. do not expose sender name, username, or Telegram ID to the user

## Busy staff behavior
A staff member does not need to answer immediately.

Cases remain `open` until someone takes ownership and remain `claimed` until explicitly resolved. The user receives no fabricated interim answer and no promised SLA.

A later operations slice may add reminders, stale-case alerts, reassignment, or escalation windows without changing the core handoff model.

## Staff authorization
Human-support membership is separate from Sudo Admin authority.

- `staff_members` controls case claim/reply eligibility
- Sudo Admin remains a privileged administration role
- a person does not need Sudo privileges merely to answer students
- Owner manages staff membership and routing

## Configuration
Operational settings live in `bot_settings`:

- `staff_inbox_chat_id`
- `dedicated_staff_id`
- `handoff_route` = `auto`, `group`, or `dedicated`
- `agent_persona` = `male` or `female`

These identifiers are not credentials, but settings remain Owner-controlled.

## Data
Migration `0003_handoff_persona.sql` adds:

- `bot_settings`
- `staff_members`
- `escalation_cases`
- `escalation_messages`
- case indexes

Dedicated routing requires no additional schema migration because it uses `bot_settings` and the existing case delivery fields.

## Safety rules
- never send provider API keys, Cloudflare secrets, hidden AI prompts, or internal security configuration to staff destinations
- staff sees only information needed to answer the case
- never let AI fabricate a human answer after a case is handed off
- do not reopen automated AI answering for a claimed case unless the case lifecycle explicitly permits it
- resolve/close events remain attributable in D1
