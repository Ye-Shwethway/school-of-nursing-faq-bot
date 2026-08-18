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

## Language selector and FAQ-first onboarding
Order: `မြန်မာ` · `English` · `简体中文`.
- Persist until `/language` changes it.
- Picker is one-shot.
- Save → delete picker → one localized confirmation.
- The confirmation must promote `/faq` as the first place to check common questions and explain that free-text inquiry is for questions not covered there.
- Include one localized `📚 Browse FAQ` inline button that opens the public FAQ list directly.
- Never silent-close a successful selection.
- `/start` and `/language` may both open the language picker; after selection they converge on the same FAQ-first confirmation flow rather than encouraging immediate AI/free-text use.

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
- When a meaningful unresolved question is escalated, the user must always receive a localized acknowledgement in private chat; Staff Inbox delivery must never substitute for the user-facing response.
- Prefer replying to the original user question. If Telegram rejects the reply-target form, retry immediately as a plain private message so the user is not left silent.
- Staff Inbox forwarding, topic mirroring, or notification failure must not suppress the user-facing handoff acknowledgement once the escalation path has been accepted.

## Input quality and false escalation
- Before normal FAQ/AI/handoff processing, obvious low-information private text must pass an Input Quality Gate.
- Obvious low-information examples include numbers-only input, punctuation/symbol-only input, single-character noise, URL-only input, username-only input, phone-number-only input, repeated-character garbage, and acknowledgement-only text such as `ok`/`yes` when no usable question is present.
- These inputs must **not call AI and must not create a new escalation case**. Return one short localized clarification asking for a more complete question and point to `/faq`.
- Do not use a crude length-only rule. Short-but-meaningful school topics such as `fees?`, `tuition`, `admission`, `CDM`, or `accreditation` must remain eligible for normal FAQ/AI handling.
- Human-controlled conversations and active admin/setup sessions bypass the Input Quality Gate so short operational replies are not swallowed.
- AI may return a clarification decision for meaningful but incomplete/ambiguous input. Clarification is terminal for that turn and must not create a case.
- Human handoff is reserved for a sufficiently specific, meaningful School of Nursing question that staff could reasonably review or act on and that approved knowledge cannot safely answer.
- Do not hand off typos, accidental fragments, acknowledgements, standalone numbers, or messages that first need clarification.
- The false-escalation filter exists to keep Staff Inbox and `/cases` focused on real knowledge gaps and actionable staff work.

## Spam protection and user limits
Two independent protection layers are required.

### Inquiry rate limit
- Apply inquiry rate limiting only to normal-user private free-text inquiries. Owner/Sudo operational traffic does not consume this window.
- Default rate window: **10 free-text inquiries per 10 minutes**.
- The next inquiry after the limit must stop before FAQ matching, AI, or escalation processing.
- Automatic repeat cooldowns within 24 hours: **30 minutes → 2 hours → 12 hours**.
- Never auto-permanently-ban a user.
- Rejected spam text must not call AI or create a new escalation case.
- During cooldown/restriction/ban, `/faq`, `/language`, `/start`, `/whoami`, and other safe commands remain available subject to the Interaction Flood Guard below.
- Cooldown copy must be neutral, say previously accepted questions remain recorded, show an approximate remaining wait time, and point to `/faq`.
- If a blocked user keeps sending free-text messages, send the warning **at most once per 5 minutes**; silently drop additional blocked attempts during that throttle window.

### Interaction Flood Guard
- The flood guard runs before normal command/callback/free-text processing in private chat.
- Count private **commands + inline-button callbacks + messages** as interactions.
- Normal users: **20 interactions per 60 seconds**.
- Users with an active inquiry cooldown, temporary restriction, or permanent ban: **6 interactions per 60 seconds**.
- Exceeding the interaction threshold creates a **5-minute UI flood block**.
- On the first blocked interaction, show one short localized warning. During the block, silently drop additional traffic and do not repeat the warning more than once per 5 minutes.
- Blocked interaction floods must stop before lower FAQ/AI/handoff/admin UI logic.
- Owner and Sudo Admin accounts bypass this flood guard for operational reliability.
- `Exempt 1h` bypasses only the inquiry rate limit. It **must not bypass the Interaction Flood Guard**.
- The flood guard protects safe commands and FAQ button navigation from command/callback spam while keeping those functions available for normal limited users.

### `/limits` admin UX
- `/limits` is Owner/Sudo only in private bot chat or active Staff Inbox.
- `/limits` shows a pager of users with rate-limit history or active restriction/exemption/ban state.
- `/limits <telegram_user_id>` opens a direct user detail even if that test account has not hit a limit yet.
- Detail must show immutable Telegram user ID, state, current 10-minute inquiry window count, strikes, and relevant timestamps.
- Owner/Sudo controls: `🔓 Unlock Now`, `🧪 Exempt 1h`, `⏳ Restrict 2h`, `Reset Strikes`.
- **Exempt 1h** = temporarily bypass the free-text inquiry limit for trusted/QA testing. FAQ/AI/handoff remains normal, but flood protection still applies.
- **Restrict 2h** = manually block free-text inquiries for 2 hours. AI and new escalation do not run; safe commands remain available under the tighter flood threshold.
- Restrict and Exempt are mutually exclusive: applying Restrict removes an active Exempt.
- **Unlock Now** clears cooldown/temporary restriction and the immediate inquiry window; it does not grant Exempt status.
- `Reset Strikes` clears progressive strike/window history; it is not an exemption.
- Permanent ban/unban is **Owner-only**.
- `🚫 Permanently Ban` requires confirmation.
- A permanently banned account cannot submit free-text inquiries; AI and escalation do not run. Read-only `/faq` remains available under the tighter flood threshold.
- `✅ Unban User` clears the ban plus immediate cooldown/window state.
- Admin overrides and ban/unban operations must be written to `admin_audit`.

## Deployment online notice
- Production health may emit one `🟢 Bot is Online!` notice per deployed revision to Owner/Sudo recipients.
- A revision must not be considered permanently notified when Telegram delivery fails to every target.
- If all Telegram deliveries fail, release the revision notice claim so a later successful `/health` request can retry.
- Delivery-notice failure must never make production health fail.

## Reset / cancel semantics
- `/cancel` cancels the current interactive setup only.
- `/reset` clears transient session/conversation state.
- `/reset` must not erase saved language, FAQ knowledge, AI credentials, roles, monitoring configuration, rate-limit history, flood-guard history, or bans.

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
- `/start`: open the language path; after selection, promote FAQ-first self-service.
- `/language`: save → remove picker → localized FAQ-first confirmation + direct Browse FAQ button.
- `/faq`: public read-only library for normal users; management/authoring for Owner/Sudo.
- `/cases`: Owner/Sudo escalation knowledge inbox.
- `/limits`: Owner/Sudo rate-limit management; permanent ban/unban Owner-only.
- Private interaction order: **webhook verification → Interaction Flood Guard → inquiry rate gate → FAQ/admin text routing → Input Quality Gate → deterministic FAQ → grounded AI answer/clarify → actionable human escalation**.