# Meta Descriptions & Taglines

## Short Tagline (10-15 words)
A subscription-free, self-hosted family dashboard that pulls together the services you already use.

## Medium Description (25-35 words)
Prism is a self-hosted family dashboard that displays your calendars, weather, photos, recipes, and more on wall-mounted screens. No subscriptions, no cloud hosting. Built entirely with Claude Code.

## Standard Meta Description (50-60 words / ~155 characters)
Self-hosted family dashboard for people who hate subscriptions. Display calendars, weather, tasks, recipes, and photos on wall-mounted screens. Integrates with Google Calendar, Microsoft To Do, OneDrive, and more. No cloud hosting—your data stays local. Built entirely with AI assistance (Claude Code). AGPL-3.0 licensed.

## Long Description (100-120 words)
Prism is a subscription-free family dashboard designed for self-hosters. Built entirely with Claude Code, Prism pulls together calendars, tasks, photos, and more from the services you already use—Google Calendar, Microsoft To Do, OneDrive—and displays them on wall-mounted screens throughout your home.

Perfect for displaying recipes in the kitchen, morning schedules by the door, or family photos in the living room. The configurable widget system lets you build the dashboard your family actually needs. AGPL-3.0 licensed with no commercial servers and no recurring fees.

Built by someone who works in AI and product management, not a professional developer. Use at your own risk, but know that it runs in the creator's home daily.

## Product Hunt Description (250 characters)
Self-hosted family dashboard alternative to DAKboard & Skylight. No subscriptions, no cloud hosting. Displays calendars, weather, recipes & more on wall screens. Built entirely with Claude Code. AGPL-3.0 licensed. Works as PWA on tablets & phones too.

## GitHub Repository Description (350 characters)
Subscription-free, self-hosted family dashboard. Integrates Google Calendar, Microsoft To Do, OneDrive, weather & more. Built entirely with Claude Code as alternative to DAKboard/Skylight. No monthly fees, no cloud hosting. Configurable widgets, drag-and-drop layout, screensaver modes. AGPL-3.0. Created via AI assistance—use at own risk but actively maintained.

## Reddit r/selfhosted Introduction

**Prism: Self-hosted family dashboard (no subscriptions, built with Claude Code)**

I didn't want to pay yet another monthly subscription for a family dashboard, and I didn't want to manage my data redundantly in yet another system. I tried several open-source projects, but they were all built for different purposes. Magic Mirror didn't support photo displays or handle touch response well. I found another open-source Skylight alternative that looked promising but had minimal features implemented. I explored a Home Assistant setup, but it felt like I was forcing something to work in a way it didn't want to.

What I wanted was a system built for my use case, not a solution poorly adapted or force-fit into something it wasn't meant to be. I didn't want to ask my spouse to use different tools, and I didn't want to change my own workflow. I wanted a solution that worked for me rather than the other way around.

So I built Prism entirely with Claude Code.

**What it does:**
- Configurable dashboard with drag-and-drop widgets
- Integrates with Google Calendar, Microsoft To Do, OneDrive, OpenWeatherMap, Paprika (more integrations coming)
- Full-page modules for calendars, recipes, shopping lists, chores, tasks, meal planning
- Screensaver modes (photo slideshow, away mode, babysitter mode)
- Works on wall-mounted screens, tablets, and everyday devices (PWA)

**Tech stack:**
- React + TypeScript frontend
- Node.js backend
- Docker deployment
- PIN-based auth (optimized for shared family devices)

**How I built it:**
I work in AI and product management, not software development. I used Claude Code to handle the implementation while I directed requirements, UX, and architecture. I also used Playwright to reverse-engineer DAKboard and Skylight, studying both features and implementation for Prism's UX.

**Important disclaimer:**
I didn't hand-code this. I can't guarantee there aren't security issues or code quality problems. Use at your own risk. That said, this runs in my home with my family's data, and I'll maintain it as I encounter issues.

**Why share it:**
It works for my family. Maybe it'll work for yours. Plus, if others contribute integrations they need, we all benefit.

**License:** AGPL-3.0 (core app is free, no monetization)

GitHub: [link]

Would love feedback on what integrations would make this useful for your family.

## Hacker News Introduction

I built a self-hosted family dashboard (Prism) because I didn't want to pay Skylight $10/month or manage my family data redundantly in yet another system.

I tried several open-source alternatives, but they were all built for different purposes. Magic Mirror didn't support photo displays or handle touch response well. Another Skylight clone had minimal features. Home Assistant felt like forcing something to work in a way it didn't want to.

I wanted a system built for my use case, not poorly adapted from something else. So I built Prism entirely with Claude Code.

**Why this might interest HN:**

1. **Built entirely with AI** - I'm a product manager, not a developer. I directed requirements and UX, Claude Code did the implementation. This is what AI-assisted development looks like in practice for non-technical builders.

2. **Reverse-engineered competitors** - Used Playwright to reverse-engineer DAKboard and Skylight, studying both features and implementation for Prism's UX.

3. **Real dogfooding** - Runs on a wall-mounted screen in my home. I maintain it because I use it daily.

4. **AGPL-3.0** - Wanted to prevent someone from wrapping this in a service and charging for it without contributing back.

**What it does:**
Configurable dashboard (drag-and-drop widgets) that integrates with Google Calendar, Microsoft To Do, OneDrive, etc. (more integrations coming). Displays calendars, weather, recipes, shopping lists, chores, photos. Works as PWA on wall-mounted screens, tablets, and everyday devices.

**Tech:** React, TypeScript, Node.js, Docker. PIN-based auth for shared family devices.

**The obvious caveat:** I didn't hand-write this code. There are probably security issues and code quality problems. I'm transparent about that. But it works for my family, and if it's useful to others, great.

Interested in feedback on: architecture decisions, security considerations, and what integrations would make this useful beyond my specific needs.

GitHub: [link]
