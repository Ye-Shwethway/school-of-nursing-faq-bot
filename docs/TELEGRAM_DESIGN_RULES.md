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
- `/language`: language selector.
- Unknown command: short help path.
- Free text: log → deterministic FAQ match → grounded fallback → escalation.

## Naming
Use the institution's official name once canonically confirmed. Do not invent branding, slogans, mascots, or promises.
