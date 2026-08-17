# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Development branch: `test`
Canonical branch: `main`

## Startup sequence
Read in order:
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. task-relevant docs/source only

Treat live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Branch contract
- work on `test`
- do not implement directly on `main`
- validation Worker: `school-of-nursing-faq-bot-test`
- production Worker after validated merge: `school-of-nursing-faq-bot`

## Current checkpoint
Foundation, Telegram FAQ MVP core, Owner/Sudo core, Telegram-managed AI provider settings, strict AI policy, Owner-selectable AI persona, and dual human-handoff routing are implemented on `test`.

Cloudflare live state still has only migration 0001. Migrations 0002 and 0003 are repository-only and not yet applied live. Test Worker has not yet been successfully deployed.

## Current source surface
- `src/index.ts`
- `src/faq.ts`
- `src/admin.ts`
- `src/ai.ts`
- `src/ai_ping.ts`
- `src/agent_policy.ts`
- `src/persona.ts`
- `src/handoff.ts`
- `migrations/0001_initial.sql`
- `migrations/0002_ai_settings.sql`
- `migrations/0003_handoff_persona.sql`
- `docs/FAQ_CONTENT_POLICY.md`
- `docs/AI_SETTINGS.md`
- `docs/AI_AGENT_POLICY.md`
- `docs/HUMAN_HANDOFF.md`
- `docs/TELEGRAM_DESIGN_RULES.md`
- `docs/CLOUDFLARE_HANDOFF.md`

`deploy/worker.mjs` is stale Foundation-only code. Do not deploy it as the current application build.

## FAQ core
- 22 FAQ records
- Burmese source facts authoritative
- English + Simplified Chinese translation layers
- deterministic matching before AI
- `/start`, `/language`
- D1 language persistence
- canonical answer logging
- unresolved logging

Canonical source: `SCHOOL of Nursing FAQ.docx`.

## Owner / Sudo core
- Owner identity: immutable numeric ID from `BOT_OWNER_TELEGRAM_ID`
- `/admin`, `/admin status`, `/admin help`, `/admins`
- Owner-only `/sudo grant <id>` and `/sudo revoke <id>`
- privileged mutations audited

## AI settings
Owner-only `/ai`.

Providers/modes:
- OpenAI
- Anthropic
- Google Gemini
- OpenRouter
- Groq
- Mistral
- NanoGPT Subscription only
- NanoGPT Subscription + Paid/all-visible
- Custom OpenAI-compatible HTTPS

Flow:
provider → encrypted key → fetch models → select model → Test Ping → bind Primary/Fallback.

Primary and fallback may use different providers.

NanoGPT uses one shared encrypted credential but separate route IDs:
- `nanogpt_subscription`
- `nanogpt_all`

Required Cloudflare secret:
`AI_CONFIG_MASTER_KEY` = base64 encoding of exactly 32 random bytes.

## AI policy
Runtime policy implementation: `src/agent_policy.ts`.

Structured output:

```json
{
  "action": "answer" | "handoff",
  "answer": "user-facing response",
  "reason": "short internal reason"
}
```

Rules:
- School of Nursing scope only
- approved context is the only authority for school-specific facts
- never invent/estimate/infer missing policy facts
- missing, ambiguous, conflicting, exception-specific, or current-status facts → handoff
- malformed model output is unsafe
- never fabricate a human staff response

Grounded inference orchestration is not yet wired. Until it is, deterministic no-match currently escalates directly to humans.

## AI persona
Owner can select from `/ai` inline buttons:
- Male persona
- Female persona

Stored in `bot_settings` as `agent_persona`.

Persona changes presentation only. It cannot change facts, policy, authority, or handoff threshold.

## Human handoff routes
Human-support membership is separate from Sudo Admin authority.

Owner commands:
- `/staff status`
- `/staff route auto|group|dedicated`
- `/staff inbox here`
- `/staff dedicated <telegram_user_id>`
- `/staff add <telegram_user_id>`
- `/staff remove <telegram_user_id>`

Routing modes:
- `auto`: use Staff Inbox group when configured, otherwise dedicated staff
- `group`: Staff Inbox group only
- `dedicated`: assigned staff private chat only

Recommended default: `auto`.

### Group workflow
Recommended operational surface is a private Telegram supergroup.

1. Owner creates private Staff Inbox group manually.
2. Add bot with adequate permissions.
3. Owner sends `/staff inbox here` in the group.
4. Owner adds staff IDs.
5. Escalation card arrives with `Take Over`.
6. First successful atomic claim wins.
7. Claimant replies directly to original case message.
8. Bot relays privately to user as `School of Nursing Staff`.
9. Claimant resolves case.

### Dedicated staff workflow
A group is optional.

Owner assigns one responder with:
`/staff dedicated <telegram_user_id>`

The bot first sends a private probe message. Assignment is saved only when Telegram confirms private delivery.

The staff member must previously open the bot and send `/start`; Telegram bots cannot begin an arbitrary private chat with a user who has never initiated the bot.

Once assigned:
- escalation case card goes to the staff member's private bot chat
- staff taps `Take Over`
- atomic D1 claim applies exactly as in group mode
- staff replies to the case message
- bot relays anonymously to user
- staff resolves the case

The same `staff_chat_id + staff_message_id + claimed_by` mapping authorizes replies in both group and private modes.

If no valid destination exists or a staff notification cannot be delivered:
- escalation case remains queued in D1
- user is not given a fabricated answer or response-time promise
- Worker attempts a private warning to the configured Owner

Tables from migration 0003:
- `bot_settings`
- `staff_members`
- `escalation_cases`
- `escalation_messages`

Dedicated routing uses existing `bot_settings`; no migration beyond 0003 is required.

## Monitoring direction
Approved design direction, not yet fully implemented:
- default monitoring mode should be `All + Alerts`
- user and bot/AI messages silently mirror to Staff Inbox topics when group monitoring is enabled
- normal mirrors should be silent/no notification
- handoff/risky/error events should alert
- staff may `Take Over`; atomic ownership pauses automated replies for that conversation
- claimant handles anonymous replies
- later `Return to AI`/`Resolve` restores lifecycle as appropriate

This shadow-monitoring layer is still pending implementation.

## Verified Cloudflare state
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- binding name: `DB`
- live migration 0001 verified
- workers.dev subdomain: `ye-shwethway13`
- no production Worker
- no test Worker yet

First Worker upload was rejected before creation with:
`10021: Can't set compatibility date in the future: 2026-08-18`

No infrastructure drift occurred. Keep future compatibility-date changes UTC-safe.

## Validation state
Pending:
- build/type validation of current combined source
- regenerate current deployable Worker artifact
- apply migrations 0002 + 0003 live
- deploy test Worker
- configure Telegram test secrets and Owner ID
- live FAQ/language tests
- live Owner/Sudo tests
- live AI provider fetch/ping/binding/persona tests
- live Staff Inbox route test
- live dedicated-staff route test
- multi-staff atomic claim test
- anonymous staff reply/resolve test
- grounded Primary/Fallback inference orchestration
- silent shadow monitoring + alert/takeover workflow

Do not merge to `main` yet.

## Next recommended slice
Prepare and validate a current Worker build, then return to Cloudflare MCP: apply migrations 0002 + 0003, deploy `school-of-nursing-faq-bot-test`, configure minimum test secrets, and validate foundation + FAQ + admin + AI settings/persona + both human-handoff routes. Then wire grounded AI inference and shadow monitoring before production merge.
