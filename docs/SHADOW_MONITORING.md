# Shadow Monitoring and Human Takeover

Last updated: 2026-08-18

## Goal

Keep the FAQ assistant autonomous while giving authorized staff a low-noise, user-isolated oversight surface with fast Take Over / Return to AI controls.

## Monitoring modes

Stored in `bot_settings.monitoring_mode`:

- `all_alerts` — mirror routine traffic silently; keep handoff/risk alerts
- `silent_all` — mirror routine traffic silently without routine alerts
- `alerts_only` — no routine mirror; critical handoff/risk only
- `off` — no routine mirror; active human-control delivery and critical handoff remain enabled

Owner can manage these through the `/staff` monitoring UI.

## Notification control is separate

Staff Inbox push-notification behavior is intentionally separate from monitoring mode.

- `/noti on` — normal Staff Inbox notification behavior
- `/noti off` — keep Staff Inbox messages/cases visible but send them silently

Turning notifications off must not disable monitoring, handoff, or case persistence.

## Staff availability is separate

Authorized staff can use:

- `/available`
- `/unavailable`

Availability controls whether the bot may truthfully tell an unresolved user that staff are currently available for follow-up.

When all active staff are unavailable, unresolved cases are still retained/routed, but the user is told staff are unavailable and to try again later.

Returning unavailable staff may receive a private pending-case reminder with inline choices to become available and review, or remain unavailable.

## Staff Inbox topic isolation

The preferred Staff Inbox is a private Telegram supergroup with Topics enabled.

Canonical mapping:

`(telegram_user_id, staff_chat_id) -> message_thread_id`

Each user gets a separate forum topic. Topic titles and message headers carry readable identity plus immutable Telegram user ID.

## Concurrent first-message provisioning

Migration `0008_monitoring_topic_provision_lock.sql` prevents duplicate topics when near-simultaneous first messages arrive for the same user.

Fail-closed rule: if an isolated topic cannot be established, staff-side traffic is not dumped into the Staff Inbox main chat.

## Routine mirror

For `all_alerts` and `silent_all`, incoming USER and outgoing BOT/AI messages may be mirrored into the user's topic, normally silently.

Routine mirror cards expose `Take Over` where appropriate.

## Human Take Over

Conversation control is keyed by Telegram user ID in `conversation_control`.

Take Over is atomic. The first authorized staff member wins.

While human control is active:

- automated FAQ/AI answering for that user stops
- user follow-up remains associated with that user's topic
- staff replies are relayed anonymously under the School of Nursing staff label
- human-control delivery remains available even when routine monitoring is `alerts_only` or `off`

Authorized staff can also later type normal text inside the user's topic. The bot resolves the topic back to the original user, marks the replying staff member available, takes human control when allowed, and relays the reply privately.

## Latest Return to AI control

Migration `0007_latest_control_message.sql` adds `monitoring_topics.latest_control_message_id`.

While human control is active, only the latest mirrored USER message carries `Return to AI`. New user traffic moves the control to the latest message. Returning to AI or `/reset` clears it.

## AI generation race guard

Migration `0006_conversation_control_version.sql` protects against an in-flight AI reply arriving after Take Over/Return-to-AI state changed. The runtime re-checks control mode/version before sending a generated answer.

## Handoff integration

Critical human handoff remains independent of routine monitoring mode and notification setting.

Group-route escalation cards stay inside the same isolated per-user topic.

## Relevant migrations

- `0004_shadow_monitoring.sql`
- `0006_conversation_control_version.sql`
- `0007_latest_control_message.sql`
- `0008_monitoring_topic_provision_lock.sql`
- `0012_staff_presence_notifications.sql`
