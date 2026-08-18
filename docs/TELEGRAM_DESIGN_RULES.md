# Telegram Design Rules

The bot represents a university School of Nursing. Interactions should feel formal, calm, clean, trustworthy, and easy to scan on a phone.

## Visual language
- Prefer short messages with clear hierarchy.
- Use restrained emoji only when they improve navigation.
- Keep institutional/policy answers visually conservative.

## Buttons and navigation
- Prefer inline keyboards for finite choices.
- Keep rows to 1–2 buttons when labels are long; up to 3 for compact labels.
- `← Back` returns to the parent screen.
- `✕ Close` dismisses the current menu.
- `Cancel` abandons an active wizard; it is not Back/Close.
- Prefer edit-in-place for callback navigation.
- Destructive actions require a confirmation screen before mutation.

## Response progress
- Do not send persistent wait messages for normal AI generation.
- Use Telegram `typing` while a grounded AI request is in flight.
- Deterministic FAQ answers remain the fast path.

## Language selector
Order: `မြန်မာ` · `English` · `简体中文`.
- Persist until `/language` changes it.
- Picker is one-shot.
- Save → delete picker → one localized confirmation.
- Never silent-close a successful selection.

## Public FAQ library
- `/faq` is public.
- Normal users receive active read-only localized FAQs only.
- Never expose management controls, inactive entries, keys, revisions, case data, or admin state to normal users.
- Paginate long lists at about 6–8 items/page.
- Owner/Sudo retain management and multilingual authoring.

## Multilingual FAQ authoring
- Owner/Sudo may author from one authoritative language: Burmese, English, or Simplified Chinese.
- AI is draft assistance only.
- `✨ Generate other 2 languages` may use configured Primary then Fallback AI.
- Translation must not invent/change policy facts, dates, fees, eligibility, accreditation, contacts, URLs, scholarship/loan/bond terms, or promises.
- Show all three languages before `✅ Approve & Save`.
- AI failure must preserve the draft and offer manual completion.
- Live FAQ data remains unchanged until explicit approval.

## Escalation Inbox
- `/cases` is Owner/Sudo only in private bot chat or configured active Staff Inbox.
- Show Open/Claimed/Resolved/All, newest first, about 6/page.
- Case detail may show privileged identity, question, language, status, timestamps, reason, claimant, and linked FAQ.
- `＋ Add as FAQ` and `Find Related FAQ` connect knowledge gaps to the FAQ workflow.
- Live Take Over/Resolve remains on the original Staff Inbox escalation message.
- `🗑 Delete Case` is for typo/test/junk cases and requires explicit permanent-delete confirmation.
- Case deletion removes only the escalation case and its escalation-message history; preserve user, original question log, and linked FAQ.

## Spam protection and user limits
- Apply rate limiting only to normal-user private free-text inquiries. Owner/Sudo operational traffic and commands do not consume the rate window.
- Default rate window: **10 free-text inquiries per 10 minutes**.
- The next inquiry after the limit must stop before FAQ matching, AI, or escalation processing.
- Automatic repeat cooldowns within 24 hours: **30 minutes → 2 hours → 12 hours**.
- Never auto-permanently-ban a user.
- Rejected spam text must not call AI or create a new escalation case.
- During cooldown/restriction/ban, `/faq`, `/language`, `/start`, and other safe commands remain available.
- Cooldown copy must be neutral, say previously accepted questions remain recorded, show an approximate remaining wait time, and point to `/faq`.
- If a blocked user keeps sending messages, send the warning **at most once per 5 minutes**; silently drop additional blocked free-text attempts during that throttle window.

### `/limits` admin UX
- `/limits` is Owner/Sudo only in private bot chat or active Staff Inbox.
- `/limits` shows a pager of users with rate-limit history or active restriction/exemption/ban state.
- `/limits <telegram_user_id>` opens a direct user detail even if that test account has not hit a limit yet.
- Detail must show immutable Telegram user ID, state, current 10-minute window count, strikes, and relevant timestamps.
- Owner/Sudo controls: `🔓 Unlock Now`, `🧪 Exempt 1h`, `⏳ Restrict 2h`, `Reset Strikes`.
- `Exempt 1h` is the preferred QA/testing bypass; avoid permanent whitelists.
- Permanent ban/unban is **Owner-only**.
- `🚫 Permanently Ban` requires confirmation.
- A permanently banned account cannot submit free-text inquiries; AI and escalation do not run. Read-only `/faq` remains available.
- `✅ Unban User` clears the ban plus immediate cooldown/window state.
- Admin overrides and ban/unban operations must be written to `admin_audit`.

## Reset / cancel semantics
- `/cancel` cancels the current interactive setup only.
- `/reset` clears transient session/conversation state.
- `/reset` must not erase saved language, FAQ knowledge, AI credentials, roles, monitoring configuration, rate-limit history, or bans.

## Tone
- Respectful, neutral, clear.
- Never shame repeated/basic questions or call a user a spammer in user-facing copy.
- Never imply certainty unsupported by approved knowledge.

## Admin UX
- Keep admin interfaces compact and separate from student navigation.
- Show immutable Telegram user ID when managing users.
- Owner-only controls must not appear available to Sudo Admins.
- Paginate long lists.
- Privileged menus should expose `✕ Close`.

## Content integrity
Policy-sensitive answers must come from canonical data. Never creatively alter dates, costs, eligibility, accreditation, requirements, scholarship/loan/bond rules, or official contacts.

## Interaction defaults
- `/start`: welcome/language path.
- `/language`: save → remove picker → localized confirmation.
- `/faq`: public read-only library for normal users; management/authoring for Owner/Sudo.
- `/cases`: Owner/Sudo escalation knowledge inbox.
- `/limits`: Owner/Sudo rate-limit management; permanent ban/unban Owner-only.
- Free text: **rate-limit gate → deterministic FAQ → grounded AI → escalation**.
