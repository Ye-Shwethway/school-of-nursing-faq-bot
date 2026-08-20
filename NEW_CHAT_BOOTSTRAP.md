# NEW CHAT BOOTSTRAP

Last updated: 2026-08-20
Repository: `Ye-Shwethway/school-of-nursing-faq-bot`
Active branch: `main`
Historical branch: `test` (dormant/reference-only)

## Startup sequence
1. `AGENTS.md`
2. `NEW_CHAT_BOOTSTRAP.md`
3. `ROADMAP.md`
4. only task-relevant canonical docs/source

Live repository plus verified production evidence outranks remembered chat context.

## Current checkpoint
Main-only production Telegram FAQ assistant. FAQ and Human Staff are primary continuity; grounded AI is supplementary.

Staff recurring availability schedule/manual override is live-accepted.
FAQ integrity repair is live-verified for `official-info-channel`: corrupt v8 → clean snapshot v5 → new live v9, revision history preserved.

Newest issue: a normal user sending `Hi` could receive an unrelated FAQ answer even though `hello` correctly received the incomplete-question clarification. The word `hi` was already present in the old low-information set; the real defect was runtime ordering. `faq_ai_entry.ts` could attempt deterministic FAQ matching before the lower `input_quality_entry.ts` gate.

Newest `main` slice moves low-information protection ahead of FAQ matching with a dedicated pre-FAQ guard and broadens greeting/acknowledgement normalization. Do not call this slice live-accepted until Telegram verification succeeds.

## Pre-FAQ quality guard
New `src/pre_faq_quality_entry.ts` runs after Owner AI-setup interception and before `src/faq_ai_entry.ts`.

Normal private free-text flow is now:
1. AI setup interception when applicable
2. **pre-FAQ low-information gate**
3. FAQ management/deterministic D1 FAQ fast path
4. lower input-quality safety net
5. AI / human fallback as applicable

This guarantees greetings/noise cannot be consumed by the deterministic FAQ matcher first.

The existing lower `src/input_quality_entry.ts` remains as a secondary guard and has the same expanded lexical behavior.

## Low-information scope
Normalized case-insensitive greeting/acknowledgement coverage includes:
- `hi`, `hi!`, `hii`, `hiii`, and similar stretched `hi`
- `hello`, punctuation/stretched variants
- `hey`, `hiya`, `yo`, `hi there`, `hello there`, `hey there`
- `ok`, `okay`, `yes`, `no`, `yep`, `yeah`, `nope`, `thanks`, `thank you`, `thx`
- Burmese: `မင်္ဂလာပါ`, `ဟယ်လို`, `ဟိုင်း`, `ဟုတ်`, `ဟုတ်ကဲ့`, `အင်း`, `အေး`, thanks variants
- Chinese: `你好`, `您好`, `嗨`, `好的`, `谢谢`, and simple yes/no acknowledgements

Existing noise detection remains for numeric-only, punctuation-only, URL-only, @username-only, phone-like, repeated-character, and almost-empty input.

Short meaningful School terms remain allowed, including `fee`, `fees`, `tuition`, `admission`, `apply`, `exam`, `cdm`, `accreditation`, `scholarship`, `loan`, `bond`, `campus`, `address`, `eligibility`, `calendar`.

Filtered low-information input gets localized clarification plus the FAQ browse button. It must not generate a deterministic FAQ answer, AI answer, or escalation case.

### Bypass contract
The quality gate bypasses:
- active authorized admin/setup/edit sessions expecting free text
- conversations currently in Human Take Over mode

## FAQ live/current/history model
- `faq_entries` = one current published row per stable `faq_key`
- `faq_key` is PRIMARY KEY
- approved edits overwrite current row and increment `version`
- `faq_revisions` archives history/recovery snapshots only
- multiple live versions must never be displayed for the same key
- `src/faq.ts` is seed/bootstrap only once D1 exists

## FAQ integrity prevention/recovery
`src/faq_store.ts` rejects command-only values and rendered FAQ-management blocks from canonical question/answer fields. Dynamic FAQ and AI grounding skip structurally corrupt rows.

Owner-only `/faq repair` restores the newest clean archived snapshot as a new live version while preserving revision history.

Migration range remains `0001` through `0035`.

## FAQ edit UX
During `✨ Edit from one language`:
- current live FAQ remains unchanged until approval
- prompts show `Draft only · live vN remains unchanged until Approve & Save.`
- text-input stages expose `✕ Cancel Edit`
- cancel clears only the edit session/draft
- only Approve & Save publishes the next live version

## Staff availability durable contract
Timezone: Asia/Yangon / UTC+06:30.
- recurring schedules survive plain `/available` and `/unavailable`
- plain state commands override only until next schedule boundary
- `/available cancel|clear` removes schedule explicitly
- `/unavailable <hours>` preserves schedule
- private mutations mirror to Staff Inbox
- automatic effective transitions declare to private + Staff Inbox

## Commands
Command schema revision remains 11. Public 4; Sudo 12; Owner 19.

## Next exact validation
After production workflow green:
1. normal user sends: `Hi`, `hi`, `HI`, `hi!`, `hii`, `hiii`, `hello`, `hey`, `hiya`, `hi there`
2. all must receive clarification + Browse FAQ only
3. none may receive FAQ/AI content or create an escalation
4. repeat with selected Burmese/Chinese greeting variants
5. send `fee`, `exam`, `cdm`, `loan`, `bond`; these must still pass through to normal FAQ/AI handling
6. verify an active FAQ edit/AI setup session still accepts its expected free text
7. verify a Human Take Over conversation is not blocked by the quality gate
8. verify existing FAQ repair/edit safety, staff availability, human-control lease, and AI outage behavior remain intact

## Documentation rule
After behavior/schema/deployment work, keep ROADMAP, this file, FAQ policy, manuals, and relevant design rules synchronized with repository reality.
