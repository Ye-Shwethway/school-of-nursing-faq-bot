# Human Staff Handoff

Last updated: 2026-08-18

## Goal
Escalate unresolved School of Nursing questions to authorized human staff without exposing staff identities to end users and without allowing multiple staff members to answer the same case simultaneously.

## Recommended Telegram topology
Use a **private Staff Inbox supergroup**, not a broadcast channel, as the operational inbox.

Why:
- each staff member has an immutable Telegram user ID available to the bot
- inline Claim / Resolve controls work naturally
- staff can reply to the bot's case message
- the bot can enforce server-side authorization and ownership of a case
- a plain channel is optimized for broadcasting and is awkward for multi-staff reply ownership

If a channel is required for organizational reasons, use a linked private discussion group for the actual claim/reply workflow. The group remains the authoritative operational surface.

## User experience
When deterministic FAQ and grounded AI cannot answer safely:

1. Create an escalation case in D1.
2. Tell the user that the question has been forwarded to authorized School of Nursing staff.
3. Do not promise a response time.
4. Post a case card to the Staff Inbox.

The user never sees the staff member's Telegram identity.

A human response is relayed by the bot using a neutral sender label such as:

`School of Nursing Staff`

## Staff case card
Recommended content:

- case ID
- received time
- user's language
- Telegram user ID
- username when available
- user name when available
- exact question
- AI handoff reason when safe to expose internally
- prior canonical FAQ match state if relevant

Inline controls:

- `Claim`
- `Resolve`
- `Release` (optional, for a claimed but unanswered case)

## Single-responder rule
Claiming must be atomic in D1.

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
- later Claim attempts return `Already claimed`
- replies from staff other than the claimant are rejected while the case is claimed
- Owner may override/release a claim if operationally necessary

This prevents two staff members from replying simultaneously even if they tap Claim at nearly the same time.

## Anonymous staff reply
The claimant replies directly to the bot's case message in the Staff Inbox group.

Worker logic:

1. map `reply_to_message.message_id` to `escalation_cases.staff_message_id`
2. verify sender is an active staff member / authorized Owner
3. verify case is claimed by that sender (Owner override optional)
4. relay response to the original user's private chat through the bot
5. store the relay in `escalation_messages`
6. do not expose sender name, username, or Telegram ID to the user

The user receives only the School of Nursing bot identity and the neutral staff label.

## User follow-up
While a case remains open/claimed, a user's follow-up may be appended to the same case and posted into the staff thread instead of opening unnecessary duplicate cases.

A later implementation may use a configurable time window to decide when a new user message creates a new case.

## Staff authorization
Human-support membership is separate from Sudo Admin authority.

- `staff_members` controls case claim/reply eligibility
- Sudo Admin remains a privileged administration role
- a person should not need Sudo privileges merely to answer students
- Owner manages staff membership

## Configuration
Store operational settings in `bot_settings`, including:

- `staff_inbox_chat_id`
- `agent_persona` = `male` or `female`

The staff inbox chat ID is not a credential but should still be managed server-side through Owner-only setup commands.

## Data
Migration `0003_handoff_persona.sql` adds:

- `bot_settings`
- `staff_members`
- `escalation_cases`
- `escalation_messages`
- case indexes

## Safety rules
- never send provider API keys, Cloudflare secrets, hidden AI prompts, or internal security configuration to the staff inbox
- staff sees only information needed to answer the case
- never let AI fabricate a human answer when the case is handed off
- do not reopen automated AI answering for a claimed case unless the case lifecycle explicitly permits it
- resolve/close events should remain auditable
