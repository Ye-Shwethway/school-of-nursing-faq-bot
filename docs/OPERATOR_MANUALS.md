# Owner and Admin Manuals

Last updated: 2026-08-18

## Purpose
The bot includes two in-Telegram operating manuals that are separate from FAQ knowledge:

- `/ownermanual` — Bot Owner only
- `/adminmanual` — Bot Owner and Sudo Admins

These manuals explain the bot in plain operational language rather than technical implementation terms.

## Content scope
The manuals explain:
- how the Bot, AI, and Human Staff layers work together
- what happens from a user question through FAQ, AI, and human handoff
- role-appropriate commands and how to use them
- FAQ maintenance
- AI configuration awareness
- Staff Inbox and Take Over / Return to AI
- deployment-online notifications
- safety and authority boundaries

## Permissions
`/ownermanual`:
- Owner can read
- Owner can edit
- Sudo Admins and normal users cannot open it

`/adminmanual`:
- Owner can read and edit
- Sudo Admins can read and navigate pages only
- normal users cannot open it

Authorization is checked server-side using Telegram numeric identity and the existing role system.

## Pager UX
Manual browsing uses one Telegram message instead of emitting one message for every section.

Opening a manual shows one section and inline controls:
- `◀ Previous`
- current page indicator such as `2/8`
- `Next ▶`
- Owner-only `✎ Edit this section`
- `✕ Close`

Previous/Next uses `editMessageText`, so the same message is reused and the chat stays clean.

## Editing workflow
Manuals are section-based so the Owner can update only the part that changed.

Owner flow:
1. open `/ownermanual` or `/adminmanual`
2. navigate to the section
3. tap `Edit this section`
4. send the complete replacement text in one message
5. review the preview
6. press `Save` or `Discard`

`/cancel` abandons an active manual edit before save.

Section text is limited to 3,500 characters to keep Telegram rendering clean.

## Storage
Migration `migrations/0009_manuals.sql` creates:
- `manual_sections`
- `manual_revisions`

Migration `migrations/0010_manual_newline_cleanup.sql` converts legacy literal `\\n` seed sequences into real line breaks in D1.

`src/manual_store.ts` also normalizes legacy `\\n` sequences on read/save for compatibility.

Every saved section increments its version and stores the prior version in `manual_revisions`.

Manual data is intentionally separate from:
- `faq_entries`
- FAQ revisions
- deterministic FAQ matching
- AI grounding context

Editing a manual must never change what the bot treats as approved School knowledge.

## Runtime files
- `src/manual_store.ts` — manual persistence, newline normalization and revisions
- `src/manual_entry.ts` — Telegram commands, authorization, single-message pager, edit preview/save/discard

The manual layer sits outside the existing runtime stack and passes unrelated traffic through unchanged.
