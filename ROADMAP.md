# ROADMAP

Last updated: 2026-08-18

## Goal

Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Approved FAQ knowledge first, grounded configurable AI second, anonymous human staff handoff whenever automation cannot answer safely.

## Branch and deployment policy

- `main` is the single active development, canonical, and production source branch.
- historical `test` is dormant/reference-only.
- no TEST workflow or TEST deployment is active.
- relevant `main` pushes run the single production validation/deployment workflow automatically.

## Current checkpoint

Status: **ESCALATION INBOX + AI-ASSISTED MULTILINGUAL FAQ AUTHORING IMPLEMENTED ON MAIN; FINAL PRODUCTION WORKFLOW VERIFICATION REQUIRED**

Current implemented surfaces include:

- multilingual dynamic FAQ and public role-aware `/faq`
- localized paginated read-only FAQ library for normal users
- Owner/Sudo FAQ management
- one-language FAQ authoring with optional AI generation of the other two languages
- explicit multilingual preview and `Approve & Save` before canonical publication
- manual translation fallback when AI is unavailable or fails
- AI-assisted multilingual FAQ editing that leaves the current live FAQ unchanged until approval
- individual-field FAQ editing for precise corrections
- `/cases` Escalation Inbox for Owner/Sudo in private chat and the configured active Staff Inbox group
- Open / Claimed / Resolved / All case filters with 6-item pager
- case detail with user identity, language, status, question, persisted reason for new cases, claimant, timestamps, and linked FAQ
- escalation-to-FAQ drafting through `＋ Add as FAQ`
- related-FAQ review through `Find Related FAQ`
- persisted escalation reason and durable case-to-FAQ link
- existing Staff Inbox Take Over / Resolve / Return-to-AI operational flow
- configurable grounded Primary/Fallback AI
- Staff Inbox per-user topics, presence, notifications, reply relay, and returning-staff reminder
- editable Owner/Admin manuals, now including escalation and multilingual FAQ workflows
- clean one-shot `/language`: save → remove picker → send one localized confirmation message

## Escalation Inbox

`/cases` is available only to Bot Owner and Sudo Admins.

Allowed contexts:

- private chat with the bot
- configured active Staff Inbox group

It is rejected in unrelated groups. The inbox displays Open, Claimed, Resolved, and All views, newest first, with 6 cases per page.

Case details expose privileged operational information only: Telegram identity, language, question, status, timestamps, claimant, escalation reason when stored, and linked FAQ when present.

Live Take Over / Resolve remains on the original Staff Inbox escalation message where staff reply context is correct. `/cases` is the archive/knowledge-management view.

Migration `0016_escalation_knowledge_pipeline.sql` adds:

- `escalation_cases.reason`
- `escalation_cases.linked_faq_key`
- linked-FAQ index

Cases created before migration 0016 may have no stored detailed reason.

## Escalation → FAQ knowledge pipeline

From a case detail:

- `＋ Add as FAQ` starts a new FAQ draft using the case language and original question.
- `Find Related FAQ` checks current approved FAQ matching and offers review/edit or new-draft paths.
- when a case-derived FAQ is approved and saved, the case stores its `linked_faq_key`.

No AI-generated text becomes canonical automatically.

## AI-assisted multilingual FAQ authoring

Owner/Sudo choose one authoritative source language: Burmese, English, or Simplified Chinese.

For a new FAQ:

1. choose source language
2. supply stable key
3. write source-language question
4. write source-language approved answer
5. either generate the other two languages with AI or enter them manually
6. review the complete three-language preview
7. press `✅ Approve & Save`

For AI-assisted editing, the current live FAQ remains unchanged while the draft is prepared. Approval applies the new multilingual version atomically through the existing FAQ mutation/revision path.

AI generation reuses the configured FAQ-agent Primary model and then Fallback model. The translation prompt treats source text as authoritative and prohibits invention or alteration of policy facts, dates, fees, eligibility, accreditation, contacts, URLs, scholarship/loan/bond terms, or promises.

If AI is unavailable, times out, fails, or returns invalid multilingual output, the draft remains stored in the admin session. Admins can retry or fill the remaining languages manually. **AI availability is not a publication dependency.** All three languages are still required before approval.

