# Languages

Show Prism in English or German.

Pick one under **Settings → Appearance → Language**. The choice applies to everyone using that install.

Anything that isn't translated yet shows in English, so a language that is only partly translated still works.

!!! note "Status: in progress"
    Translation is happening in stages, and the table below shows what is done so far.

## Available languages

| Language | Code | Maintainer |
|---|---|---|
| English | `en` | built in (source language) |
| Deutsch | `de` | community |

## What's translated

| Area | Status |
|---|---|
| Navigation (sidebar, portrait nav, mobile nav) | ✅ done |
| Common actions (Save, Cancel, Delete, …) | ✅ keys ready |
| Birthdays widget | ✅ done |
| Calendar: views, toolbar, widget, add/edit event form | ✅ done |
| Chores: widget + page | ⬜ to do |
| Meals: widget + page | ⬜ to do |
| Messages: widget + page | ⬜ to do |
| Photos: widget + page | ⬜ to do |
| Shopping: widget + page | ⬜ to do |
| Tasks: widget + page | ⬜ to do |
| Travel: widget + page | ⬜ to do |
| Wishes: widget + page | ⬜ to do |
| Clock / Weather widgets | ✅ done |
| Points / Bus widgets | ⬜ to do |
| Settings pages | ⬜ to do |
| Setup wizard | ⬜ to do |

Each widget is translated together with its page, so both use the same wording.

## Dates, times and numbers

Dates and numbers already follow the language you pick. A German dashboard shows `24. Dez.` where an English one shows `Dec 24`. That includes the order of the parts as well as their names, so a German calendar header reads `4. September 2026` and an English one reads `September 4, 2026`. A translation file can't express day-first order, so Prism builds date labels from the language instead of from a fixed pattern in the code.

The choice between 12-hour and 24-hour time is a separate setting under **Settings → General**. It is kept apart from the language on purpose, so you can run an English interface with a 24-hour clock or the other way round. Choosing Deutsch doesn't change the clock for you.

## Adding or correcting a translation

Translations are plain JSON files, one per language, in `src/i18n/messages/`. They contain no app code, and editing them can't break the interface, because any key you leave out falls back to English.

To fix a wording or fill in a gap:

1. Open `src/i18n/messages/de.json` (or the file for your language) on GitHub.
2. Edit the value on the right of the colon. **Leave the key on the left alone**, because that is what the app looks up.
3. Open a pull request.

```json
{
  "common": {
    "nav": {
      "chores": "Hausarbeiten"
    }
  }
}
```

The first time you contribute, your pull request automatically asks you to sign the [Contributor License Agreement](https://github.com/sandydargoport/prism/blob/master/CLA.md). It takes a one-line comment and you only do it once.

### Adding a whole new language

1. Copy `src/i18n/messages/en.json` to `src/i18n/messages/<code>.json`.
2. Translate the values and leave the keys as they are.
3. Register it in `src/components/providers/LocaleProvider.tsx`: import the file and add an entry to `APP_LOCALES` with the language's name in that language (`Deutsch`, where English would say `German`).
4. Open a pull request.

Partial translations are welcome. Keys you haven't translated fall back to English, so you don't need to finish a language before contributing it.
