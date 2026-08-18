# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence

Read in order:

1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant canonical docs/source

Treat live repository plus verified Cloudflare/Telegram evidence as authoritative over remembered chat context.

## Current checkpoint

The project is main-only and production-live, with the **Escalation Inbox + AI-assisted multilingual FAQ authoring slice implemented on `main` but not yet declared production-green until the final workflow/read-back is verified**.

Current implemented surfaces include:

- multilingual deterministic/dynamic FAQ
- public role-aware `/faq` with localized paginated read-only browsing for normal users
- Owner/Sudo FAQ management
- one-language FAQ authoring with optional AI translation into the other two languages
- multilingual draft preview and explicit `✅ Approve & Save`
- manual translation fallback when AI is unavailable/fails
- AI-assisted multilingual FAQ edit drafts that leave live FAQ data unchanged until approval
- existing individual-field FAQ edits for precise corrections
- `/cases` Owner/Sudo Escalation Inbox
- Open / Claimed / Resolved / All case pager, 6 per page
- privileged case details with user identity, question, status, timestamps, reason for new cases, claimant, and linked FAQ
- escalation → Add as FAQ / Find Related FAQ workflows
- persisted escalation reason and case-to-FAQ linkage
- Staff Inbox Take Over / Resolve / Return-to-AI operational controls on original escalation messages
- grounded configurable Primary/Fallback AI
- Owner identity and Sudo Admin roles
- one-shot `/language`: save → delete picker → send localized confirmation
- Staff Inbox per-user topics, presence, notifications, reply relay, and returning-staff reminder
- editable Owner/Admin manuals including the new escalation/FAQ workflow
- Owner `/clearmessage` best-effort only

## Main-only operating model

- `main` is the only active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- no TEST deploy/build workflow is active.
- `.github/workflows/deploy-production.yml` is the single production workflow.
- relevant `main` pushes automatically validate and deploy production.

Do not revive a TEST→main promotion model unless the Owner explicitly redesigns the architecture.

## Escalation Inbox contract

`/cases` is available to Bot Owner and Sudo Admins only.

Allowed contexts:

- private bot chat
- configured active Staff Inbox group

Unrelated groups must reject it.

Views:

- Open
- Claimed
- Resolved
- All

Lists are newest-first and paginated at 6 cases per page. Case details are privileged and may show Telegram identity, language, original question, status, created/resolved timestamps, claimant, stored reason, and linked FAQ.

The `/cases` UI is for archive/review/knowledge management. Live Take Over / Resolve controls remain on the original Staff Inbox escalation message so staff reply context remains correct.

Migration `0016_escalation_knowledge_pipeline.sql` adds `reason`, `linked_faq_key`, and a linked-FAQ index. Older cases may not have a stored reason.

## Escalation → FAQ workflow

From case detail:

- `＋ Add as FAQ` starts a draft with the case language and original question prefilled.
- admin supplies the approved answer in that source language.
- `Find Related FAQ` checks current approved FAQ matching and allows review/edit or creation of a new FAQ.
- after a case-derived FAQ is approved and saved, `linked_faq_key` is stored on the escalation case.

## AI-assisted multilingual FAQ authoring

FAQ Add/Edit is available to Owner + Sudo.

Authoring flow:

1. choose authoritative source language: `မြန်မာ`, `English`, or `简体中文`
2. for new FAQ, supply stable English key
3. write authoritative source question and answer
4. choose `✨ Generate other 2 languages` or manual entry
5. review all three languages
6. press `✅ Approve & Save`

AI generation:

- reuses the configured FAQ-agent Primary binding
- tries configured Fallback if Primary fails
- uses stored encrypted credentials and `AI_CONFIG_MASTER_KEY`
- treats the source-language text as authoritative
- must not invent/add/remove policy facts, dates, fees, eligibility, accreditation, contacts, URLs, scholarship/loan/bond terms, or promises
- returns draft text only

AI failure is non-blocking. The source draft remains in `admin_sessions`; admin can retry AI or manually fill the other two languages. All three languages are still required before publication.

AI-assisted editing is draft-first: the current live FAQ remains canonical until explicit approval. Existing field-by-field editing remains available.

AI provider/key/model configuration remains Owner-only through `/ai`.

## Language selector contract

`/language` order: `မြန်မာ` · `English` · `简体中文`.

