# First-Time Setup

After [installing Prism](install.md), the first run drops you into a short, keyless setup wizard. No accounts or API keys needed to get going.

## The setup wizard

A fresh install boots straight into the wizard (there's no default-PIN login screen). It has four steps:

1. **Welcome**: a quick intro.
2. **Family**: add each family member (name, role, avatar) and choose a **4- or 6-digit PIN** for each one.
3. **Household**: set your location by city or ZIP/postal code (time zone is detected automatically) and pick which day your week starts on.
4. **Done**: you land on a dashboard that already shows your calendar, with no one needing to sign in.

Everything the wizard sets can be revisited later in Settings. The steps below cover those edit paths plus the optional extras (integrations, layout, PWA install).

## 1. Add or edit family members

**Settings → Family Members → Add Member.**

Each member gets a name, role (parent or child), and an avatar. Parents can approve chores, exit Away Mode, and reset goals; children get a more limited UI.

## 2. Set PINs

**Settings → Family Members** (or **Settings → Security**).

Each member has their own PIN: **4 or 6 digits**, chosen per member (first in the wizard's Family step, later here). The pad auto-submits once that member's digit count is reached, so it's fast on shared devices. There is no shared family PIN and no default child PIN. Set a real PIN for everyone before exposing a deployment.

## 3. Connect integrations

**Settings → Integrations.**

You don't need any of these to share or assign events: Prism gives every member their own personal calendar plus a shared **Family** calendar out of the box, so events are color-coded and assignable with zero third-party setup. Connected accounts layer on top of that.

Most families want at least:

- **Google Calendar**: for school, work, and shared family events. OAuth-based bidirectional sync.
- **Weather**: Open-Meteo is the zero-config default (no API key). OpenWeatherMap and Pirate Weather are alternatives.
- **OneDrive**: for the photo slideshow on the screensaver and the dashboard photo widget.
- **Microsoft To Do**: if your family already uses it for tasks, shopping, or wish lists.

Optional but popular:

- **[Kroger / Mariano's cart push](../features/KROGER.md)**: send your shopping list straight into your online cart for pickup or delivery.
- **Gmail + FirstView**: school bus arrival tracking via geofence email notifications.

## 4. Customize the dashboard

Click the **Edit** button (top right) to enter layout mode. Drag widgets, resize them on the 48-column grid, and add new ones from the widget picker. Save when you're done.

Each "display" (e.g. `/d/kitchen`, `/d/bedroom`) has its own independent layout and screensaver. The default URL `/` is one of them.

## 5. Install as a PWA

On phones, tablets, and even desktop Chromium, the **Install** prompt adds Prism to the home screen. It launches without browser chrome and runs offline-tolerant for already-loaded data.

On iOS Safari: Share → Add to Home Screen.

---

Next: [updating Prism](updating.md), or jump to the [user guide](../HELP.md) for the full feature tour.
