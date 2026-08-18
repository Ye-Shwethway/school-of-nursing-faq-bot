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

## Current checkpoint
Production infrastructure, operational data and Telegram webhook cutover are green. `/start` works on production. Owner-specific Telegram command registration remains the active defect: the Owner account did not show the expanded Owner menu after the first sync hotfix.

## Owner command registry defect
Expected Owner command menu:
`/start`, `/whoami`, `/admin`, `/admins`, `/faq`, `/adminmanual`, `/sudo`, `/ai`, `/staff`, `/ownermanual`, `/cancel`, `/reset`.

First fix already promoted:
- `syncUserCommandScope()` returns success/failure
- Owner/Sudo scope failure blocks `command_schema_version` persistence
- later health/runtime requests can retry

Remaining gap:
- health/cutover sync was best-effort and its result was not read back from Telegram
- therefore a green production workflow did not prove that the Owner chat scope actually contained 12 commands

New verified production resync:
- runtime endpoint: `POST /ops/telegram/owner-command-resync`
- production-only
- requires a one-time nonce stored in production D1
- validates production `BOT_OWNER_TELEGRAM_ID`
- calls Telegram `setMyCommands` for the Owner private-chat scope
- calls `getMyCommands` for the same scope immediately afterward
- requires exact ordered read-back of all 12 expected commands
- returns an error on any mismatch

Automation:
`.github/workflows/production-owner-command-resync.yml`

The workflow:
1. runs only from a `main` push tagged `[production-command-resync]`
2. deploys current main to the production Worker
3. verifies production health
4. creates and masks a one-time nonce
5. stores the nonce in production D1
6. calls the production Owner-command resync endpoint
7. fails unless Telegram read-back returns exactly 12 expected commands

This makes workflow green authoritative evidence for Telegram Owner command registration rather than merely best-effort sync.

## Verified production evidence
- isolated production D1 exists
- production Worker is deployed and healthy
- production `/health` returns `environment=production`
- production runtime secrets exist
- approved FAQ/manual/admin/staff/settings data was bootstrapped into production
- Telegram webhook cutover completed green
- `/start` works through production
- production uses a fresh `AI_CONFIG_MASTER_KEY`; encrypted TEST AI credentials were intentionally not copied

## TEST Build workflow cleanup
Current `.github/workflows/test-typecheck.yml` contract:
- read-only repository permission
- no generated artifact commits/pushes back to `test`
- generated Worker/checksum are uploaded only as workflow artifacts
- all `migrations/*.sql` included
- source/config/migration/workflow path-scoped trigger
- docs-only commits do not run Test Build
- `cancel-in-progress: false`

Historical noisy runs:
- `32123681126` / `95669489898`: self-push non-fast-forward race after validation had passed
- `32124026795` / `95670512070`: cancelled D1 validation due to old concurrency policy, not a migration failure

## Canonical Worker stack
Wrangler entrypoint: `src/manual_entry.ts`

1. `manual_entry.ts` — Owner/Admin manual pager/edit/add + command sync
2. `deployment_notice_entry.ts` — deployment notice + production ops endpoints
3. `latest_return_entry.ts`
4. `monitoring_message_entry.ts`
5. `staff_ux_entry.ts`
6. `ux_entry.ts`
7. `secure_entry.ts`
8. `runtime_entry.ts`
9. `index.ts` — fallback + `/health`

## Runtime contract
`Dynamic FAQ -> Primary AI -> Fallback AI -> Human Handoff`

## Next exact sequence
1. promote this tagged checkpoint to `main`
2. verified Owner-command workflow must finish green with exact 12-command Telegram read-back
3. then configure production AI provider/API key through `/ai`
4. verify grounded AI + fallback/handoff

## Current migrations
0001 through 0010; canonical 0010 is `migrations/0010_manual_newline_cleanup.sql`.

## Documentation rule
After every meaningful runtime/deployment/architecture slice, update this file before stopping.
