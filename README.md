# Prism

**A subscription-free, self-hosted family dashboard that integrates with the tools you already use without becoming yet another system of record.**

![License](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)
[![Test Install](https://github.com/sandydargoport/prism/actions/workflows/test-install.yml/badge.svg)](https://github.com/sandydargoport/prism/actions/workflows/test-install.yml)

Prism is a configurable family dashboard designed for large wall-mounted screens and handheld tablets. It connects to existing services you already use—Google Calendar, Microsoft To Do, OneDrive, and more—and displays the information your family actually needs. Built for people who value privacy, hate subscriptions, and are comfortable with Docker.

## Getting Started

```bash
# Clone the repository
git clone https://github.com/sandydargoport/prism.git
cd prism

# One-line install (generates secrets, starts containers, seeds demo data)
./scripts/install.sh

# Or manual setup
cp .env.example .env
# Edit .env with your API keys and preferences
docker-compose up -d
```

Open **http://localhost:3000** and log in with PIN `1234` (parent) or `0000` (child).

## What Prism Does

Prism is a configurable family dashboard designed for large wall-mounted screens and handheld tablets. It connects to existing services you already use and displays the information your family actually needs.

### Dashboard Widgets

Build your home view with drag-and-drop widgets:

- **Calendar** - Day/week/month views syncing with Google Calendar & iCal
- **Weather** - Current conditions and forecasts via OpenWeatherMap
- **Photos** - Rotating family photo slideshow from OneDrive
- **Tasks** - To-do lists with due dates, syncs with Microsoft To Do
- **Shopping** - Grocery lists organized by category with check-off mode
- **Chores** - Assigned chores with points, pending approvals, and completion tracking
- **Meals** - Weekly meal planning grid with recipe linking
- **Messages** - Family message board with pinned and expiring messages
- **Points** - Per-child point totals and goal progress
- **Clock** - Simple digital clock with date

Widgets are resizable and rearrangeable. Your layout persists per device and can be exported/imported as JSON.

### Full-Page Modules

Beyond the dashboard, Prism includes dedicated pages for:

- **Calendar** - Full calendar with multiple view modes, event creation, and configurable hidden hours
- **Recipes** - Recipe library with URL import (schema.org), Paprika import, and favorites
- **Shopping** - Multiple lists with drag-to-reorder categories and shopping mode
- **Chores** - Chore management with group-by-person view and approval workflow
- **Tasks** - Task lists with Microsoft To Do sync
- **Meals** - Weekly meal planning with recipe linking
- **Goals** - Family goals with point allocation and recurring rewards
- **Photos** - Photo gallery with tagging for wallpaper/screensaver use
- **Babysitter** - Public info page for caregivers (emergency contacts, WiFi QR code, house rules)

### Display Modes

- **Screensaver** - Photo slideshow after idle timeout with configurable templates
- **Away Mode** - Privacy screen showing only photos and clock, auto-activates after extended inactivity
- **Babysitter Mode** - Shows caregiver information overlay

### Integrations

- **Google Calendar** - Events (read-only via iCal or OAuth)
- **Microsoft To Do** - Tasks and shopping lists (bidirectional sync)
- **OneDrive** - Photos for slideshow and wallpaper
- **OpenWeatherMap** - Weather data
- **Paprika** - Recipe import

The goal isn't to replace your existing tools. It's to bring them together in one place that works for your family's rhythms.

## Built for Self-Hosters

Prism is designed for people who:
- Want control over their family's data
- Are comfortable with Docker or basic server setup
- Prefer one-time effort over ongoing subscriptions
- Value privacy and local-first architecture

If you're looking for a plug-and-play commercial solution, Prism might not be for you. But if you're the kind of person who runs a home server or likes tinkering with self-hosted tools, you'll feel right at home.

---

## Why I Built This With AI

I've always wished I had the skillset to translate what I hold in my mind into something I can build with my hands. I need to understand foundational concepts before building on them. Without that foundation, everything feels unstable.

But despite that desire, I've never achieved fluency in software development. I've tried repeatedly, but it hasn't stuck. When I saw people building impressive projects in hours with Claude Code, I wanted to test it with something more substantial. I wanted a full application with real requirements, not just a toy project.

Initially, I thought I'd use this as a learning opportunity. I would have Claude heavily comment the code so I could eventually make changes myself. That quickly created bloated code, and I had to make a choice: prioritize a working solution or the educational experience. I chose the former. There are no shortcuts to learning software development, and I've accepted that I probably don't have the necessary dedication to master that craft right now.

I admire the configurability of DAKboard and the great UI simplicity of Skylight, but the former feels like a solo project turned paid software, and the latter feels incongruent with my sense of home. Neither path appealed to me. Instead, I made Prism open-source, hoping others could benefit from it and perhaps contribute integrations that matter to their own needs.

I see solutions through necessity. Prism exists because I needed it to exist, and AI gave me the tools to build it.

## How It Was Built

This project was built entirely with [Claude Code](https://claude.ai/code). I directed the implementation by defining requirements, designing user experience, prioritizing features, and making architectural decisions. Claude Code handled the actual coding.

**Reverse-engineering competitors:**
I used Playwright to systematically crawl DAKboard and Skylight, capturing screenshots and analyzing their features, layouts, and interaction patterns. Browser dev tools helped me understand how they handled integrations and real-time updates. This became source material for defining what Prism should do.

**Tech stack:**
- React + TypeScript frontend
- Node.js backend
- Docker for deployment
- React-grid-layout for dashboard widgets
- PIN-based auth optimized for shared family devices

**Important:** I cannot be responsible for security vulnerabilities or code quality issues. Use at your own risk. That said, I use this in my own home and will continue to maintain it as I encounter problems.

## Why Prism Exists

I didn't want to pay yet another monthly subscription. I tried several open-source projects, but they were all built for different purposes. Magic Mirror didn't support photo displays. I found another open-source Skylight alternative that looked promising but had minimal features implemented. I explored a Home Assistant setup, but it felt like I was forcing something to work in a way it didn't want to.

What I wanted was a system built for my use case, not a solution poorly adapted or force-fit into something it wasn't meant to be. I didn't want to ask my spouse to use different tools, and I didn't want to change my own workflow. I wanted a solution that worked for me rather than the other way around.

So I built Prism.

## Features I'm Excited About

Some features exist because I needed them:
- **Recipe viewer** - Not another recipe app, but a way to view recipes on a large kitchen screen without repeatedly unlocking my phone
- **Calendar parsing** - Handles the integrations that matter most to families (school calendars, work calendars, shared family events)
- **Drag-and-drop layout** - Build your dashboard the way you want it, resize and arrange widgets to fit your screen
- **Chores with approval workflow** - Kids mark chores complete, parents approve and award points
- **Screensaver modes** - Photo slideshow, away mode for privacy, babysitter mode for caregivers

Some features are still on the roadmap:
- **Bus tracking integration** - Reverse-engineering my kids' bus tracking app so departure times appear on Prism
- **Additional integrations** - Google Photos, Todoist, Home Assistant, and other services people actually use
- **Multi-household support** - For shared custody situations
- **Voice control** - "Hey Prism, what's for dinner?"
- **Offline support** - Service workers so the dashboard works even when internet is down

The architecture makes adding integrations relatively straightforward. If you contribute one that matters to you, we all benefit. Some ideas I'm less certain about (direct smart home control, music widgets) might be better handled by integrating with existing solutions like Home Assistant.

## Contributing

I built this for my family, but I'm sharing it because others might find it useful. If you do:
- ⭐ Star the repo
- 🐛 Report issues you encounter
- 💡 Suggest features that would help your family
- 🔧 Submit PRs for improvements

## License

Prism is free and open-source under the AGPL-3.0 license. It works as a PWA, so the same interface runs on wall-mounted displays, tablets, and mobile devices.

See [LICENSE](LICENSE) for details.

## Acknowledgments

Built with Claude Code. Inspired by frustration with existing solutions. Made better by the self-hosting community.

---

**Note:** This is a hobby project by someone who works in AI and product management, not a professional software developer. I use it daily and will maintain it for my own needs, which hopefully benefits others too. If you find it useful, let me know!
