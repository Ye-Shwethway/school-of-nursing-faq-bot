# AI Fail-Safe and Human Continuity

Last updated: 2026-08-18

## Goal

The FAQ bot must remain useful when AI is not configured or when a provider/model call fails. AI availability is optional; safe continuity is mandatory.

## Canonical runtime order

1. deterministic approved FAQ match
2. if no match, grounded Primary AI when configured
3. grounded Fallback AI when Primary is unavailable/fails/cannot answer safely
4. human handoff when automation still cannot answer safely

Any unexpected AI runtime failure resolves to handoff rather than an ungrounded answer or user-visible crash.

## Conditions that must not crash the user flow

Treat these as fail-safe/handoff conditions:

- no AI provider/API key configured
- `AI_CONFIG_MASTER_KEY` missing or invalid
- no Primary model bound
- unreadable/missing saved credential
- provider authentication/rate-limit/5xx/network/timeout failure
- removed/unavailable model
- malformed provider response
- malformed structured AI decision
- insufficient or conflicting approved context
- Primary and/or Fallback failure
- grounded policy returns `handoff`

## User-facing behavior

Never expose provider names, API errors, encryption failures, stack traces, secrets, or internal configuration.

If at least one authorized active staff member is available, use the normal localized human-handoff message without promising a response time.

If available staff count is zero, the escalation is still retained, but the user must be told that staff are currently unavailable and that they should try again later. Do not imply immediate staff review when nobody is available.

## Staff continuity

Create/retain the escalation case and route it through the configured human destination even when all staff are unavailable.

For Staff Inbox group routing, the case stays in the user's isolated topic so staff can review it later.

When staff return, they can:

- mark themselves `/available`
- respond inside the user's topic and have the bot relay the response back to the user's private chat
- receive a pending-case reminder in private chat if they are still marked unavailable and new open cases are waiting

## Notification behavior

`/noti off` only suppresses Telegram push notifications for Staff Inbox delivery. It must not disable case persistence or required handoff.

Monitoring mode and Staff Inbox notification mode are separate controls.

## Primary/Fallback semantics

Fallback is for resilience, not permission to invent an answer.

Both Primary and Fallback use the same approved-context policy. If a grounded answer cannot be established, the correct outcome is handoff.

## Security

AI/setup errors shown to operators must not leak API keys, `AI_CONFIG_MASTER_KEY`, Telegram secrets, Cloudflare credentials, hidden prompts, or private unrelated D1 records.
