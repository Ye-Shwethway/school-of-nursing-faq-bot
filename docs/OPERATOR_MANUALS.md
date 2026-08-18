# Owner and Admin Manuals

Last updated: 2026-08-18

## Purpose

The bot includes two in-Telegram operating manuals that are separate from FAQ knowledge:

- `/ownermanual` — Bot Owner only
- `/adminmanual` — Bot Owner and Sudo Admins

The manuals explain operational use in plain language and are editable at runtime without changing approved FAQ knowledge or AI grounding.

## Current content scope

The manuals cover:

- Bot → FAQ → AI → human handoff flow
- role-appropriate command usage
- `/language`
- FAQ maintenance
- AI configuration awareness
- Staff Inbox and Take Over / Return to AI
- `/noti on|off`
- `/available` and `/unavailable`
- all-staff-unavailable user behavior
- returning-unavailable staff pending-case reminder
- topic reply relay back to the original user
- Staff Inbox switching and Owner-only cleanup context
- security, authority, and main-only deployment guidance

## Permissions

`/ownermanual`:
- Owner can read, edit existing sections, and add sections
- Sudo Admins and normal users cannot open it

`/adminmanual`:
- Owner can read, edit, and add sections
- Sudo Admins can read and navigate only
- normal users cannot open it

Authorization is server-side and based on immutable Telegram numeric identity.

## Pager and editing UX

Manual browsing reuses one Telegram message with Previous/Next navigation, page indicator, Owner edit/add controls where allowed, and `✕ Close`.

Owner edit flow:
1. open the manual
2. navigate to the section
3. choose Edit
4. send replacement body
5. review preview
6. Save or Discard

Owner add flow:
1. choose Add new section
2. send title
3. send body
4. review preview
5. Add or Discard

`/cancel` abandons the current edit/add wizard before save.

Each saved edit increments the section version and archives the prior body in `manual_revisions`.

## Storage and migrations

Core manual storage:

- `0009_manuals.sql` — `manual_sections`, `manual_revisions`, initial content
- `0010_manual_newline_cleanup.sql` — normalize legacy newline seeding

Current operational manual sync:

- `0013_manual_staff_operations.sql` — staff operations sections for Owner/Admin
- `0014_manual_returning_staff_prompt.sql` — returning-staff pending-case prompt documentation
- `0015_owner_manual_main_only_cleanup.sql` — removes stale TEST-branch guidance from Owner deployment/safety sections and preserves the previous bodies in revision history

New operational sections use additive or revision-preserving migrations so existing runtime-edited content is not casually overwritten.

## Separation from FAQ knowledge

Manual data is intentionally separate from:

- `faq_entries`
- FAQ revisions
- deterministic FAQ matching
- AI grounding context

Editing manuals must never alter what the bot treats as approved School of Nursing knowledge.

## Runtime files

- `src/manual_store.ts` — persistence, creation, normalization, revisions
- `src/manual_entry.ts` — commands, authorization, pager, edit/add preview/save/discard

The manual layer passes unrelated Telegram traffic through to the rest of the runtime stack.