## FAQ permissions

FAQ Add/Edit/Disable/Restore and multilingual drafting are available to:

- Bot Owner
- Sudo Admins

Normal users receive read-only FAQ browsing only.

AI provider/key/model configuration remains Owner-only through `/ai`.

## Language selector UX

`/language` opens `မြန်မာ` · `English` · `简体中文`.

After a valid selection:

1. persist language
2. delete the selector message
3. send one short localized confirmation message

Do not silently close and do not leave the old picker in chat.

## Command registry

Public (4):

`/start`, `/language`, `/faq`, `/whoami`

Sudo Admin additionally:

`/admin`, `/admins`, `/cases`, `/adminmanual`, `/noti`, `/available`, `/unavailable`

Owner additionally:

`/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`

Expected Sudo total: **11**.
Expected Owner total: **18**.
Command schema revision: **8**.

Normal users inherit the global `all_private_chats` public registry; stale normal-user per-chat command overrides are removed during command synchronization.

## Manuals

Manual migrations now include:

- `0009_manuals.sql`
- `0010_manual_newline_cleanup.sql`
- `0013_manual_staff_operations.sql`
- `0014_manual_returning_staff_prompt.sql`
- `0015_owner_manual_main_only_cleanup.sql`
- `0017_manual_escalation_knowledge_pipeline.sql`

Migration `0017` adds Owner and Admin sections covering `/cases`, escalation-to-FAQ drafting, one-language authoring, AI Primary/Fallback translation, explicit approval, manual fallback, and permissions.

## AI configuration contract

`AI_CONFIG_MASTER_KEY` must be a Cloudflare `secret_text` containing Base64 for exactly 32 random bytes. Credentials encrypted with an older key must be re-entered through `/ai` after key rotation.

## Single production workflow

Canonical workflow: `.github/workflows/deploy-production.yml`.

Relevant `main` pushes perform production binding preflight, dependency install/typecheck, local migration validation, Worker dry-run, remote migrations, production deploy, binding postflight, `/health`, nonce-gated Owner command resync, and exact Telegram Owner command read-back.

The workflow now expects the 18-command Owner registry including `/cases`.

## Canonical Worker stack

Wrangler entrypoint: `src/faq_ai_entry.ts`.

1. `faq_ai_entry.ts` — AI multilingual FAQ generation and FAQ-authoring text interception before staff relay
2. `cases_entry.ts` — `/cases` and Escalation Inbox navigation/context enforcement
3. `staff_presence_entry.ts` — availability, `/noti`, returning-staff reminder, topic reply relay
4. `clear_message_entry.ts` — best-effort Staff Inbox cleanup
5. `manual_entry.ts` — manuals + command synchronization
6. `deployment_notice_entry.ts` — production ops/deploy notice
7. `latest_return_entry.ts` — latest Return-to-AI control
8. `monitoring_message_entry.ts` — FAQ/AI/handoff and persisted escalation reason
9. `staff_ux_entry.ts` — Staff Inbox UX + Sudo invite lifecycle
10. `ux_entry.ts` — FAQ/AI/monitoring edit-in-place navigation + shared Close
11. `secure_entry.ts` — secure AI setup + one-shot language selection
12. `runtime_entry.ts`
13. `index.ts`

## Current migrations

`0001` through `0017`.

Latest canonical migration: `migrations/0017_manual_escalation_knowledge_pipeline.sql`.

## Validation / next exact step

Source, schema, command-registry contract, design rules, and manuals are implemented on `main`. Do not declare this slice production-green until the latest single production workflow is verified successful, including typecheck, migrations, deploy, health, and exact 18-command Owner read-back.

After deployment verification, perform a short Telegram acceptance check:

- `/cases` in Owner private chat
- `/cases` in active Staff Inbox as Sudo
- open a historical and a new escalation case
- `＋ Add as FAQ` from a case
- AI translation success path
- manual fallback path (or simulated AI-unavailable path)
- `✅ Approve & Save`, then confirm the FAQ appears in the public `/faq` library

## Deferred optional work

- multiuser simultaneous live stress test
- same-user near-simultaneous first-message live race test
- optional automatic removal of a revoked Sudo from the Telegram Staff Inbox group
