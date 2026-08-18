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
- After a valid language is saved, acknowledge the choice with a short callback toast and delete the selector message so it does not remain as chat clutter.
- Do not send a second persistent confirmation message after a successful language choice.
- Users can reopen the selector at any time with `/language`.

## Public FAQ library
- `/faq` is a public command and must be visible to normal users as well as privileged users.
- Normal users receive a read-only FAQ library. Never expose Add, Edit, Disable, Restore, inactive entries, internal keys, revision metadata, or other management controls.
- FAQ list labels should use the user's saved language and show human-readable questions/topics rather than internal slugs.
- Paginate long FAQ lists instead of dumping every FAQ into one tall message. Default to about 6–8 items per page.
- Use two buttons in a row only when both labels are compact; use one full row for longer labels.
- FAQ detail view shows only the selected-language approved question and answer for normal users.
- Owner/Sudo `/faq` remains a management surface and may expose Browse, Add, Inactive, Help, Edit, Disable, and Restore according to authorization.
- Public and privileged FAQ browsing should share the same clean list/navigation grammar so visual fixes apply globally.

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
- `/language`: one-shot language selector; successful choice saves the language and auto-dismisses the selector.
- `/faq`: role-aware FAQ surface — read-only localized library for normal users; management surface for Owner/Sudo.
- Unknown command: short help path.
- Free text: log → deterministic FAQ match → grounded fallback → escalation.

## Naming
Use the institution's official name once canonically confirmed. Do not invent branding, slogans, mascots, or promises.
