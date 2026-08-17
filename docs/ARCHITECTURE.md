# Architecture

Telegram update → Cloudflare Worker → identity/language persistence → deterministic FAQ match → grounded Gemini fallback → human escalation.

## Persistence
Cloudflare D1 stores users, language preference, submitted questions, escalation state, Owner/Sudo Admin roles, and privileged audit events.

## Authorization
`BOT_OWNER_TELEGRAM_ID` is runtime configuration and authoritative for Owner bootstrap. Sudo Admin roles use immutable Telegram user ID. Username is display/search metadata only.

## FAQ data
Approved FAQs use stable keys plus canonical Burmese question/answer, meaning-preserving English and Simplified Chinese translations, and aliases/keywords. Policy-sensitive facts are deterministic data, not model-generated facts.

## AI boundary
Gemini is a fallback interpreter, never the source of institutional truth. It may answer only from approved knowledge supplied in context. If grounding is insufficient, retain/create an escalation.

## Privacy
The public repo contains schema/code only. Production user/question rows remain in D1 and are exposed only through authorized operational paths.
