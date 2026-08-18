# Telegram Design Rules

The bot represents a university School of Nursing. Interactions should feel formal, calm, clean, trustworthy, and easy to scan on a phone.

## Visual language
- Prefer short messages with clear hierarchy.
- Use restrained emoji only when they improve navigation.
- Keep institutional/policy answers visually conservative.
- Do not imitate casual entertainment bots.

## Buttons and navigation
- Prefer inline keyboards for finite choices.
- Keep rows to 1–2 buttons when labels are long; up to 3 for compact labels.
- `← Back` returns to the parent screen.
- `✕ Close` dismisses the current menu.
- `Cancel` abandons an active wizard; it is not Back/Close.
- Prefer edit-in-place for callback navigation; send a new message only as fallback.
- `ui:close` is the shared dismiss callback.
- Destructive actions require a confirmation screen before mutation.

## Response progress
- Do not send persistent wait messages for normal AI generation.
- Use Telegram `typing` while a grounded AI request is in flight and refresh as needed.
- Deterministic FAQ answers remain the fast path.

## Reply presentation
- AI answers and handoff notices should reply to the originating question when possible.
- Keep answers concise-first and avoid repetitive greetings.

## Reset / cancel semantics
- `/cancel` cancels the current interactive setup only.
- `/reset` clears transient session/conversation state and returns the user to automated mode.
- `/reset` must not erase saved language, FAQ knowledge, AI credentials, bindings, roles, monitoring settings, rate-limit history, or bans.

## Language selector
Recommended order: `မြန်မာ` · `English` · `简体中文`.
- Persist the choice until `/language` changes it.
- The picker is one-shot.
- After save, delete the picker and send one short localized confirmation.
- Never silently close a successful language selection.

## Public FAQ library
- `/faq` is public.
- Normal users receive active, read-only, localized FAQs only.
- Never expose Add/Edit/Disable/Restore, inactive entries, keys, revisions, case data, or admin controls to normal users.
- Use human-readable saved-language labels and paginate long lists at about 6–8 items/page.
- Owner/Sudo retain FAQ management and multilingual drafting.

## Multilingual FAQ authoring
- Owner/Sudo may author from one authoritative language: Burmese, English, or Simplified Chinese.
- AI is a drafting assistant only.
- `✨ Generate other 2 languages` may use configured Primary then Fallback AI.
- Translation must not add/remove/invent policy facts, dates, fees, eligibility, accreditation, contacts, URLs, scholarship/loan/bond terms, or promises.
- Show all three languages before `✅ Approve & Save`.
- AI failure must preserve the draft and offer retry/manual entry.
- Live FAQ data remains unchanged until explicit approval.

## Escalation Inbox
- `/cases` is Owner/Sudo only and is allowed in private bot chat or the configured active Staff Inbox group.
- Show Open, Claimed, Resolved, All with about 6 cases/page, newest first.
- Case detail may show privileged identity, question, language, status, timestamps, reason, claimant, and linked FAQ.
- `＋ Add as FAQ` and `Find Related FAQ` connect knowledge gaps to the FAQ workflow.
- Live Take Over/Resolve remains on the original Staff Inbox escalation message.
- `🗑 Delete Case` is for typo/test/junk cases and requires explicit permanent-delete confirmation. Delete only the case and its escalation-message history; do not delete the user, original question log, or linked FAQ.

## Spam protection and user limits
- Apply rate limiting only to normal-user private free-text inquiries. Owner/Sudo operational traffic and commands do not consume the rate window.
- Default rate window: **10 free-text inquiries per 10 minutes**.
- The next inquiry after the limit is reached must be stopped before deterministic FAQ, AI, or human escalation processing.
- Automatic cooldown progression for repeat limit hits within 24 hours: **30 minutes → 2 hours → 12 hours**. Do not automatically permanently ban a user.
- During cooldown/restriction/ban, keep `/faq`, `/language`, `/start`, and other safe commands available.
- Rejected spam text must not create a new escalation case or trigger an AI API call.
- User-facing cooldown copy must remain neutral, state that previously accepted questions remain recorded, give an approximate remaining wait time, and point to `/faq`.
- `/limits` is Owner/Sudo only and may be used privately or in the active Staff Inbox group.
- `/limits` should provide a pager/detail view with status, window usage, strikes, cooldown/restriction/exemption state, and immutable Telegram user ID.
- Owner/Sudo controls: `Unlock Now`, `Exempt 1h`, `Restrict 2h`, `Reset Strikes`.
- Temporary exemption exists especially for testing normal-user accounts and must not become a forgotten permanent whitelist.
- Permanent ban/unban is **Owner-only**. `Permanently Ban` requires a confirmation screen.
- A permanently banned account cannot submit free-text inquiries; AI and escalation must not run. Read-only `/faq` access remains available.
- Permanent unban clears the ban and resets immediate cooldown/window state.
- Admin overrides and ban/unban actions must be written to `admin_audit`.

## Normal FAQ message
1. concise answer
2. essential qualifying detail
3. official link/channel when relevant
4. optional next-action buttons

## Tone
- Respectful, neutral, clear.
- Never shame repeated/basic questions or call a user a spammer in user-facing copy.
- Never imply certainty unsupported by approved knowledge.

## Error / no-match
Never expose raw technical errors. State that the bot cannot answer confidently, retain the question when appropriate, and offer a useful next step.

## Human escalation
Tell the user their accepted question has been recorded for authorized staff follow-up. Do not promise response time without an official SLA.

## Admin UX
- Keep admin interfaces compact and separate from student navigation.
- Show immutable Telegram user ID when managing users.
- Owner-only controls must not appear available to Sudo Admins.
- Paginate long user/question lists.
- Privileged menus should expose `✕ Close`.

## Accessibility
- Do not rely on color.
- Button labels must make sense without emoji.
- Preserve readable Burmese and Chinese typography.

## Content integrity
Policy-sensitive answers must come from canonical data. Never creatively alter dates, costs, eligibility, accreditation, requirements, scholarship/loan/bond rules, or official contacts.

## Interaction defaults
- `/start`: welcome/language path.
- `/language`: save → remove picker → localized confirmation.
- `/faq`: public read-only library for normal users; management/authoring for Owner/Sudo.
- `/cases`: Owner/Sudo escalation knowledge inbox.
- `/limits`: Owner/Sudo rate-limit management; permanent ban/unban Owner-only.
- Free text: rate-limit gate → deterministic FAQ → grounded AI → escalation.

## Naming
Use the institution's official name once canonically confirmed. Do not invent branding, slogans, mascots, or promises.
