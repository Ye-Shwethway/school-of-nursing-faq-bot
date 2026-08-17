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
Foundation, Telegram FAQ MVP core, Owner/Sudo core, Telegram-managed AI provider settings, strict AI policy, Owner-selectable AI persona, dual human-handoff routing, and shadow monitoring / conversation takeover core are implemented on `test`.

Cloudflare live state still has only migration 0001. Migrations 0002, 0003, and 0004 are repository-only and not yet applied live. Test Worker has not yet been successfully deployed.

## Current source surface
- `src/index.ts`
- `src/faq.ts`
- `src/admin.ts`
- `src/ai.ts`
- `src/ai_ping.ts`
- `src/agent_policy.ts`
- `src/persona.ts`
- `src/handoff.ts`
- `src/monitoring.ts`
- `migrations/0001_initial.sql`
- `migrations/0002_ai_settings.sql`
- `migrations/0003_handoff_persona.sql`
- `migrations/0004_shadow_monitoring.sql`
- `docs/FAQ_CONTENT_POLICY.md`
- `docs/AI_SETTINGS.md`
- `docs/AI_AGENT_POLICY.md`
- `docs/HUMAN_HANDOFF.md`
- `docs/SHADOW_MONITORING.md`
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
Runtime policy: `src/agent_policy.ts`.

Structured decision:

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

Grounded inference orchestration is not yet wired. Until it is, deterministic no-match escalates directly to humans.

## AI persona
Owner can choose Male/Female persona from `/ai` inline buttons.

Stored in `bot_settings.agent_persona`.
Persona changes presentation only, never facts, policy, authority, or handoff threshold.

## Human handoff routes
Owner commands:
- `/staff status`
- `/staff route auto|group|dedicated`
- `/staff inbox here`
- `/staff dedicated <telegram_user_id>`
- `/staff add <telegram_user_id>`
- `/staff remove <telegram_user_id>`

Routing:
- `auto`: Staff Inbox group first, dedicated staff fallback
- `group`: Staff Inbox only
- `dedicated`: assigned private responder only

Dedicated assignment is saved only after a successful private Telegram delivery probe. The staff member must previously open the bot / send `/start` if no private bot chat exists yet.

Critical cases remain queued in D1 when no destination accepts delivery; the Worker attempts a private Owner warning.

## Shadow monitoring / takeover
Implemented from migration `0004_shadow_monitoring.sql` and `src/monitoring.ts`.

Recommended default: `all_alerts`.

Owner controls:
- `/staff monitoring`
- `/staff monitoring all_alerts`
- `/staff monitoring silent_all`
- `/staff monitoring alerts_only`
- `/staff monitoring off`
- inline monitoring-mode buttons

Modes:
- `all_alerts`: mirror routine conversation traffic silently; handoff/risk remains normal alert
- `silent_all`: mirror routine traffic silently
- `alerts_only`: no routine mirror; critical handoff remains active
- `off`: no routine monitoring; critical handoff remains active

Staff Inbox monitoring:
- Worker attempts `createForumTopic` once per Telegram user
- `monitoring_topics` persists user → Staff Inbox → `message_thread_id`
- if topic creation is unavailable, mirror delivery falls back to Staff Inbox main chat
- routine mirror messages use Telegram `disable_notification=true`
- user messages and deterministic FAQ responses are currently mirrored
- later grounded AI responses must use the same mirror path

Conversation control:
- `conversation_control.mode` = `ai | human`
- mirror messages expose `Take Over`
- first authorized staff member to atomically move `ai → human` wins
- once human mode is active, automated FAQ/AI replies for that user stop
- claimant can answer from the Staff Inbox topic and bot relays as `School of Nursing Staff`
- claimant identity remains hidden from the user
- `Return to AI` restores automated handling
- current claimant or Owner may perform Return to AI
- case-level Take Over also sets conversation human mode
- resolving the current handoff case returns the conversation to AI

Important precedence contract:
- active human-control traffic outranks monitoring notification preference
- turning routine monitoring off must never cause an already human-controlled user's follow-up to disappear from the claimant workflow
- critical human handoff is independent of shadow-monitoring mode

Docs: `docs/SHADOW_MONITORING.md`.

## D1 migrations
Live:
- `0001_initial.sql` — verified in Cloudflare

Repository-only / not yet live:
- `0002_ai_settings.sql`
- `0003_handoff_persona.sql`
- `0004_shadow_monitoring.sql`

## Verified Cloudflare state
- Account ID: `abd28e59860f09dab81b7e09de467f38`
- D1: `school-of-nursing-faq-bot-db`
- D1 ID: `9109c1ef-3613-49f8-aee3-c62a3dbdd744`
- Region: APAC
- binding name: `DB`
- workers.dev subdomain: `ye-shwethway13`
- no production Worker
- no test Worker yet

First Worker upload was rejected before creation with:
`10021: Can't set compatibility date in the future: 2026-08-18`

No infrastructure drift occurred. Keep compatibility-date changes UTC-safe.

## Validation state
Pending:
- build/type validation of current combined source
- regenerate current deployable Worker artifact
- apply migrations 0002 + 0003 + 0004 live
- deploy test Worker
- configure Telegram test secrets and Owner ID
- live FAQ/language tests
- live Owner/Sudo tests
- live AI provider fetch/ping/binding/persona tests
- live group and dedicated handoff route tests
- forum-topic creation/fallback test
- `disable_notification` shadow mirror test
- multi-staff atomic Take Over test
- claimant-only anonymous topic reply test
- Return to AI test
- grounded Primary/Fallback inference orchestration

Do not merge to `main` yet.

## Next recommended slice
Validate/build the current combined Worker source, then return to Cloudflare MCP: apply migrations 0002–0004, deploy `school-of-nursing-faq-bot-test`, configure minimum test secrets, and validate FAQ + admin + AI settings/persona + handoff + monitoring/takeover runtime. Once those primitives are green, wire grounded Primary/Fallback AI inference through `src/agent_policy.ts` before production merge.
