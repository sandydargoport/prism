# Prism

A subscription-free family dashboard for wall-mounted screens and tablets: calendars, chores, shopping lists, meals, photos, weather and more, in one place.

Prism connects to the tools your family already uses (Google Calendar, Microsoft To Do, Apple iCloud, OneDrive, Immich, Tandoor, Mealie, Kroger) and pulls them onto a single screen. Nothing leaves your network unless you connect it yourself.

This add-on runs the whole thing in one container. Postgres and Redis are bundled, so there is nothing else to install, and every piece of state lives under Home Assistant's `/data` volume, which means add-on updates and HA snapshots keep your family's history.

## Install

1. **Settings → Add-ons → Add-on store**, then **⋮ → Repositories**.
2. Add `https://github.com/sandydargoport/prism`.
3. Install **Prism**, then **Start** it on the Info tab.
4. Open the web UI from the add-on panel. A fresh install opens the setup wizard, where you create family members and choose each PIN.

## More

- **[Documentation](DOCS.md)** for options, the `/data` layout, updating and troubleshooting.
- **[Full docs site](https://sandydargoport.github.io/prism/)** for the user guide and every integration.
- Issues and feature requests: <https://github.com/sandydargoport/prism/issues>

Prism is licensed under [PolyForm Noncommercial 1.0.0](https://github.com/sandydargoport/prism/blob/master/LICENSE): free for personal and non-commercial use.
