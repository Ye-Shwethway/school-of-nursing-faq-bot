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
