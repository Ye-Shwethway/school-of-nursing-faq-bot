# Shadow Monitoring and Human Takeover

Last updated: 2026-08-18

## Goal
Keep the FAQ assistant autonomous while giving authorized staff a low-noise oversight surface and a fast way to stop automation when an answer looks wrong or a user needs direct human attention.

## Default mode
Recommended default: `all_alerts`.

- routine user + bot/AI messages are mirrored silently
- risky/handoff events remain normal Telegram alerts
- staff can inspect the full conversation without receiving a notification for every message

## Monitoring modes
Stored in `bot_settings.monitoring_mode`.

- `all_alerts` — mirror routine traffic silently and keep handoff/risk alerts on
- `silent_all` — mirror routine traffic silently; no extra monitoring alerts
- `alerts_only` — do not mirror routine traffic; only critical handoff/risk delivery remains
- `off` — disable routine monitoring; critical human handoff is still never disabled

Owner controls:

- `/staff monitoring`
- `/staff monitoring all_alerts`
- `/staff monitoring silent_all`
- `/staff monitoring alerts_only`
- `/staff monitoring off`

The `/staff monitoring` menu also exposes inline buttons for the four modes.

## Staff Inbox topics
When a Staff Inbox supergroup is configured, the Worker attempts to create one forum topic per Telegram user using `createForumTopic`.

The D1 `monitoring_topics` table maps:

- user Telegram ID
- Staff Inbox chat ID
- Telegram `message_thread_id`

If forum-topic creation is unavailable, routine mirror delivery falls back to the Staff Inbox main chat rather than blocking the user-facing bot.

## Routine mirror
For `all_alerts` and `silent_all`:

1. incoming user text is mirrored to the Staff Inbox with `disable_notification=true`
2. deterministic FAQ responses are mirrored with `disable_notification=true`
3. later grounded AI responses will use the same mirror path
4. mirror messages include `Take Over`

Routine mirrors are observational only. Staff does not need to claim a conversation merely to read it.

## Human Take Over
`Take Over` is conversation-level control, not only a case-level action.

D1 table: `conversation_control`.

Atomic transition:

```sql
UPDATE conversation_control
SET mode='human', claimed_by=?2, claimed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
WHERE telegram_user_id=?1 AND mode='ai';
```

Only the first authorized staff member wins. Later staff cannot take simultaneous control.

When takeover succeeds:

- automated FAQ/AI answering for that user stops
- the user is told a School of Nursing staff member is handling the conversation
- the claimant can answer from the monitoring topic
- replies are relayed as `School of Nursing Staff`
- claimant identity stays hidden from the user
- `Return to AI` becomes available

Human-control traffic has higher priority than monitoring-notification preferences. Even if routine monitoring is `alerts_only` or `off`, messages required for an already active human takeover must remain deliverable to the claimant.

## Return to AI
Only the current claimant or Bot Owner can return a human-controlled conversation to automation.

The transition clears `claimed_by` and `claimed_at` and restores `mode='ai'`.

The user receives a short notice that the automated assistant is active again.

## Handoff integration
Critical handoff is independent of routine monitoring settings.

If deterministic FAQ and later grounded Primary/Fallback AI cannot answer safely:

- create an escalation case
- route it through configured group/dedicated/auto handoff
- alert staff normally
- `Take Over` on a case also moves that user's conversation into human-control mode

Monitoring `off` must never silently discard a required human escalation.

## Migration
`migrations/0004_shadow_monitoring.sql` adds:

- `conversation_control`
- `monitoring_topics`
- conversation-control mode index

The existing `bot_settings` table from migration 0003 stores the monitoring mode.

## Current boundary
The monitoring control plane is implemented before grounded AI inference orchestration.

Current mirrored automated replies are deterministic FAQ responses. Once grounded AI runtime is wired, its user-facing answer must pass through the same mirror function and expose the same Take Over control.
