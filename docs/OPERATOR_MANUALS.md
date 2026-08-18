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
- Owner can edit existing sections
- Owner can add new sections
- Sudo Admins and normal users cannot open it

`/adminmanual`:
- Owner can read, edit, and add sections
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
- Owner-only `＋ Add new section`
- `✕ Close`

Previous/Next uses `editMessageText`, so the same message is reused and the chat stays clean.

## Editing an existing section
Owner flow:
1. open `/ownermanual` or `/adminmanual`
2. navigate to the section
3. tap `Edit this section`
4. send the complete replacement text in one message
5. review the preview
6. press `Save` or `Discard`

Each saved edit increments the section version and stores the prior version in `manual_revisions`.

## Adding a new section
Owner flow:
1. open `/ownermanual` or `/adminmanual`
2. tap `＋ Add new section`
3. send the new section title
4. send the complete section body
5. review the preview
6. press `✓ Add section` or `Discard`

The bot generates the internal section key automatically and appends the new section to the end of that manual. The Owner does not need to manage keys or ordering values.

`/cancel` abandons an active edit or add-section flow before save.

Section body text is limited to 3,500 characters and section titles to 120 characters for clean Telegram rendering.

## Storage
Migration `migrations/0009_manuals.sql` creates:
- `manual_sections`
- `manual_revisions`

Migration `migrations/0010_manual_newline_cleanup.sql` converts legacy literal `\\n` seed sequences into real line breaks in D1.

No additional schema migration is required for Add Section; new sections use the existing `manual_sections` table.

`src/manual_store.ts` normalizes legacy `\\n` sequences on read/save and provides both create and update operations.

Manual data is intentionally separate from:
- `faq_entries`
- FAQ revisions
- deterministic FAQ matching
- AI grounding context

Editing or adding manual sections must never change what the bot treats as approved School knowledge.

## Runtime files
- `src/manual_store.ts` — manual persistence, section creation, newline normalization and revisions
- `src/manual_entry.ts` — Telegram commands, authorization, single-message pager, edit/add preview/save/discard

The manual layer sits outside the existing runtime stack and passes unrelated traffic through unchanged.
