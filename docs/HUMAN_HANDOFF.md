# Human Staff Handoff

Last updated: 2026-08-18

## Goal
Escalate unresolved School of Nursing questions to authorized human staff without exposing staff identities to end users and without mixing different users' conversations in the Staff Inbox.

## Routing modes
Owner controls:

- `auto` — prefer Staff Inbox group when configured; otherwise dedicated responder
- `group` — Staff Inbox group only
- `dedicated` — assigned staff member's private bot chat only

The `/staff` inline control panel is the preferred UX. Legacy commands such as `/staff status`, `/staff route ...`, `/staff inbox here`, `/staff dedicated <id>`, `/staff add <id>`, and `/staff remove <id>` remain supported.

## Staff Inbox setup
Recommended topology: private Telegram supergroup with Topics enabled.

Bot permissions needed for the current workflow:
- bot is an administrator
- Manage Topics
- Delete Messages is recommended for UI cleanup

Owner can open `/staff` inside the group and tap **Set this group as Staff Inbox**. The current Telegram group ID is captured automatically; manual ID copy/paste is not required. Binding also selects group routing and keeps Owner available as staff.

## Per-user topic rule
Group handoff and monitoring are user-isolated.

Canonical mapping:

`(telegram_user_id, staff_chat_id) -> message_thread_id`

A user's routine monitoring, escalation card, Take Over state, human-control follow-up, and Return to AI controls stay in that user's topic.

Topic title example:

`Mg Mg · @username · ID 123456789`

Message headers also carry identity/model context so staff can recognize the actor without scrolling to the topic title.

## Same-user concurrent first-message protection
Migration `0008_monitoring_topic_provision_lock.sql` prevents two near-simultaneous first messages from the same user from creating duplicate forum topics.

Only one request may provision that user's topic. Other concurrent requests wait for the canonical D1 mapping. If topic provisioning fails, group delivery fails closed rather than falling back to the Staff Inbox main chat.

## Dedicated responder
Owner may assign one staff member with `/staff dedicated <telegram_user_id>`.

The Worker probes that private chat before saving the assignment. Telegram bots cannot initiate a private chat with a user who has never opened the bot, so staff must first open the bot and send `/start`.

## Escalation flow
When deterministic FAQ and grounded AI cannot answer safely:
1. create an escalation case in D1
2. tell the user the question has been forwarded for staff review without promising an SLA
3. route according to `handoff_route`
4. for group route, post the case card inside the user's isolated forum topic
5. for dedicated route, post directly to the assigned responder

If no valid destination accepts delivery, the case remains queued in D1 rather than being silently lost.

## Take Over and anonymous reply
Claiming remains atomic in D1. First authorized claimant wins.

After Take Over:
- automated FAQ/AI for that user pauses
- user follow-up stays in that user's topic
- claimant replies are relayed to the user as `School of Nursing Staff`
- claimant Telegram identity is not exposed to the user

## Return to AI
Only the current claimant or Bot Owner can return the conversation to automation.

While human control is active, only the latest mirrored USER message carries the `Return to AI` button. New user traffic moves the button to the newest message and removes it from the previous one. Returning to AI or `/reset` cleans up the latest button.

## Staff authorization
Human responder membership and Sudo Admin authority are separate:
- `staff_members` controls human claim/reply eligibility
- `admin_roles` controls Sudo Admin authority
- Owner manages both surfaces

## Relevant data
- `bot_settings`: Staff Inbox ID, dedicated responder ID, route, monitoring mode
- `staff_members`: human responder allow-list
- `escalation_cases` / `escalation_messages`: handoff lifecycle and relay log
- `conversation_control`: per-user AI/human mode and claimant
- `monitoring_topics`: per-user Staff Inbox topic mapping
- `monitoring_topic_provision_locks`: first-topic concurrency guard

## Safety rules
- never expose provider keys, Cloudflare secrets, hidden prompts, or security configuration to staff destinations
- never allow AI to continue answering after a successful human Take Over
- never mix different users into the Staff Inbox main chat as a topic-creation fallback
- preserve immutable Telegram numeric IDs as the authority key
