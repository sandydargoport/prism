# Languages (i18n)

Prism's interface can be shown in a language other than English. Pick one under
**Settings → Appearance → Language**; the choice is saved per install and applies
to everyone using that dashboard.

English is always the fallback. Any string a translation hasn't covered yet
renders in English rather than breaking or showing a raw key, so a partial
translation is perfectly usable.

!!! note "Status: in progress"
    Translation is being done in stages. The table below is the live picture of
    what is and isn't translated yet.

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
| Calendar — widget + page | ⬜ to do |
| Chores — widget + page | ⬜ to do |
| Meals — widget + page | ⬜ to do |
| Messages — widget + page | ⬜ to do |
| Photos — widget + page | ⬜ to do |
| Shopping — widget + page | ⬜ to do |
| Tasks — widget + page | ⬜ to do |
| Travel — widget + page | ⬜ to do |
| Wishes — widget + page | ⬜ to do |
| Clock / Weather / Points / Bus widgets | ⬜ to do |
| Settings pages | ⬜ to do |
| Setup wizard | ⬜ to do |

Widgets and their matching pages are translated together so the same wording is
used in both places.

## Dates, times and numbers

Dates and numbers already follow the selected language automatically — a German
dashboard shows `24. Dez.` rather than `Dec 24`.

**12- vs 24-hour time is a separate setting**, under
**Settings → General**. It is deliberately independent of language, so you can
run an English interface with a 24-hour clock or the reverse. Choosing Deutsch
does not switch the clock for you.

## Adding or correcting a translation

Translations are plain JSON files, one per language, in `src/i18n/messages/`.
No app code is involved and you cannot break the interface by editing them: any
key you leave out simply falls back to English.

To fix a wording or fill something in:

1. Open `src/i18n/messages/de.json` (or the file for your language) on GitHub.
2. Edit the value on the right of the colon. **Leave the key on the left alone** —
   that is what the app looks up.
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

A first-time contributor is asked to sign the
[Contributor License Agreement](https://github.com/sandydargoport/prism/blob/master/CLA.md)
automatically on their pull request. It is a one-line comment and only needs
doing once.

### Adding a whole new language

1. Copy `src/i18n/messages/en.json` to `src/i18n/messages/<code>.json`.
2. Translate the values, leaving the keys untouched.
3. Register it in `src/components/providers/LocaleProvider.tsx` — import the file
   and add an entry to `APP_LOCALES` with the language's own name for itself
   (`Deutsch`, not `German`).
4. Open a pull request.

Partial translations are welcome. Untranslated keys fall back to English, so
there is no need to finish a language before contributing it.
