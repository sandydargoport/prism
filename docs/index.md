---
title: Prism, the self-hosted family display
template: home.html
hide:
  - navigation
  - toc
---

# Prism

Prism is a self-hosted family dashboard with no subscription. It works with the tools your family already uses and leaves your data in them, so it never becomes one more place you have to keep up to date.

[Install Prism](getting-started/install.md){ .md-button .md-button--primary }
[View on GitHub](https://github.com/sandydargoport/prism){ .md-button }

---

Prism is a family dashboard you can set up for a big screen on the wall, a tablet or a phone. It connects to Google Calendar, Apple iCloud (CalDAV), Microsoft To Do, OneDrive, Open-Meteo or OpenWeatherMap, Kroger and Mariano's, and more, and puts what your family needs to know in one place. It is made for people who care about privacy, would rather not pay a subscription and are comfortable with Docker.

![Prism on a wall display, a tablet and a phone](demos/hero-light.png#only-light){ width="900" }
![Prism on a wall display, a tablet and a phone](demos/hero-dark.png#only-dark){ width="900" }

## What's inside

<div class="grid cards" markdown>

- :material-calendar-month: **Calendar**

    Google Calendar syncs both ways and iCal feeds work too. There are seven views (agenda, day, list, schedule, 2-week, month and 3-month), you can drag events to move them, and you can click an event in the widget to edit it.

    [Calendar guide →](features/CALENDAR.md)

- :material-cart-outline: **Shopping & Kroger push**

    Keep as many lists as you like, drag categories into your store's order, scan barcodes, and send the list to your cart with "Send to Kroger". It works at every Kroger banner (the store brands Kroger owns, such as Mariano's, Ralphs, King Soopers, Fred Meyer, QFC, Smith's, Fry's, Harris Teeter and 13 more).

    [Shopping guide →](features/SHOPPING.md) · [Kroger setup →](features/KROGER.md)

- :material-chef-hat: **Recipes**

    Import recipes from a web address or from Paprika, or paste recipe text. For a printed card, point your phone at it, copy the text with Live Text and paste it in. Prism splits it into the title, the ingredients (keeping any sections) and the steps.

    [Recipes guide →](features/RECIPES.md)

- :material-check-circle-outline: **Chores, Tasks, Goals**

    Kids mark chores done, a parent approves them, and the points add up toward goals, which can repeat. Tasks and wish lists sync both ways with Microsoft To Do.

    [Tasks guide →](features/TASKS.md) · [Goals guide →](features/GOALS.md)

- :material-earth: **Travel map**

    The travel map is an interactive 3D globe. Drop pins on places you have been, plan trips with several stops (as a route, a loop or a hub), and link OneDrive photos that carry GPS tags to the places they were taken.

- :material-palette-outline: **Looks**

    A new install starts with park scenery behind glass cards. Night is the same look kept dark, and Paper uses plain warm cards with no photo. There are seven palettes, each in light and dark, and you can use your own photos as the wallpaper.

    [Themes guide →](features/THEMES.md)

- :material-cellphone-link: **Mobile PWA**

    Install Prism on your home screen. A phone shows the calendar as an agenda, a tablet gets the full dashboard, and a wall display runs it as a kiosk (full screen, with no browser bars).

    [Mobile guide →](features/MOBILE.md)

</div>

## Display modes

- **Screensaver**: a photo slideshow that starts when the screen has been idle for a while, with templates you can change.
- **Away Mode**: a privacy screen that shows only photos and the clock. It turns on by itself after a long time with no use, and a parent PIN turns it off.
- **Babysitter Mode**: a screen for the sitter with emergency contacts, a QR code for the WiFi and the house rules.

## Voice (optional)

If you have an Echo, the Alexa skill lets you ask Prism for today's events and tasks, the weather, the family list, upcoming birthdays and, if you have set it up, when the school bus will arrive. It is a personal skill for your own account, and it needs no AWS Lambda or other outside hosting.

[Voice API reference →](voice-api.md)

## Self-hosted, privacy-first

- All your data stays on your own hardware. You make no vendor accounts and pay no subscription. Prism makes one anonymous update check a week, which you can switch off ([what it sends](features/TELEMETRY.md)).
- Everyone signs in with a PIN, which suits devices the whole family shares. Some actions need a parent and are off limits to children.
- It runs with Docker Compose on anything from a Raspberry Pi 4 to a large NAS.
- It works as a PWA (a web app you can install like a phone app), so wall displays, tablets and phones all get the same app.

[Install Prism →](getting-started/install.md){ .md-button .md-button--primary }