On valid choice:

1. persist language
2. delete the selector message
3. send one short localized confirmation message

Never silently close after a successful choice. Users can reopen `/language` at any time.

## Public FAQ library contract

Normal users:

- can browse active FAQs only
- see saved-language human-readable labels
- get 8-item pagination with two columns only for compact labels
- see only selected-language question and answer in detail
- never see Add/Edit/Disable/Restore, inactive FAQ, keys, revisions, case data, or admin controls

Owner/Sudo retain FAQ management and multilingual authoring controls.

## Command registry

Public (4):

`/start`, `/language`, `/faq`, `/whoami`

Sudo Admin adds:

`/admin`, `/admins`, `/cases`, `/adminmanual`, `/noti`, `/available`, `/unavailable`

Owner additionally has:

`/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`

Command schema revision: `8`.
Sudo total: **11**.
Production exact Owner read-back target: **18 commands**.

Normal users inherit the global `all_private_chats` public registry. Older chat-specific normal-user scopes are deleted during registry synchronization so they cannot shadow new public commands.

## Staff Inbox behavior

Authorized staff operations remain:

- `/noti on|off`
- `/available`
- `/unavailable`
- Take Over / Return to AI
- topic reply relay to original user
- returning-unavailable pending-case reminder

`/cases` does not replace the operational Staff Inbox message. It adds a durable searchable/reviewable knowledge-management view over stored escalation records.

## Manuals

Manual-related migrations:

- `0009_manuals.sql`
- `0010_manual_newline_cleanup.sql`
- `0013_manual_staff_operations.sql`
- `0014_manual_returning_staff_prompt.sql`
- `0015_owner_manual_main_only_cleanup.sql`
- `0017_manual_escalation_knowledge_pipeline.sql`

`0017` adds Owner/Admin instructions for `/cases`, Add as FAQ, Find Related FAQ, one-language authoring, Primary/Fallback AI translation, review/approval, manual fallback, and permissions.

## Canonical Worker stack

Wrangler entrypoint: `src/faq_ai_entry.ts`.

1. `faq_ai_entry.ts` — intercept FAQ-authoring text safely before staff relay + execute AI multilingual generation with production master key
2. `cases_entry.ts` — `/cases`, cases callback navigation, private/active-Staff-Inbox context enforcement
3. `staff_presence_entry.ts` — availability, `/noti`, returning-staff reminder, topic reply relay
4. `clear_message_entry.ts` — best-effort Staff Inbox cleanup
5. `manual_entry.ts` — manuals + command sync
6. `deployment_notice_entry.ts` — production ops/deploy notice + command synchronization
7. `latest_return_entry.ts` — latest Return-to-AI control
8. `monitoring_message_entry.ts` — FAQ/AI/handoff and exact escalation-reason persistence
9. `staff_ux_entry.ts` — Staff Inbox UX + Sudo invite lifecycle
10. `ux_entry.ts` — FAQ/AI/monitoring navigation + shared Close
11. `secure_entry.ts` — secure AI setup + language selector behavior
12. `runtime_entry.ts`
13. `index.ts`

## Production workflow contract

`.github/workflows/deploy-production.yml` validates:

- production credentials/runtime bindings
- install/typecheck
- local migrations
- production Worker dry run
- remote D1 migrations
- production Worker deploy
- runtime-binding preservation
- production `/health`
- nonce-gated Owner command resync
- exact Telegram Owner read-back

Current exact read-back expects 18 commands including `/cases`.

## Current migrations

`0001` through `0017`.
Latest: `migrations/0017_manual_escalation_knowledge_pipeline.sql`.

## Validation boundary / next exact sequence

Do not state this feature is production-green until the latest production workflow is verified successful. The final validation must cover typecheck, migrations, deploy, health, and 18-command Owner read-back.

After that, live Telegram acceptance should verify:

1. `/cases` from Owner private chat
2. `/cases` from Sudo in active Staff Inbox
3. historical case reason fallback and a newly-created case with persisted reason
4. case → `＋ Add as FAQ`
5. AI multilingual generation and preview
6. manual fallback path
7. `✅ Approve & Save`
8. approved result visible to normal users in `/faq`

## Documentation rule

After every meaningful behavior/architecture/schema/deployment slice, keep `ROADMAP.md` and this file synchronized with live repository reality.
