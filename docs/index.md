---
title: Prism, the self-hosted family display
template: home.html
hide:
  - navigation
  - toc
---

# Prism

**A subscription-free, self-hosted family dashboard that integrates with the tools you already use without becoming yet another system of record.**

[Install Prism](getting-started/install.md){ .md-button .md-button--primary }
[View on GitHub](https://github.com/sandydargoport/prism){ .md-button }

---

Prism is a configurable family dashboard for large wall-mounted screens, tablets, and phones. It connects to Google Calendar, Apple iCloud (CalDAV), Microsoft To Do, OneDrive, Open-Meteo / OpenWeatherMap, Kroger / Mariano's, and more, and surfaces the information your family actually needs in one place. Built for people who value privacy, hate subscriptions, and are comfortable with Docker.

![Prism on a wall display, a tablet and a phone](demos/hero-light.png#only-light){ width="900" }
![Prism on a wall display, a tablet and a phone](demos/hero-dark.png#only-dark){ width="900" }

## What's inside

<div class="grid cards" markdown>

- :material-calendar-month: **Calendar**

    Bidirectional Google Calendar sync, iCal support, seven view modes (agenda / day / list / schedule / 2-week / month / 3-month), drag-and-drop, and click-to-edit from the widget.

    [Calendar guide →](features/CALENDAR.md)

- :material-cart-outline: **Shopping & Kroger push**

    Multiple lists, drag-to-reorder categories, barcode scanning, and one-click "Send to Kroger". Works at every Kroger banner (Mariano's, Ralphs, King Soopers, Fred Meyer, QFC, Smith's, Fry's, Harris Teeter, and 13 more).

    [Shopping guide →](features/SHOPPING.md) · [Kroger setup →](features/KROGER.md)

- :material-chef-hat: **Recipes**

    URL import, Paprika import, and "paste OCR'd recipe text": point your phone at a recipe card, Live Text it, paste, and Prism splits it into title, ingredients (sections preserved), and step-by-step instructions.

    [Recipes guide →](features/RECIPES.md)

- :material-check-circle-outline: **Chores, Tasks, Goals**

    Kids mark chores complete, parents approve and award points, points roll up to goals with recurring rewards. Microsoft To Do bidirectional sync for tasks and wish lists.

    [Tasks guide →](features/TASKS.md) · [Goals guide →](features/GOALS.md)

- :material-earth: **Travel map**

    Interactive 3D globe. Drop pins for visited places, plan multi-stop trips (route / loop / hub), and link GPS-tagged OneDrive photos to the places where they were taken.

- :material-palette-outline: **Looks**

    A new install opens on park scenery behind glass cards. Night keeps it dark; Paper drops the photo for plain warm cards. Seven palettes in light and dark, and your own photos as the wallpaper.

    [Themes guide →](features/THEMES.md)

- :material-cellphone-link: **Mobile PWA**

    Install Prism to your home screen. Agenda-only calendar on phone, full dashboard on tablet, kiosk-style on a wall display.

    [Mobile guide →](features/MOBILE.md)

</div>

## Display modes

- **Screensaver**: photo slideshow after idle timeout, configurable templates.
- **Away Mode**: privacy screen with photos and clock only, auto-activates after extended inactivity. Parent PIN to exit.
- **Babysitter Mode**: caregiver overlay with emergency contacts, WiFi QR, and house rules.

## Voice (optional)

If you have an Echo, the **Alexa skill** lets you ask Prism for today's events, today's tasks, the weather, the family list, upcoming birthdays, and (if configured) the school bus ETA. Single-user personal skill: no AWS Lambda, no third-party hosting.

[Voice API reference →](voice-api.md)

## Self-hosted, privacy-first

- All data stays on your hardware. No vendor accounts, no subscriptions. One anonymous weekly update check, which you can switch off ([what it sends](features/TELEMETRY.md)).
- PIN-based auth optimized for shared family devices. Parent vs. child roles for sensitive actions.
- Runs as Docker Compose on anything from a Raspberry Pi 4 to a beefy NAS.
- Works as a PWA: same UI on wall displays, tablets, and phones.

[Install Prism →](getting-started/install.md){ .md-button .md-button--primary }
