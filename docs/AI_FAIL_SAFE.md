# AI Fail-Safe and Human Continuity

Last updated: 2026-08-18

## Goal
The FAQ bot must remain useful when AI is not configured or when an LLM/provider call fails. AI availability is optional; human continuity is mandatory.

## Canonical runtime order

1. Deterministic canonical FAQ match.
2. If matched, answer from canonical FAQ without calling AI.
3. If not matched, inspect AI availability.
4. If AI is unavailable, route directly to human handoff.
5. If AI is available, try the bound Primary model.
6. If Primary fails technically or returns an unsafe/handoff decision, try the bound Fallback model when configured and usable.
7. If Fallback is absent, fails, times out, returns malformed output, or cannot answer safely, route to human handoff.

## Conditions that must NOT crash the user flow

Treat all of the following as human-handoff conditions, not fatal request errors:

- no AI provider/API key configured
- `AI_CONFIG_MASTER_KEY` missing
- no Primary model bound
- saved credential missing or unreadable
- provider authentication failure
- provider rate limit (`429`)
- provider `5xx`
- network/DNS/fetch failure
- request timeout
- model removed/unavailable
- malformed provider response
- malformed structured AI decision
- Primary model failure
- Fallback model failure
- grounded policy returns `handoff`
- approved context is insufficient or conflicting

## User-facing behavior
Do not expose provider names, API errors, encryption failures, stack traces, or internal configuration.

The user should receive the normal localized human-review message. Do not promise a response time.

## Staff behavior
Create/retain an escalation case and route through the configured human destination:

- Staff Inbox group
- Dedicated staff
- `auto` route (group first, dedicated fallback)

If staff delivery itself fails, keep the case queued in D1 and send the configured Owner a best-effort warning.

## Monitoring behavior
AI outage/failure is a risk event.

- `all_alerts` / `alerts_only`: alert staff normally
- `silent_all`: human handoff still occurs even though routine monitoring is silent
- `off`: critical human handoff still occurs

Monitoring settings may never disable required escalation.

## Primary/Fallback semantics
Fallback is for resilience, not permission to invent an answer.

Both Primary and Fallback use the same strict approved-context policy. If either model cannot establish a grounded answer, it must hand off rather than guess.

## Code contract
`src/ai_fail_safe.ts` provides an explicit AI-availability preflight. Future grounded inference orchestration must use fail-closed behavior: any unexpected AI runtime exception resolves to human handoff rather than a user-visible crash or ungrounded model retry loop.
