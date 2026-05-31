# iCloud integration

What Prism can and can't pull from iCloud, and why.

If you have an Apple household and want Prism to surface family data living in iCloud — calendars, contacts, photos, Reminders, Notes, Find My — read this once. The answer is consistent across the table, the rule explains the table, and the rule isn't going to change.

---

## What works, what doesn't

| iCloud surface | Supported? | How / why not |
|---|---|---|
| **Calendars** | ✅ Yes, two-way | CalDAV (`caldav.icloud.com`). See [Calendar setup](CALENDAR.md#apple-icloud-caldav--private-calendars--reminders--alpha). |
| **Contacts** (incl. birthdays) | ✅ Yes, read-only | CardDAV (`contacts.icloud.com`). Used by the planned [family contacts page](https://github.com/sandydargoport/prism/issues/75). |
| **Reminders / Tasks** | ❌ No | Apple migrated Reminders off CalDAV-VTODO years ago; iCloud Reminders are CloudKit-only with no public web API. |
| **Notes** | ❌ No | iCloud-synced Notes have always been CloudKit-only. No IMAP-style or web API. |
| **Photos (shared album)** | ❌ No (was attempted) | Apple migrated public shares from the old `sharedstreams` endpoint to a new "iCloud Links" CloudKit backend in 2024–2025. The legacy endpoint returns 404 for modern shares; no public replacement exists, and no community library targets the new backend as of mid-2026. See [photo source setup](PHOTOS.md#sources) for the OneDrive-based workaround. |
| **Photos (full library)** | ❌ No | Would require CloudKit Web, which requires an Apple Developer subscription, container ID per app, and per-user consent flow — wrong shape for a self-hosted family dashboard. |
| **Find My** (devices / people) | ❌ No | The iCloud.com web client uses an undocumented private CloudKit endpoint. Community libraries like `pyicloud` scrape it, but Apple breaks them with each iOS release, and **Advanced Data Protection** end-to-end encrypts Find My data so the scrape no longer returns it at all. Best upstream path today: [Home Assistant's iCloud3 / FindMy integration](https://github.com/gcobb321/icloud3), which has a community actively wrangling these breaks; Prism could in principle read HA's `device_tracker` entities. Not on the roadmap, but the door isn't closed. |
| **Health / Activity** | ❌ No | HealthKit data is on-device + iCloud-encrypted; only accessible via a paired iOS app, no web API. |
| **iMessage** | ❌ No | No public API, ever. |
| **Apple Music** | ❌ No (no plan) | MusicKit Web exists but the consent flow is single-user and the wrong fit for a shared household display. |

---

## The rule that explains the table

**Apple integration is possible if and only if the underlying protocol is an open standard.** CalDAV and CardDAV are IETF standards Apple chose to support; Prism rides those standards exactly like Nextcloud, Radicale, or any other DAV consumer.

Everything else lives in CloudKit, which is:

1. Proprietary
2. Not publicly documented for third-party server access
3. Designed around per-user iOS-app consent, not server-to-server federation
4. Increasingly end-to-end encrypted via Advanced Data Protection — even if you reverse-engineer the endpoints, the payloads are useless without the user's device keys

This means there's no "more research" path that turns a ❌ into a ✅. If you see a community library that claims iCloud Reminders or Find My, it is either:

- A wrapper around the private CloudKit web endpoints (will break, and already broken for ADP users), or
- Hardware-side (e.g. AirTag-finding via Bluetooth, not cloud data access)

---

## Practical advice for Apple households

- **Calendars + birthdays:** wire them up via CalDAV / CardDAV in *Settings → Connected Accounts*. These genuinely work and stay working.
- **Photos:** use OneDrive (or another supported source) as the canonical backup target. iOS's OneDrive app + a one-tap iOS Shortcut covers the "share to Prism" workflow without iCloud Shared Albums. See [Photos setup](PHOTOS.md#getting-photos-into-the-folder-from-your-iphone).
- **Reminders / Notes / Find My:** mirror them somewhere else first (Microsoft To Do supports two-way sync with Prism Tasks; Home Assistant for presence). Prism integrates the mirror, not iCloud directly.

---

## Why this page exists

Because every six months somebody (often me) asks "wait, can't we just hit the iCloud API for X?" and goes off to investigate, finds a stale community library, builds half of an integration, and discovers the same wall. This page is the doctrine note: the wall is structural, not "we haven't tried hard enough," and the energy is better spent on the mirror approach.
