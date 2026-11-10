# Apple iCloud

Show your iCloud calendars in Prism. This page also lists what iCloud does not let Prism read.

---

## What works, what doesn't

| iCloud service | Supported? | How / why not |
|---|---|---|
| **Calendars** | ✅ Yes | CalDAV (`caldav.icloud.com`): Prism reads events and can delete a single event upstream. Creating and editing events from Prism isn't connected yet. See [Calendar setup](CALENDAR.md#apple-icloud-caldav-private-calendars-reminders-alpha). |
| **Contacts** (incl. birthdays) | ✅ Yes, read-only | CardDAV (`contacts.icloud.com`). The planned [family contacts page](https://github.com/sandydargoport/prism/issues/75) will use it. |
| **Reminders / Tasks** | ❌ No | Apple moved Reminders off CalDAV-VTODO years ago. iCloud Reminders now live only in CloudKit, which has no public web API. |
| **Notes** | ❌ No | iCloud Notes have always lived only in CloudKit, with no IMAP-style or web API. |
| **Photos (shared album)** | ❌ No (was attempted) | In 2024 to 2025 Apple moved public shares from the old `sharedstreams` endpoint to a new "iCloud Links" backend in CloudKit. The old endpoint returns 404 for current shares, nothing public replaces it, and as of mid-2026 no community library works with the new backend. See [photo source setup](PHOTOS.md#sources) for the OneDrive workaround. |
| **Photos (full library)** | ❌ No | This would need CloudKit Web, which needs an Apple Developer subscription, a container ID for each app and a consent step for each user. That doesn't suit a self-hosted family dashboard. |
| **Find My** (devices / people) | ❌ No | The iCloud.com web client uses an undocumented private CloudKit endpoint. Community libraries such as `pyicloud` scrape it, but Apple breaks them with each iOS release, and **Advanced Data Protection** encrypts Find My data end to end, so the scrape returns nothing at all. The best route today is [Home Assistant's iCloud3 / FindMy integration](https://github.com/gcobb321/icloud3), whose community keeps up with the breakage; Prism could in principle read HA's `device_tracker` entities. It isn't on the roadmap, and it hasn't been ruled out either. |
| **Health / Activity** | ❌ No | HealthKit data stays on the device and is encrypted in iCloud. Only a paired iOS app can reach it, and there is no web API. |
| **iMessage** | ❌ No | There has never been a public API. |
| **Apple Music** | ❌ No (no plan) | MusicKit Web exists, but its consent step is for one user, which doesn't fit a display shared by a household. |

---

## The rule that explains the table

**Apple integration is possible if and only if the underlying protocol is an open standard.** CalDAV and CardDAV are IETF standards that Apple chose to support, and Prism uses them exactly as Nextcloud, Radicale or any other DAV client does.

Everything else lives in CloudKit, Apple's own cloud database, which is:

1. Proprietary
2. Not publicly documented for access from third-party servers
3. Built around consent given by each user in an iOS app, with no server-to-server access
4. More and more often end-to-end encrypted through Advanced Data Protection. Even if you reverse-engineer the endpoints, the data is unreadable without the user's device keys

So no amount of further research turns a ❌ into a ✅. A community library that claims to do iCloud Reminders or Find My is one of these:

- A wrapper around the private CloudKit web endpoints (it will break, and it already fails for ADP users), or
- Hardware-based, such as finding AirTags over Bluetooth, with no access to cloud data

---

## Practical advice for Apple households

- **Calendars + birthdays:** connect them through CalDAV and CardDAV on the *Apple/CalDAV* provider card under *Settings → Integrations*. These work and keep working.
- **Photos:** make OneDrive (or another supported source) the main backup for your photos. The OneDrive app on iOS and a one-tap iOS Shortcut give you a "share to Prism" step without iCloud Shared Albums. See [Photos setup](PHOTOS.md#getting-photos-into-the-folder-from-your-iphone).
- **Reminders / Notes / Find My:** copy them to another service first (Microsoft To Do syncs both ways with Prism Tasks, and Home Assistant handles presence). Prism then connects to that service, and iCloud stays out of the loop.

---

## Why this page exists

Every six months somebody (often me) asks "wait, can't we just hit the iCloud API for X?", goes off to look, finds a stale community library, builds half an integration and runs into the same wall. This page records the decision: the wall is part of how Apple built iCloud, more effort won't get through it, and the time is better spent on copying the data to another service.

The shared-album resolver that hit this wall (the details of the old `sharedstreams` protocol: partition discovery, the `330` / `X-Apple-MMe-Host` redirect, short-lived signed URLs) was written up in the [decisions log](../decisions-log.md) before its branch was deleted, so the next person doesn't have to reverse-engineer it again.
