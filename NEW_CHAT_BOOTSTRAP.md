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
The project is main-only and production-live. FAQ-first onboarding, false-escalation filtering, rotated Telegram token + automatic webhook cutover, rotated AI master-key credential save, and Bot Owner override of another Admin's stale Take Over are live-accepted.

Newest implementations on `main`:
1. persisted **1-hour human-control inactivity lease + claimant renewal + scheduled auto-return**
2. deployment online notice **change summary** so the reboot message shows what was deployed

Do not call these newest slices production-green until production workflow/live acceptance is verified.

## Human-control lease contract
- Every successful `Take Over` starts a 1-hour inactivity lease.
- Lease state is persisted in D1 (`last_human_activity_at`, `human_control_expires_at`), not held in memory.
- Only the current claimant may renew a lease.
- Eligible non-command claimant replies in the user's Staff Inbox topic or claimed case reply renew expiry to one hour from that activity.
- The current claimant may press `Extend 1h` for an explicit renewal without sending a message to the user.
- Other Admin activity, commands, unrelated Staff Inbox activity, and activity for another user do not renew the lease.
- Claimant Return to AI, Owner override, resolve/reset and auto-expiry clear lease timestamps.

## Scheduled auto-return
Canonical `wrangler.jsonc` has:
`triggers.crons = ["*/5 * * * *"]`.

Top-level `src/interaction_guard_entry.ts` exposes `scheduled()` and calls `sweepExpiredHumanControls()` from `src/human_control_lease.ts`.

The sweeper:
1. reads expired human claims
2. atomically changes a claim to AI only if user, claimant and expiry still match
3. sends localized auto-return notice to user
4. notifies previous claimant privately
5. if claimant DM is unavailable, uses Staff Inbox topic note as fallback notification
6. records the auto-return transition in the user's Staff Inbox topic
7. removes latest stale Return-to-AI control button
8. preserves cases, questions, users and FAQ history

Because Cron runs every five minutes, practical expiry is approximately 1h00m–1h05m after last claimant activity.

## Rollout safety / migration
Current migration range: `0001` through `0028`.

`0028_human_control_lease.sql`:
- adds `last_human_activity_at`
- adds `human_control_expires_at`
- adds expiry index
- gives any already-active human claim a fresh one-hour lease at rollout instead of expiring it immediately
- adds Owner/Admin manual sections for lease/auto-return behavior

## Production deployment contract
The production workflow creates an isolated Wrangler config and copies `source.triggers`; otherwise canonical Cron settings would be lost at deploy time.

Remote D1 migrations run before Worker deploy. Production still validates typecheck, local migrations, dry-run bundle, remote migrations, bindings, `/health`, webhook cutover/read-back and exact Owner command registry 19/19.

### Deployment reboot change metadata
The workflow derives the subject of `GITHUB_SHA`, normalizes it to one line, caps it at 180 characters and injects it as `DEPLOY_CHANGE` together with `DEPLOY_REVISION`.

`src/deployment_notice_entry.ts` now renders:
- `Revision: <short sha>`
- `Change: <deploy-triggering commit subject>` when available

This is intentionally deploy-time metadata; the Worker does not need GitHub API credentials. In the current direct-to-main model the `Change:` value is the triggering commit subject. If PR merges are adopted later, the same field can expose the merge/PR title. Missing change metadata never blocks the health/online notice.

## Owner authority contract
- Sudo/Admin may Take Over.
- Active claimant may Return to AI.
- Bot Owner may force Return to AI regardless of claimant identity and does not need to wait for lease expiry.
- Owner override notifies displaced claimant, informs user, cleans control state and preserves history.

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

`latest_return_entry.ts` owns:
- latest Return-to-AI button movement/cleanup
- `Extend 1h`
- claimant staff-activity renewal
- Owner override path

`deployment_notice_entry.ts` owns the production health-triggered online notice and renders both revision and deploy change metadata.

## Existing product surfaces
- multilingual deterministic/dynamic FAQ
- public role-aware `/faq`
- FAQ-first `/start`/`/language`
- Owner/Sudo FAQ management + multilingual AI-assisted drafting
- `/cases` escalation archive
- Staff Inbox human takeover/resolve/return-to-AI
- Owner override of stale Admin takeover
- 1-hour human-control lease + auto-return
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

## Next exact validation
After the triggered production workflow is green:
1. confirm migration 0028 applied and deployment/health/webhook/commands all pass
2. confirm `🟢 Bot is Online!` includes the correct short revision plus `Change:` matching the triggering commit subject
3. Admin Take Over a test user
4. confirm human-mode relay works
5. claimant presses `Extend 1h` and gets successful acknowledgement
6. claimant sends a valid Staff Inbox reply and lease renews
7. another Admin cannot extend/renew that claim
8. claimant Return to AI still works
9. repeat Take Over and confirm Owner override still works
10. use a controlled expiry test for scheduled auto-return
11. after expiry + Cron sweep, user must be in AI mode, receive localized auto-return notice, claimant must receive expiry notification/fallback, and next user question must enter FAQ/AI
12. case/question/user history must remain unchanged

## Documentation rule
After every behavior/schema/deployment slice, keep `ROADMAP.md`, this file, manuals and `docs/TELEGRAM_DESIGN_RULES.md` synchronized with live repository reality.
