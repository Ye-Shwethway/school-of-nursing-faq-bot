# Human Staff Handoff

Last updated: 2026-08-18

## Goal

Escalate unresolved School of Nursing questions to authorized human staff without exposing staff identities to end users and without mixing different users' conversations in the Staff Inbox.

## Staff Inbox topology

Recommended topology: private Telegram supergroup with Topics enabled.

Bot permissions should include the capabilities required by the enabled operations, including topic management and the group permissions needed by any cleanup/invite features.

Owner can open `/staff` inside the desired group and choose **Use / Switch to this Staff Inbox**. This replaces the active Staff Inbox binding; new handoff/monitoring traffic goes to the new group while old group history remains historical.

## Per-user topic rule

Canonical mapping:

`(telegram_user_id, staff_chat_id) -> message_thread_id`

Routine monitoring, escalation cards, Take Over state, human-control follow-up, and Return to AI controls stay inside that user's topic.

Topic provisioning is protected by `0008_monitoring_topic_provision_lock.sql` so near-simultaneous first messages do not create duplicate topics.

## Escalation flow

When deterministic FAQ and grounded Primary/Fallback AI cannot answer safely:

1. create/retain an escalation case in D1
2. route the case to the configured human destination
3. for group route, use the user's isolated Staff Inbox topic
4. tell the user what happened without exposing internal/provider details

If at least one staff member is available, the user receives normal staff-handoff copy.

If available staff count is zero, the case is still queued but the user is told that staff are currently unavailable and to try again later. The bot must not falsely imply immediate review.

## Staff availability

Authorized staff can use inside the active Staff Inbox:

- `/available`
- `/unavailable`

Active staff without an explicit presence row default to available until they mark themselves unavailable.

If an unavailable staff member later interacts with the bot privately while new open cases are waiting, the bot can show a pending-count reminder with:

- `✅ Mark me Available & Review`
- `⏸ Stay Unavailable`

The same pending set is acknowledged per staff member so the reminder does not repeatedly spam them; a newly-created case can trigger a fresh reminder.

## Notification control

`/noti off` silences Staff Inbox delivery using Telegram's notification-suppression option. It does **not** disable monitoring, remove messages, close cases, or stop handoff routing.

`/noti on` restores normal Staff Inbox notification behavior.

## Take Over and staff reply

Conversation control is atomic. The first authorized claimant wins; another staff member must not silently steal an existing claim.

While human control is active:

- automated FAQ/AI answering for that user pauses
- user follow-up remains associated with that user's topic
- staff replies are relayed to the user's private chat under the neutral label `School of Nursing staff`
- staff Telegram identity is not exposed to the user

Authorized staff may also later write normal text inside a user's Staff Inbox topic. The bot resolves the topic back to the original Telegram user, takes human control when allowed, marks the replying staff member available, and relays the text privately to the user.

If Telegram cannot deliver the private message, the bot reports the delivery problem back into the topic rather than pretending the user received it.

## Return to AI

Only the current claimant or Bot Owner can return a conversation to automation.

The latest human-control USER message carries the `Return to AI` control. New user traffic moves the control to the newest message. Returning to AI or `/reset` clears the current pointer.

## Sudo and Staff Inbox access

Owner `/sudo grant <telegram_user_id>` grants Sudo authority, enables staff authorization, refreshes command scope best-effort, and checks Staff Inbox membership.

If the user is not already a member and a Staff Inbox is configured, the bot creates a one-use invite link when Telegram permissions allow it. It tries to DM the invite to the new Sudo Admin; if that DM is unavailable, the link is returned to the Owner as fallback.

`/sudo revoke` removes Sudo authority and disables bot-side staff authorization. It does not currently auto-remove an already-joined Telegram group member.

## Relevant data

- `bot_settings`: Staff Inbox/routing/monitoring/notification settings and reminder acknowledgements
- `staff_members`: active human responder allow-list
- `staff_presence`: per-staff availability
- `escalation_cases` / `escalation_messages`: handoff lifecycle
- `conversation_control`: per-user AI/human mode and claimant
- `monitoring_topics`: per-user Staff Inbox topic mapping
- `monitoring_topic_provision_locks`: first-topic concurrency guard

## Safety rules

- never expose provider keys, Cloudflare secrets, hidden prompts, or staff identity to end users
- never allow AI to continue after a successful human Take Over
- never mix different users into the Staff Inbox main chat as a topic-creation fallback
- preserve immutable Telegram numeric IDs as authority keys
- never promise a staff response time unless the institution has an explicit SLA
