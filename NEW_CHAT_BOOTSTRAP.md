# NEW CHAT BOOTSTRAP

Last updated: 2026-08-18
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant canonical docs/source

Live repository plus verified Cloudflare/Telegram evidence outranks remembered chat context.

## Current checkpoint
The project is main-only and production-live. FAQ-first onboarding, false-escalation filtering, rotated Telegram token + automatic webhook cutover, rotated AI master-key credential save, Bot Owner takeover override, and deployment reboot `Change:` metadata are live-accepted.

Newest implementation on `main` adds **AI outage operational alerts while preserving FAQ + human fallback continuity**. Do not call this newest slice production-green until production workflow and controlled outage/recovery acceptance are verified.

## AI outage / fallback contract
- AI infrastructure/configuration failure must not reduce the bot to FAQ-only mode.
- Deterministic FAQ remains independent and continues to answer matches.
- A meaningful FAQ miss still goes to normal human handoff when AI is unavailable.
- End users never receive provider/API-key/master-key error details.
- `src/ai_runtime.ts` distinguishes infrastructure failure from a valid AI policy handoff.
- Infrastructure failures include `ai_unavailable:<reason>`, `primary_and_fallback_failed`, and `ai_runtime_failure`.
- Valid AI `answer` or valid policy `handoff` proves the model path is responding and is not treated as an outage.

## Operational AI alerts
`src/ai_outage_alert.ts` owns outage/recovery visibility.

On AI infrastructure failure:
1. persist/throttle outage state in existing `bot_settings`
2. send `🚨 AI service unavailable` to Bot Owner private chat
3. also send to the configured Staff Inbox when present
4. show safe internal reason
5. show `Human fallback: ACTIVE` when staff destination exists
6. show `Human fallback: QUEUED ONLY` when cases can be logged but no staff destination is configured
7. same reason alerts at most once per 30 minutes; a different reason may alert immediately

On the first later valid AI decision:
- clear outage marker
- send one `🟢 AI service recovered` operational notice
- normal FAQ/AI/handoff behavior continues

Migration `0029_manual_ai_outage_fallback.sql` adds Owner/Admin manual guidance. No new table/schema is needed beyond the manual rows because outage state uses `bot_settings`.

## Human-control lease contract
- Every successful `Take Over` starts a 1-hour inactivity lease.
- Lease state is persisted in D1 (`last_human_activity_at`, `human_control_expires_at`).
- Only the current claimant may renew it.
- Eligible claimant staff reply or `Extend 1h` renews to one hour from that activity.
- Other Admin activity does not renew another claimant's lease.
- Cron sweep every 5 minutes auto-returns expired claims to AI; practical expiry is about 1h00m–1h05m.
- Auto-return notifies user + claimant/staff, removes stale control button, and preserves history.

Migration `0028_human_control_lease.sql` added lease timestamps/index and gave pre-existing claims a fresh rollout hour.

## Owner authority contract
- Sudo/Admin may Take Over.
- Active claimant may Return to AI.
- Bot Owner may force Return to AI regardless of claimant identity and does not need to wait for lease expiry.
- Owner override notifies displaced claimant, informs user, cleans control state and preserves history.

## Deployment contract
Canonical `wrangler.jsonc` has `triggers.crons = ["*/5 * * * *"]`; the isolated production Wrangler config copies `source.triggers`.

Every production deploy validates typecheck, local migrations, dry-run bundle, remote migrations, deploy, bindings, `/health`, Telegram webhook cutover/read-back and exact Owner command registry 19/19.

The workflow injects:
- `DEPLOY_REVISION = GITHUB_SHA`
- `DEPLOY_CHANGE = normalized triggering commit subject` (max 180 chars)

`🟢 Bot is Online!` shows both `Revision:` and `Change:` when metadata is available.

## Handoff acknowledgement contract
For real AI→human escalation, user acknowledgement remains reply-first with plain-private-message fallback. Staff Inbox success does not substitute for user-facing acknowledgement.

## AI credential setup contract
`AI_CONFIG_MASTER_KEY` is Base64 for exactly 32 random bytes. Provider keys must be re-entered after master-key rotation. `ai_setup_entry.ts` owns early Owner-private credential interception; Gemini credential save and AI use are live-accepted.

## Canonical Worker stack
Wrangler entrypoint: `src/interaction_guard_entry.ts`.

Top flow:
1. `interaction_guard_entry.ts` — Interaction Flood Guard + scheduled lease sweep
2. `rate_limit_entry.ts`
3. `ai_setup_entry.ts`
4. `faq_ai_entry.ts`
5. `input_quality_entry.ts`
6. `cases_entry.ts`
7. lower Staff/manual/deploy/latest-return/monitoring/UX/security/runtime layers

Important ownership:
- `ai_runtime.ts` — grounded AI execution + outage/recovery signaling
- `ai_outage_alert.ts` — throttled operational AI outage/recovery notices
- `latest_return_entry.ts` — Return-to-AI button cleanup, `Extend 1h`, claimant renewal, Owner override
- `deployment_notice_entry.ts` — production online notice with revision/change metadata

## Existing product surfaces
- multilingual deterministic/dynamic FAQ
- public role-aware `/faq`
- FAQ-first `/start`/`/language`
- Owner/Sudo FAQ management + multilingual AI-assisted drafting
- `/cases` escalation archive
- Staff Inbox human takeover/resolve/return-to-AI
- Owner override of stale Admin takeover
- 1-hour human-control lease + auto-return
- AI outage alert + human fallback continuity + recovery notice
- reboot notice with revision + deployed change summary
- `/limits`, progressive inquiry limits, Interaction Flood Guard
- Owner-only permanent ban/unban
- Input Quality Gate + AI clarify-vs-handoff
- editable manuals

## Command registry
Public (4): `/start`, `/language`, `/faq`, `/whoami`.
Sudo adds: `/admin`, `/admins`, `/cases`, `/limits`, `/adminmanual`, `/noti`, `/available`, `/unavailable`.
Owner adds: `/sudo`, `/ai`, `/staff`, `/clearmessage`, `/ownermanual`, `/cancel`, `/reset`.
Command schema revision: **9**. Sudo total: **12**. Owner total: **19**.

## Migrations / manuals
Current migration range: `0001` through `0029`.
Newest migration: `0029_manual_ai_outage_fallback.sql`.

## Next exact validation
After the triggered production workflow is green:
1. verify migration 0029/deploy/health/webhook/commands pass
2. controlled test: make AI unavailable while keeping FAQ/D1/Telegram intact
3. FAQ match must still answer normally
4. meaningful FAQ miss must still create/log human handoff
5. Owner + configured Staff Inbox receive one outage alert
6. same reason must not alert again within 30 minutes
7. alert must correctly show `ACTIVE` versus `QUEUED ONLY`
8. user must not see provider/key details
9. intentional knowledge-gap AI handoff must not emit outage alert
10. restore AI and confirm one recovery notice + normal grounded answer
11. existing human-control lease and Owner override remain operational

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with live repository reality.
