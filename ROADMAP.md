# ROADMAP

Last updated: 2026-08-18

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch policy
- `test` = active development / live TEST validation
- `main` = verified canonical / production
- no direct implementation on `main`
- promote only after TEST behavior is green

## Current foundation
Status: FUNCTIONAL ON `test`

Implemented:
- 22 multilingual FAQ seeds + dynamic FAQ CRUD/revisions
- Owner/Sudo role management and role-scoped Telegram commands
- configurable encrypted AI providers/models with Primary/Fallback
- grounded AI + human handoff
- Staff Inbox group binding, per-user forum topics, monitoring
- Take Over / Return to AI and stale-AI suppression
- direct GitHub Actions -> Cloudflare TEST deployment
- deployment-online notification to Owner/Sudo Admins
- editable Owner/Admin operating manuals separate from FAQ knowledge

`main` and production remain unpromoted.

## Canonical Worker stack
Wrangler enters `src/manual_entry.ts`.

1. manual pager/edit + command sync
2. deployment online notice
3. latest Return-to-AI control
4. monitoring message presentation / isolated handoff
5. Staff Inbox UX
6. Telegram UX polish
7. secure AI setup interception
8. dynamic FAQ/AI runtime
9. compatibility fallback

## Command menu sync hardening
Status: IMPLEMENTED; LIVE CONFIRMATION PENDING

New command schemas are synchronized during successful deploy health before the online notice. The outer manual layer also runs sync before intercepting manual commands, while the lower runtime keeps self-heal behavior.

Expected result: command additions appear after deploy without requiring `/start`.

## Editable operating manuals
Status: IMPLEMENTED; PAGER POLISH IMPLEMENTED; LIVE TEST PENDING

Commands:
- `/ownermanual` — Owner read/edit
- `/adminmanual` — Owner read/edit, Sudo Admin read-only

Manuals explain Bot / AI / Human Staff layers, normal question flow, role commands, FAQ/AI management, Staff Inbox/monitoring, Take Over/Return to AI, deployment notices, and authority boundaries in plain operational language.

### Single-message pager
Manual browsing now uses one Telegram message instead of one message per section.

Controls:
- Previous
- page indicator
- Next
- Owner-only Edit this section
- Close

Navigation edits the same message with `editMessageText`, preventing chat clutter.

Owner edit workflow:
`Open -> navigate -> Edit this section -> replacement text -> Preview -> Save/Discard`

### Line-break correction
Migration 0010 normalizes legacy literal `\\n` seed sequences to real line breaks. `manual_store.ts` also normalizes on read/save for backward compatibility.

Manual storage remains isolated from FAQ matching and AI grounding.

## Multiuser / Staff Inbox isolation
Different Telegram users remain independent across profile/language, question logs, conversation mode, claimant, topic, and AI/human lifecycle.

Migration 0008 prevents same-user concurrent first-message duplicate topic creation with a D1 provisioning lock. Staff-side delivery fails closed if an isolated topic cannot be established; it must not mix users in the main Staff Inbox chat.

## Take Over controls
Migration 0006: conversation control version prevents stale AI output after Take Over, Return to AI, or reset.

Migration 0007: only the newest human-control USER message carries Return to AI; newer user traffic moves the button down and removes it from the older message.

## Deployment visibility
`.github/workflows/deploy-test.yml` validates, applies migrations, deploys TEST, checks health, refreshes command menus, then sends one `🟢 Bot is Online!` notice per revision to Owner + current Sudo Admins.

## Current migrations
- 0001 initial
- 0002 AI settings
- 0003 handoff/persona
- 0004 shadow monitoring
- 0005 dynamic FAQ
- 0006 conversation control version
- 0007 latest control message
- 0008 monitoring topic provision lock
- 0009 editable manuals
- 0010 manual line-break cleanup

## Current validation focus
Before `main` promotion:
- command additions appear after deploy without `/start`
- `/ownermanual` is a single-message pager
- `/adminmanual` pager is read-only for Sudo Admin
- blank lines render correctly with no literal `\\n`
- Previous/Next reuse the same Telegram message
- Owner manual edit Preview/Save/Discard works
- manual edits do not alter FAQ/AI knowledge
- multiple users remain in distinct topics
- same-user near-simultaneous first messages do not duplicate topics
- Take Over only affects one user and latest Return-to-AI control moves correctly
- online notice arrives once per revision

## Later slice
After live-green operational validation:
- latency / route telemetry without secrets
- provider/model performance comparison
- answer-presentation polish only where live UX shows a real need
