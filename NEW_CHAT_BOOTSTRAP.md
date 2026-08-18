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
4. task-relevant source/docs only

Treat live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Branch contract
- work on `test`
- do not implement directly on `main`
- TEST Worker: `school-of-nursing-faq-bot-test`
- production Worker: `school-of-nursing-faq-bot`
- `main` is not promoted yet

## Current canonical Worker stack
Wrangler entrypoint: `src/manual_entry.ts`

Layer order:
1. `manual_entry.ts` — Owner/Admin manuals, single-message pager/edit UX, command sync before interception
2. `deployment_notice_entry.ts` — deploy-health command sync + revision-aware `🟢 Bot is Online!`
3. `latest_return_entry.ts` — latest-message Return to AI control
4. `monitoring_message_entry.ts` — identity/model-aware mirrors + isolated group handoff
5. `staff_ux_entry.ts` — group-native `/staff` inline panel
6. `ux_entry.ts` — typing/reply-to/Close/Back, `/cancel`, `/reset`, stale-AI guard
7. `secure_entry.ts` — Owner AI secret/setup interception
8. `runtime_entry.ts` — dynamic FAQ/AI/command integration
9. `index.ts` — compatibility fallback

Do not bypass this stack or hand-build a separate Worker artifact.

## Commands
Normal user:
- `/start`
- `/whoami`

Sudo Admin adds:
- `/admin`
- `/admins`
- `/faq`
- `/adminmanual`

Owner adds:
- `/sudo`
- `/ai`
- `/staff`
- `/ownermanual`
- `/cancel`
- `/reset`

Owner also inherits `/adminmanual`. `/language` remains supported but hidden.

Role-scoped command menus use Telegram `setMyCommands`. Deploy health runs command registry sync before the online notice; `manual_entry.ts` also syncs before intercepting manual commands. Lower `runtime_entry.ts` remains a self-heal path.

## Editable Owner/Admin manuals
Manual storage is completely separate from FAQ knowledge and AI grounding.

Commands:
- `/ownermanual` — Owner read/edit only
- `/adminmanual` — Owner read/edit, Sudo Admin read-only

Schema:
- `migrations/0009_manuals.sql`
- `manual_sections`
- `manual_revisions`

### Current manual UX — single-message pager
Opening a manual sends one section in one Telegram message only.

Controls:
- `◀ Previous`
- page indicator such as `2/8`
- `Next ▶`
- Owner-only `✎ Edit this section`
- `✕ Close`

Page navigation uses `editMessageText`, so browsing reuses the same Telegram message instead of flooding chat. Sudo Admins can navigate `/adminmanual` pages but cannot edit.

Owner edit flow:
1. open manual
2. navigate to section
3. tap `Edit this section`
4. send complete replacement text
5. review Preview
6. choose `Save` or `Discard`

`/cancel` abandons a pending edit. Each save increments section version and archives the previous text.

### Manual line-break cleanup — migration 0010
`migrations/0010_manual_newline_cleanup.sql` converts legacy literal `\\n` sequences from the initial manual seed into real line breaks in D1.

`src/manual_store.ts` also normalizes `\\n` at read/save time, and manual edit preview normalizes pasted legacy sequences as an extra compatibility guard.

## Staff group / multiuser contract
Preferred Staff Inbox: private Telegram supergroup with Topics enabled. Bot should have Manage Topics; Delete Messages is recommended.

Each user maps to a separate topic:
`(telegram_user_id, staff_chat_id) -> message_thread_id`

Topic title:
`Name · @username · ID 123456789`

Mirror headers:
- `USER · Name (@username) · ID 123456789`
- `BOT · FAQ`
- `AI · provider/model`
- human-control USER messages add `Human control`

Different users have independent language, question history, conversation control, claimant, topic, and AI/human lifecycle.

Migration 0008 + `src/monitoring_target.ts` prevent same-user concurrent first-message duplicate topic creation. Topic provisioning is D1-locked; concurrent requests wait for the canonical mapping. Staff-side delivery fails closed rather than mixing users into the main Staff Inbox chat.

## Take Over / Return to AI
Migration 0006 adds conversation `control_version`; Take Over, Return to AI and `/reset` increment it so stale in-flight AI output is discarded.

Migration 0007 stores `latest_control_message_id`. During human control only the newest USER mirror carries `Return to AI`; when a newer user message arrives, the control moves down and the previous keyboard is removed.

## AI / FAQ runtime
Runtime contract:
`Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`

Approved active FAQ data is the grounding source. AI/config failure fails closed to human review. Current AI mirror header reads the actual bound provider/model from D1.

22 multilingual FAQ seeds remain the baseline. `/faq` is Owner/Sudo Admin knowledge management with revisions and notifications.

## Deployment pipeline
`.github/workflows/deploy-test.yml` runs on deploy-relevant `test` pushes and manual dispatch.

Pipeline:
1. dependencies
2. strict TypeScript typecheck
3. local migrations
4. Wrangler dry run
5. remote migrations
6. deploy TEST with `DEPLOY_REVISION=${GITHUB_SHA}`
7. `/health`
8. refresh role-scoped command menus
9. send `🟢 Bot is Online!` once per new revision to Owner + current Sudo Admins

Telegram runtime secrets remain Cloudflare Worker secrets, not GitHub secrets.

## Current migrations
- 0001 initial
- 0002 AI settings
- 0003 handoff/persona
- 0004 shadow monitoring
- 0005 dynamic FAQ
- 0006 conversation control version
- 0007 latest Return-to-AI control message
- 0008 monitoring topic provision lock
- 0009 editable operating manuals
- 0010 manual newline cleanup

## Current live validation focus
Before promoting `main`, validate when practical:
1. command additions appear after successful deploy without `/start`
2. `/ownermanual` opens as a single-message pager
3. `/adminmanual` pager works for Sudo Admin read-only
4. manual pages display real blank lines, not literal `\\n`
5. Previous/Next edits the same Telegram message
6. Owner edit Preview/Save/Discard and `/cancel` work
7. manual edits do not alter FAQ/AI knowledge
8. multiuser topics remain isolated
9. same-user near-simultaneous first messages do not create duplicate topics
10. Take Over only affects that user and latest Return-to-AI control moves correctly
11. online notice reaches Owner/Sudo Admins once per revision

Do not merge `main` until selected TEST checks are green.

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping. `NEW_CHAT_BOOTSTRAP.md` must reflect repository reality, not an older planned state.
