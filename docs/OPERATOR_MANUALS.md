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
- Sudo Admins can read only
- normal users cannot open it

Authorization is checked server-side using Telegram numeric identity and the existing role system.

## Editing workflow
Manuals are section-based so the Owner can update only the part that changed.

Owner flow:
1. open `/ownermanual` or `/adminmanual`
2. read the full manual, delivered section by section
3. choose `Edit a section`
4. choose the section
5. send the complete replacement text in one message
6. review the preview
7. press `Save` or `Discard`

`/cancel` abandons an active manual edit before save.

Section text is limited to 3,500 characters to keep Telegram rendering clean.

## Storage
Migration:
`migrations/0009_manuals.sql`

Tables:
- `manual_sections`
- `manual_revisions`

Every saved section increments its version and stores the prior version in `manual_revisions`.

Manual data is intentionally separate from:
- `faq_entries`
- FAQ revisions
- deterministic FAQ matching
- AI grounding context

Editing a manual must never change what the bot treats as approved School knowledge.

## Runtime files
- `src/manual_store.ts` — manual persistence and revisions
- `src/manual_entry.ts` — Telegram commands, authorization, full-manual display, edit preview/save/discard

The manual layer sits outside the existing runtime stack and passes all unrelated traffic through unchanged.
