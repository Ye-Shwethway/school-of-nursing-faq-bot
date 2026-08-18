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

Owner can manage these from the `/staff` inline control panel or legacy `/staff monitoring ...` commands.

## Staff Inbox topic isolation
The Staff Inbox should be a private Telegram supergroup with Topics enabled and the bot allowed to manage topics.

Canonical mapping:

`(telegram_user_id, staff_chat_id) -> message_thread_id`

Each Telegram user therefore gets a separate forum topic. Topic titles carry the user's current identity:

`Name · @username · ID 123456789`

Routine message headers are self-describing:

- `USER · Name (@username) · ID 123456789`
- `BOT · FAQ`
- `AI · provider/model`
- `USER · Name (@username) · ID 123456789 · Human control`

The immutable numeric Telegram ID remains the authority key even if a username or display name changes.

## Concurrent first-message provisioning
Migration `0008_monitoring_topic_provision_lock.sql` adds `monitoring_topic_provision_locks`.

`src/monitoring_target.ts` is the shared topic provisioner for normal monitoring, handoff, and human-control traffic.

For a user's first concurrent messages:
1. check the canonical `monitoring_topics` mapping
2. atomically claim `(telegram_user_id, staff_chat_id)` provisioning in D1
3. only the claimant may call Telegram `createForumTopic`
4. concurrent requests wait briefly for the canonical mapping instead of creating a duplicate
5. abandoned locks older than 30 seconds are recoverable
6. the lock is released after success or failure

**Fail-closed rule:** if an isolated topic cannot be established, monitoring/handoff traffic is not dumped into the Staff Inbox main chat. User-facing FAQ/AI service may continue, but staff-side user conversations must not be mixed.

## Routine mirror
For `all_alerts` and `silent_all`, incoming USER and outgoing BOT/AI messages are mirrored into that user's topic with `disable_notification=true` where appropriate.

Routine mirror cards expose `Take Over`.

## Human Take Over
Conversation control is keyed by Telegram user ID in `conversation_control`.

Take Over is atomic. Only the first authorized staff member wins; other staff cannot simultaneously control the same user.

While human control is active:
- automated FAQ/AI answering for that user stops
- the user's new messages stay inside that user's monitoring topic
- staff replies are relayed anonymously as `School of Nursing Staff`
- human-control delivery remains available even if routine monitoring is `alerts_only` or `off`

## Latest Return to AI control
Migration `0007_latest_control_message.sql` adds `monitoring_topics.latest_control_message_id`.

While human control is active:
- the newest mirrored USER message carries `Return to AI`
- when another USER message arrives, the new message is sent first
- only after that succeeds is the old inline keyboard removed
- the latest message ID becomes the new control pointer
- returning to AI or `/reset` clears the latest button

This keeps the control at the bottom of a long staff conversation without leaving duplicate buttons on older messages.

## AI generation race guard
Migration `0006_conversation_control_version.sql` adds `conversation_control.control_version`.

Take Over, Return to AI, and `/reset` increment the version. Grounded AI captures mode/version before provider work and re-checks before sending a reply. An in-flight answer is discarded if conversation control changed while the model was running.

## Handoff integration
Group-route escalation cards are delivered inside the same isolated per-user topic. Dedicated-route escalation remains a private staff-chat path.

Critical handoff remains independent of routine monitoring mode.

## Relevant migrations
- `0004_shadow_monitoring.sql` — `conversation_control`, `monitoring_topics`
- `0006_conversation_control_version.sql` — stale-AI generation guard
- `0007_latest_control_message.sql` — latest Return-to-AI pointer
- `0008_monitoring_topic_provision_lock.sql` — same-user first-topic race guard
