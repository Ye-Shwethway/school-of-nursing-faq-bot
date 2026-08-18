# Telegram Design Rules

The bot represents a university School of Nursing. Interactions should feel formal, calm, clean, trustworthy, and easy to scan on a phone.

## Visual language
- Prefer short messages with clear hierarchy.
- Use restrained emoji only when they improve navigation; avoid decorative emoji chains.
- Keep institutional/policy answers visually conservative.
- Do not imitate casual entertainment bots.

## Buttons
- Prefer inline keyboards for finite choices.
- Keep rows to 1–2 buttons when labels are long; up to 3 for compact labels such as languages.
- Use action-first labels such as `Change language`, `Ask another question`, `Contact staff`.
- Confirm consequential admin actions such as role removal.
- Never hide important policy text behind ambiguous buttons.

## Navigation grammar
Use these meanings consistently across privileged/configuration UI:
- `← Back` = return to the parent screen.
- `✕ Close` = dismiss the current menu completely.
- `Cancel` = abandon an active wizard/setup operation; do not use it as a synonym for Back or Close.
- Prefer editing the existing menu message for callback navigation. Send a new menu message only when edit-in-place is unavailable.
- `ui:close` is the shared dismiss callback for bot-owned menu messages.

## Response progress
- Do not send persistent “Please wait” clutter messages for normal AI generation.
- While a grounded AI request is in flight, use Telegram's native `typing` chat action and refresh it while necessary.
- Stop progress signaling when an answer, handoff, reset, or control transition completes.
- Deterministic FAQ answers remain the fast path and do not require an artificial delay.

## Reply presentation
- AI answers and AI-triggered handoff notices should reply to the originating user question when possible.
- Keep answers concise-first and split only when policy detail requires it.
- Do not add unnecessary greetings to every answer.

## Reset / cancel semantics
- `/cancel` cancels the current interactive setup/wizard only.
- `/reset` clears transient conversation/session state and returns the user to automated mode.
- `/reset` must not erase saved language, FAQ knowledge, AI credentials, model bindings, persona, Owner/Sudo roles, or monitoring configuration.

## Language selector
Recommended order: `မြန်မာ` · `English` · `简体中文`. Persist the choice until `/language` changes it.
- The language picker is a one-shot selector, not a persistent settings panel.
- After a valid language is saved, delete the selector message so it does not remain as chat clutter.
- Then send one short localized confirmation message in the selected language. Do not silently close the selector and do not leave the picker behind.
- Users can reopen the selector at any time with `/language`.

## Public FAQ library
- `/faq` is a public command and must be visible to normal users as well as privileged users.
- Normal users receive a read-only FAQ library. Never expose Add, Edit, Disable, Restore, inactive entries, internal keys, revision metadata, or other management controls.
- FAQ list labels should use the user's saved language and show human-readable questions/topics rather than internal slugs.
- Paginate long FAQ lists instead of dumping every FAQ into one tall message. Default to about 6–8 items per page.
- Use two buttons in a row only when both labels are compact; use one full row for longer labels.
- FAQ detail view shows only the selected-language approved question and answer for normal users.
- Owner/Sudo `/faq` remains a management surface and may expose Browse, Add, Inactive, Help, Edit, Disable, Restore, and multilingual drafting according to authorization.
- Public and privileged FAQ browsing should share the same clean list/navigation grammar so visual fixes apply globally.

## Multilingual FAQ authoring
- Owner and Sudo Admins may author a FAQ from one language they understand confidently: Burmese, English, or Simplified Chinese.
- The chosen source-language question and answer are authoritative. AI is a drafting assistant only and must never become the authority for policy facts.
- `✨ Generate other 2 languages` may use the configured Primary AI and then configured Fallback AI if necessary.
- Translation prompts must preserve meaning and must not add, remove, infer, or invent dates, fees, eligibility, accreditation, contacts, URLs, scholarship/loan/bond rules, policy terms, or promises.
- AI-generated translations are drafts. Show all three languages for review before publication.
- Nothing becomes canonical until an authorized admin presses `✅ Approve & Save`.
- If AI is unavailable, times out, returns invalid output, or both providers fail, preserve the source draft and offer retry plus manual entry for the remaining languages. AI failure must never block FAQ authoring.
- A multilingual edit draft must leave the currently-live FAQ unchanged until approval.
- Individual-field editing remains available for precise corrections after or instead of multilingual drafting.

## Escalation Inbox
- `/cases` is an Owner/Sudo administrative command. It may be used in the bot's private chat or in the configured active Staff Inbox group; do not expose it to normal users or unrelated groups.
- Show Open, Claimed, Resolved, and All filters with compact pager navigation; default to about 6 cases per page.
- Case list labels should show case number plus a compact human-readable question excerpt, newest first.
- Case detail may show operational identity data, language, status, timestamps, stored escalation reason, original question, claimant, and linked FAQ. This information is privileged and must not be exposed publicly.
- `＋ Add as FAQ` should prefill the case's original question and source language into a draft; require an authorized answer and multilingual review before publication.
- `Find Related FAQ` should help admins review an existing FAQ before deciding whether to edit it or create a new one.
- The archive is a knowledge-management surface. Live conversation Take Over/Resolve controls remain on the original Staff Inbox escalation message where reply context is correct.
- Historical cases created before reason persistence may show that their detailed reason was not stored.

## Normal FAQ message
1. concise answer
2. essential qualifying detail
3. official link/channel when relevant
4. optional next-action buttons

Avoid walls of text; split long policy answers into short paragraphs.

## Tone
- Respectful, neutral, clear.
- Never shame repeated/basic questions.
- Never imply certainty unsupported by approved knowledge.
- Avoid theatrical AI disclaimers.

## Error / no-match
Never expose raw technical errors. Say the bot cannot answer confidently, record the question for follow-up, and offer a useful next step.

## Human escalation
Tell the user their question has been recorded for authorized staff follow-up. Do not promise response time without an official SLA.

## Admin UX
- Keep admin interfaces compact and separate from student navigation.
- Show immutable Telegram user ID beside username when managing roles/users.
- Show privileged-action outcomes clearly.
- Owner-only controls must not appear available to Sudo Admins.
- Paginate long user/question lists instead of flooding chat.
- Privileged/configuration menus should expose `✕ Close` unless they are a one-shot confirmation with no persistent menu.

## Accessibility
- Do not rely on color.
- Button labels must make sense without emoji.
- Avoid excessive capitalization.
- Preserve readable Burmese and Chinese typography.

## Content integrity
Policy-sensitive answers must come from canonical data. Never creatively alter dates, costs, eligibility, accreditation, application requirements, scholarship/loan/bond rules, or official contacts.

## Interaction defaults
- `/start`: welcome + language selector for new users; concise home state for returning users.
- `/language`: one-shot language selector; successful choice saves the language, removes the picker, and sends one localized confirmation message.
- `/faq`: role-aware FAQ surface — read-only localized library for normal users; management/multilingual authoring surface for Owner/Sudo.
- `/cases`: Owner/Sudo Escalation Inbox in private chat or the active Staff Inbox group.
- Unknown command: short help path.
- Free text: log → deterministic FAQ match → grounded fallback → escalation.

## Naming
Use the institution's official name once canonically confirmed. Do not invent branding, slogans, mascots, or promises.
