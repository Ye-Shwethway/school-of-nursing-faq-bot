# ROADMAP

Last updated: 2026-08-20

## Goal
Production Telegram FAQ assistant for a university School of Nursing in Burmese, English, and Simplified Chinese. Deterministic FAQ first, Human Staff continuity second, grounded AI as supplementary help.

## Repository policy
- `main` is canonical development + production.
- historical `test` is dormant/reference-only.
- relevant main pushes run the production workflow.

## Current checkpoint
Staff recurring availability schedule/manual override is live-accepted.

FAQ integrity recovery is live-verified for `official-info-channel`: `/faq repair` restored corrupt v8 from clean snapshot v5 as new live v9 while preserving revision history.

Newest production bug: normal-user greeting `Hi` could bypass the incomplete-input guard and be incorrectly answered by an unrelated deterministic FAQ, while `hello` behaved correctly. Root cause was routing precedence, not simply a missing word: `faq_ai_entry.ts` could run the dynamic FAQ fast path before the older lower `input_quality_entry.ts` gate.

Newest `main` slice adds a pre-FAQ quality guard and broadens low-information wording coverage. Production/live acceptance is required.

## Input-quality precedence contract
Low-information/incomplete input must be evaluated **before deterministic FAQ matching, AI, or escalation** for normal private users.

`src/pre_faq_quality_entry.ts` now sits between AI setup and the FAQ runtime. It intercepts low-information text before `faq_ai_entry.ts` can match it against FAQ content.

The older lower `src/input_quality_entry.ts` remains as a secondary safety net and uses aligned wording coverage.

Both guards bypass:
- active authorized setup/edit sessions where free text is expected
- active human-controlled conversations

## Low-information wording scope
Clarification applies to greetings, acknowledgements, thanks, bare yes/no, noise, numeric-only input, punctuation-only input, URL-only input, username-only input, phone-like input, repeated-character noise, and other extremely low-content text.

Greeting coverage now includes normalized/case-insensitive variants such as:
- `hi`, `hi!`, stretched `hii` / `hiii`
- `hello`, `hello!`, stretched hello variants
- `hey`, `hiya`, `yo`, `hi there`, `hello there`, `hey there`
- common Burmese greetings/acknowledgements such as `မင်္ဂလာပါ`, `ဟယ်လို`, `ဟိုင်း`, `ဟုတ်ကဲ့`, `အင်း`
- common Chinese greetings/acknowledgements such as `你好`, `您好`, `嗨`, `好的`, `谢谢`

Short but meaningful School terms such as `fee`, `tuition`, `admission`, `exam`, `cdm`, `scholarship`, `loan`, `bond`, `campus`, `address`, `eligibility`, and `calendar` remain allowed through to FAQ/AI handling.

A filtered greeting must receive the localized clarification copy plus the Browse FAQ button. It must never receive an unrelated FAQ answer, AI answer, or new escalation case.

## FAQ current-row and archive contract
- D1 `faq_entries` is the only live canonical FAQ store.
- `faq_key` is PRIMARY KEY: one current published row per FAQ key.
- approved update overwrites that current row and increments `version`.
- `faq_revisions.before_json/after_json` separately stores historical snapshots for audit/recovery.
- old revisions are not duplicate public FAQ rows and must not be deleted to expose current content.
- `src/faq.ts` is seed/bootstrap data, not normal production answer traffic after D1 exists.

## FAQ integrity guard
`src/faq_store.ts` validates every create/update before canonical write.

Rejected as question/answer content:
- command-only values such as `/faq` or `/start`
- rendered FAQ-management blocks containing multiple markers such as `FAQ ·`, `Key:`, `Version:`, `MY Q:`, `EN A:`, `ZH A:`
- draft-preview control text

Dynamic FAQ matching and grounded AI context skip rows that fail the integrity detector.

## Owner repair
Owner-only `/faq repair` scans current FAQ rows and restores the newest clean same-key revision snapshot as a new live version. Version history is not rewound or deleted.

Migration `0035_manual_faq_integrity_recovery.sql` documents prevention/recovery in Owner/Admin manuals.

## FAQ edit UX contract
For an existing FAQ edited through `✨ Edit from one language`:
- the current live row remains visible during the draft workflow
- draft prompts state `Draft only · live vN remains unchanged until Approve & Save.`
- text-input stages include `✕ Cancel Edit`
- Cancel clears only the edit session/draft
- only `✅ Approve & Save` publishes the next live version
- old live content becomes revision history only; multiple live versions are never displayed

## Manual pagination UX
Multi-page Owner/Admin manuals include Previous/Next plus First/Last direct jumps.

## Staff availability contract
Timezone: **Asia/Yangon / UTC+06:30**.
- recurring schedule survives plain `/available` and `/unavailable`
- plain state command overrides only until next schedule boundary
- `/unavailable <hours>` preserves recurring schedule
- `/available cancel|clear` explicitly removes recurring schedule
- private mutations mirror to Staff Inbox
- automatic effective transitions declare to private + Staff Inbox

## Migrations
Current range: `0001` through `0035`.

## Command registry
Registered command names/order/count unchanged. Schema revision remains **11**. Public 4, Sudo 12, Owner 19.

## Validation boundary
Newest input-quality slice requires:
1. production workflow green
2. normal user sends `Hi`, `hi`, `HI`, `hi!`, `hii`, `hello`, `hey`, `hi there`
3. every low-information greeting receives localized clarification + FAQ button
4. none receives a deterministic FAQ answer, AI answer, or escalation
5. Burmese/Chinese greeting variants behave the same way
6. short meaningful terms such as `fee`, `exam`, `cdm`, `loan`, `bond` still reach the normal FAQ/AI path
7. active FAQ/AI setup text sessions and human Take Over conversations remain exempt from the gate
8. existing FAQ integrity, edit cancel, staff availability, takeover lease, and AI outage behavior remain operational
