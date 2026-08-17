# Telegram FAQ Management

Last updated: 2026-08-18

## Goal
Allow the Bot Owner and Sudo Admins to maintain FAQ knowledge directly from Telegram while keeping deterministic matching, AI grounding, audit history, and administrator notifications synchronized.

## Authority
FAQ CRUD is available to:

- Bot Owner
- Sudo Admins

Staff responders do not automatically receive FAQ-edit authority.

Authority is based on immutable numeric Telegram user ID.

## Runtime source of truth
After migration `0005_dynamic_faq.sql` is applied and the runtime switch is enabled, active rows in D1 `faq_entries` are the canonical runtime FAQ source.

`src/faq.ts` remains the initial bootstrap seed and safe code-level fallback during migration/deployment transition. It is not intended to remain the long-term live editing surface.

On first D1-backed use, if `faq_entries` is empty, the Worker seeds the existing canonical FAQ records from `src/faq.ts`.

## Telegram UI
Entry command:

`/faq`

Top-level actions:

- List FAQs
- Add FAQ
- Inactive
- Help

Selecting an FAQ provides:

- View
- Edit
- Disable
- Restore

Edit fields:

- Burmese question
- Burmese answer
- English question
- English answer
- Simplified Chinese question
- Simplified Chinese answer
- Burmese keywords
- English keywords
- Simplified Chinese keywords

Add uses a guided multilingual wizard instead of requiring JSON or database syntax.

## Delete semantics
FAQ deletion is soft-delete only.

`Disable` sets `active=0`.

Disabled FAQs:

- are excluded from deterministic matching
- are excluded from AI approved context
- remain available for revision history and restore

`Restore` reactivates the same FAQ key and creates a new version.

## Version and audit history
Every create, update, disable, and restore:

1. increments or establishes FAQ version
2. stores before/after snapshots in `faq_revisions`
3. records the actor Telegram user ID
4. records a timestamp

This provides rollback/review evidence for policy-sensitive knowledge changes.

## Change notifications
After a successful FAQ mutation, the Worker should fan out a change summary to:

- Bot Owner private chat
- every current Sudo Admin private chat
- configured Staff Inbox group, when available

Notification delivery is best-effort and does not roll back a committed FAQ change.

An admin may need to open the bot once before Telegram permits private bot delivery.

Change summary includes:

- action
- FAQ key
- new version
- active/inactive state
- actor Telegram ID
- current multilingual question labels

## Deterministic matcher synchronization
The D1-backed matcher reads active FAQ rows from `faq_entries`.

There is no manual rebuild step after CRUD.

A saved FAQ edit becomes eligible for deterministic matching on the next request.

## AI knowledge synchronization
The grounded AI agent must not use a static knowledge prompt.

For each AI request, the Worker builds approved context from current active D1 FAQs using `buildApprovedFaqContext()`.

Therefore:

- new FAQ → automatically available to AI
- edited FAQ → updated wording/facts used on next AI call
- disabled FAQ → immediately excluded from AI grounding
- restored FAQ → automatically returns to AI grounding

No vector database is required at the current FAQ scale.

## Safety
- AI remains downstream of deterministic FAQ matching.
- D1 active FAQ content is the only approved school-specific context supplied to AI.
- Disabled content must never remain in AI grounding context.
- CRUD permission does not grant AI provider/security settings permission beyond the user's existing role.
- API keys, hidden prompts, and infrastructure secrets never appear in FAQ content/change notifications.
- Policy-sensitive edits remain auditable through revisions and admin notifications.

## Migration
`migrations/0005_dynamic_faq.sql` adds:

- `faq_entries`
- `faq_revisions`
- active/update index
- revision-history index

## Implementation files
- `src/faq_store.ts` — D1 seed/load/match/context/CRUD/revisions
- `src/faq_admin.ts` — Telegram CRUD UI/wizard core
- `src/faq_notify.ts` — Owner/Admin/Staff-Inbox mutation notifications

## Deployment transition
Before switching production runtime from `src/faq.ts` to D1:

1. apply migration 0005 on the test D1
2. seed and verify all canonical FAQ records
3. verify active FAQ count and sample multilingual rows
4. wire deterministic matching to `findFaqDynamic()`
5. wire AI grounding to `buildApprovedFaqContext()`
6. wire `/faq` command/callback/text handlers and mutation notifications into `src/index.ts`
7. run CRUD + notification + matcher + AI-context tests
8. only then merge to `main`
