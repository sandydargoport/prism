# Prism Requirements — Section Index

> **Source:** `prism-requirements_v19.md` (unchanged, remains source of truth)
> **Purpose:** Quick navigation guide for Claude and developers

---

## Table of Contents

| # | File | Description | Lines | Status |
|---|------|-------------|-------|--------|
| 01 | [01-overview.md](01-overview.md) | Project overview, tech stack, display specs, personas & permissions | 1–103 | Done |
| 02 | [02-calendar.md](02-calendar.md) | Multi-calendar system: sources, mapping, views, sync | 106–190 | Done |
| 03 | [03-tasks.md](03-tasks.md) | Task management, Microsoft To Do integration | 193–248 | Done |
| 04 | [04-chores.md](04-chores.md) | Chores system, points, approval workflow, permissions | 251–336 | Done |
| 05 | [05-shopping.md](05-shopping.md) | Shopping lists, categories, voice input, mobile access | 338–445 | Partial |
| 06 | [06-meals.md](06-meals.md) | Meal planning, weekly list, Paprika integration | 448–509 | Done |
| 07 | [07-maintenance.md](07-maintenance.md) | Home/car/appliance maintenance reminders | 512–564 | Done |
| 08 | [08-weather-clock.md](08-weather-clock.md) | Weather widget + clock widget | 567–632 | Done |
| 09 | [09-photos.md](09-photos.md) | Photo slideshow, sources, screensaver mode | 635–666 | Not started |
| 10 | [10-messages.md](10-messages.md) | Family messaging board | 669–719 | Done |
| 11 | [11-birthdays.md](11-birthdays.md) | Birthday reminders, countdown, sync | 722–754 | Done |
| 12 | [12-away-mode.md](12-away-mode.md) | Away/Travel mode, privacy screen | 757–798 | Not started |
| 13 | [13-themes.md](13-themes.md) | Dark/Light mode + 12 seasonal themes | 801–918 | Partial |
| 14 | [14-layouts.md](14-layouts.md) | Customizable layouts, drag-drop, templates | 921–998 | Not started |
| 15 | [15-solar.md](15-solar.md) | Solar panel monitoring (Enphase) | 1001–1060 | Not started |
| 16 | [16-sonos.md](16-sonos.md) | Sonos/music control widget | 1062–1106 | Not started |
| 17 | [17-babysitter.md](17-babysitter.md) | Babysitter info screen, emergency contacts | 1107–1194 | Not started |
| 18 | [18-animations.md](18-animations.md) | Delightful animations, monthly theme transitions | 1197–1352 | Not started |
| 19 | [19-location-bus-smarthome.md](19-location-bus-smarthome.md) | Family location, bus tracking, smart home (Future) | 1354–1531 | Not started |
| 20 | [20-ui-design.md](20-ui-design.md) | UI structure, touch, accessibility, responsive design | 1535–1738 | Partial |
| 21 | [21-data-architecture.md](21-data-architecture.md) | DB schema, API integrations (Google, Apple, MS, Enphase, Sonos, Weather) | 1740–2268 | Done |
| 22 | [22-project-structure.md](22-project-structure.md) | Directory structure | 2271–2459 | Done |
| 23 | [23-config.md](23-config.md) | Environment variables, user settings JSON | 2463–2593 | Done |
| 24 | [24-code-standards.md](24-code-standards.md) | Code documentation standards | 2596–2689 | Partial |
| 25 | [25-dev-workflow.md](25-dev-workflow.md) | Setup instructions, Docker, deployment | 2693–2844 | Done |
| 26 | [26-nonfunctional.md](26-nonfunctional.md) | Performance, security, reliability, usability requirements | 2848–2921 | Partial |
| 27 | [27-deployment-guide.md](27-deployment-guide.md) | Non-coder deployment guide, setup wizard | 2923–3178 | Done |
| 28 | [28-security-performance.md](28-security-performance.md) | Testing, security considerations, performance optimization, accessibility | 3179–3296 | Partial |
| 29 | [29-future-roadmap.md](29-future-roadmap.md) | Future phases & community features | 3298–3320 | N/A |
| 30 | [30-repo-docs.md](30-repo-docs.md) | GitHub repo structure, README, CONTRIBUTING, CI/CD | 3322–end | Done |

---

## Cross-References

| Topic | Primary Section | Also Referenced In |
|-------|----------------|-------------------|
| Calendar events | 02-calendar | 21-data-architecture (schema), 01-overview (permissions) |
| Task management | 03-tasks | 04-chores (comparison), 21-data-architecture (schema) |
| Chore approval workflow | 04-chores | 01-overview (permissions table), 18-animations (completion animations) |
| Shopping categories | 05-shopping | 06-meals (shopping integration) |
| Photo slideshow | 09-photos | 12-away-mode (screensaver), 14-layouts (photo frame template) |
| Birthday reminders | 11-birthdays | 02-calendar (calendar sync), 18-animations (birthday animations) |
| Away/Travel mode | 12-away-mode | 09-photos (screensaver display), 17-babysitter (babysitter mode) |
| Seasonal themes | 13-themes | 18-animations (monthly transition animations) |
| Layout system | 14-layouts | 21-data-architecture (layouts table), 20-ui-design (responsive) |
| Solar monitoring | 15-solar | 18-animations (milestone animations), 21-data-architecture (Enphase API) |
| Sonos control | 16-sonos | 21-data-architecture (Sonos API) |
| Babysitter mode | 17-babysitter | 12-away-mode (privacy modes) |
| Smart home | 19-location-bus-smarthome | 01-overview (permissions) |
| Touch targets | 20-ui-design | 26-nonfunctional (usability requirements) |
| DB schema | 21-data-architecture | All feature sections reference their schemas here |
| API credentials | 23-config | 28-security-performance (credential storage) |
| Docker deployment | 25-dev-workflow | 27-deployment-guide (non-coder version) |

---

## How to Use

1. **Start here** to find which section covers a feature
2. **Check cross-references** before making changes that span features
3. **Check status column** to understand what's implemented vs. planned
4. **Original file** (`prism-requirements_v19.md`) is the canonical source — these are extracts
