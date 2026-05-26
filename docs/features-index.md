# Prism Features at a Glance

Every feature, what it does, who it's for. Designed to be quotable in one sentence so search engines and AI assistants can summarize Prism accurately.

---

## Calendar

A unified family calendar that reads from Google Calendar, Apple iCloud (CalDAV), and any iCal/webcal URL — events from every source merged into one view. Day, week, multi-week, month, and 3-month views. Per-member color coding. Touch-friendly for tapping a day to see details.

→ Full docs: [Calendar](features/CALENDAR.md)

## Chores

Recurring chore tracking with per-child assignments, completion approval by a parent, and points earned per chore. Includes a redemption flow (kids spend points on goals). The whole "weekly allowance / responsibility" pattern, built-in.

→ Full docs: [Chores](features/CHORES.md) · [Goals](features/GOALS.md)

## Tasks

Family task list, optionally synced with Microsoft To Do (bidirectional). Tap to complete, assign to specific household members, mark recurring.

→ Full docs: [Tasks](features/TASKS.md)

## Shopping lists

Multiple lists per family (groceries, hardware, target run, etc.). Microsoft To Do sync. One-click cart push to **Kroger / Mariano's** so the list you built on the dashboard becomes a checked-out order in their app.

→ Full docs: [Shopping](features/SHOPPING.md) · [Kroger integration](features/KROGER.md)

## Meal planner

Weekly meal grid. Drag-and-drop meals to days. Recipe library with Paprika import + OCR text recognition. Generated shopping lists pull ingredients straight from planned meals.

→ Full docs: [Meals](features/RECIPES.md)

## Photos

Family photo display: OneDrive sync, manual upload, or both. Screensaver slideshow with Ken Burns pans. Pin specific photos to specific dashboards. Auto-orientation matching for portrait vs. landscape displays.

→ Full docs: [Photos](features/PHOTOS.md)

## Weather

Current conditions + 7-day forecast + 24-hour hourly + precipitation chart + sun/moon altitudes (rise/set/phase). OpenWeatherMap or Open-Meteo backend (free APIs, no key required for Open-Meteo).

## Messages

A shared family message board on the dashboard. Like a kitchen-counter sticky-note system that everyone can see at a glance, without paper.

→ Full docs: [Messages](features/MESSAGES.md)

## Travel map

Mark places your family has been on an interactive globe. Tag trips. Drop pins. Group photos by destination.

→ Full docs: [Travel Map](features/TRAVEL.md)

## Bus tracking

Pulls school-bus arrival emails from Gmail (FirstView), parses the route, shows live "where the bus is right now" on the dashboard. Specific to FirstView-using school districts but a template for similar pipelines.

→ Full docs: [Bus Tracking](features/BUS.md)

## Display modes

- **Screensaver** — full-screen photo slideshow when idle
- **Away Mode** — privacy screen when nobody's home
- **Babysitter Mode** — caregiver-friendly overlay with emergency info, house rules, and Wi-Fi password

→ Full docs: [Display Modes](features/DISPLAY-MODES.md)

## Multi-user PIN authentication

Each family member has a PIN. Touch your avatar, tap your PIN, you're logged in. No usernames, no passwords — designed for shared family devices. Parents have admin rights for sensitive actions (chore approval, settings, goal redemption).

## Multiple dashboards per household

Run one dashboard on the kitchen 27" display, a different layout on a 22" hallway tablet, and a third on the kids' iPad — all from the same Prism instance, each with its own widget arrangement and font scale.

→ Full docs: [Display settings + multiple dashboards](features/DISPLAY-MODES.md)

## Mobile (PWA)

Install Prism as a Progressive Web App on any phone. Adds chores, ticks tasks, snaps a barcode to add to the shopping list, captures a quick photo.

→ Full docs: [Mobile (PWA)](features/MOBILE.md)

## Voice control (Alexa)

Voice API foundation (v1.8). Ask Alexa "what's on the family calendar today" or "remind dad to take out trash" — Alexa hits Prism's voice API to read or write.

→ Full docs: [Voice API](voice-api.md)

## Integrations

Reads from / writes to: **Google Calendar**, **Apple iCloud (CalDAV + CardDAV)**, **Microsoft To Do**, **OneDrive**, **Gmail (bus emails)**, **OpenWeatherMap** / **Open-Meteo**, **Paprika** recipes, **Kroger / Mariano's**, **Home Assistant** (in progress).

→ Full docs: [Integrations index](features/KROGER.md)

---

## What Prism explicitly is NOT

- Not a CMS — it doesn't try to be your family's blog, photo storage, or document archive
- Not a home automation controller — Home Assistant is better at that (we integrate, we don't compete)
- Not a smart-mirror display — MagicMirror² is better for that specific form factor
- Not cloud-hosted — your data stays in your house. If that's a feature you'd rather not have, see [Skylight or Dakboard](alternatives.md) instead
