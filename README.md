# Prism

**Self-hosted family dashboard — a free, open-source alternative to Skylight Calendar and Dakboard.** Touch-friendly shared display for your kitchen, hallway, or wall: calendar, chores, tasks, photos, weather, recipes, meal planning, shopping lists, and more — all in one place, all under your roof, no subscription.

[![License](https://img.shields.io/badge/license-PolyForm%20NC%201.0-blue.svg)](LICENSE)
[![Test Install](https://github.com/sandydargoport/prism/actions/workflows/test-install.yml/badge.svg)](https://github.com/sandydargoport/prism/actions/workflows/test-install.yml)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-blue?logo=docker)](https://github.com/sandydargoport/prism/pkgs/container/prism)
![Platforms](https://img.shields.io/badge/platforms-amd64%20%7C%20arm64-green)

Prism is a configurable family dashboard designed for large wall-mounted screens and handheld tablets. **Unlike Skylight, there's no $80/yr subscription. Unlike Dakboard, your data never leaves your house.** It connects to Google Calendar, Microsoft To Do, OneDrive, Apple iCloud (CalDAV), Kroger / Mariano's, and more, and surfaces the information your family actually needs in one place. Built for people who value privacy, hate subscriptions, and are comfortable with Docker.

**Looking for a comparison?** See [Prism vs. Skylight, Dakboard, and MagicMirror²](https://sandydargoport.github.io/prism/alternatives/).

**📖 Full documentation: <https://sandydargoport.github.io/prism/>**

---

<p align="center">
  <img src="docs/demos/dashboard-dark.png" width="800" alt="Prism dashboard in dark mode">
</p>

**[See the full screenshot gallery and feature tour →](https://sandydargoport.github.io/prism/screenshots/)**

---

## Quick start

<details>
<summary><b>Option 1: Clone and build (any platform)</b></summary>

```bash
git clone https://github.com/sandydargoport/prism.git
cd prism
bash scripts/install.sh
```

</details>

<details>
<summary><b>Option 2: Pull pre-built image (includes Raspberry Pi / ARM64)</b></summary>

```bash
curl -O https://raw.githubusercontent.com/sandydargoport/prism/master/docker-compose.yml
curl -O https://raw.githubusercontent.com/sandydargoport/prism/master/.env.example
cp .env.example .env
docker-compose up -d
```

</details>

Open **<http://localhost:3000>** and log in with PIN `1234` (parent) or `0000` (child).

Full installation notes (HTTPS / Nginx cert prerequisite, Raspberry Pi notes, troubleshooting) are in the [install guide](https://sandydargoport.github.io/prism/getting-started/install/).

---

## What's in the docs

- **[Get Started](https://sandydargoport.github.io/prism/getting-started/install/)** — install, first-time setup, updating
- **[User Guide](https://sandydargoport.github.io/prism/HELP/)** — calendar, shopping, recipes, tasks, goals, mobile PWA
- **[Integrations](https://sandydargoport.github.io/prism/features/KROGER/)** — Kroger / Mariano's cart push, Home Assistant, Voice API for Alexa
- **[Changelog](https://sandydargoport.github.io/prism/CHANGELOG/)** — every release

---

## Behind the project

I wanted a family dashboard that connected to the tools we already use and didn't require a monthly subscription. DAKboard is configurable but feels like a solo project that outgrew itself. Skylight is clean but fairly limited. Both offer free tiers that don't go very far, and the paid versions cost money on an ongoing basis. Open-source alternatives like MagicMirror², Homarr, and Home Assistant exist, but they're all built for somewhat different use cases.

The integrations reflect the tools my family actually uses: Microsoft To Do for tasks and shopping, Google Calendar for scheduling, OneDrive for photos, Open-Meteo / OpenWeatherMap for weather, Kroger online cart for groceries.

I'm not a software developer, but I work in a technical field where AI tools are increasingly central to how work gets done. This project was built entirely with [Claude Code](https://claude.ai/code) — I directed requirements, design, and product decisions; Claude Code handled the implementation. I've done what I can to make this solid (CI pipeline, E2E tests, security policy), but I can't make guarantees I'm not qualified to make. Use reasonable judgment about what you expose to the internet.

If something is missing or broken, open an issue or submit a PR.

## Contributing

- Star the repo
- Report issues you encounter
- Suggest features that would help your family
- **Vote on the roadmap** (see below)
- Submit PRs for improvements

See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

### Vote on what gets built next

The public roadmap lives in the [**Prism Roadmap** Project](https://github.com/users/sandydargoport/projects/3). Each item is an issue tagged `roadmap`. React with any emoji — 👍, ❤️, 🚀, 🎉 — to signal you want it built. The priority order on the [vote-rank list](https://github.com/sandydargoport/prism/issues?q=is%3Aissue+is%3Aopen+label%3Aroadmap+sort%3Areactions-desc) sums all reactions, so it doesn't matter which one you pick.

**How to react on an issue:** open the issue, look at the bottom-right of the issue body for the small 😊 icon, click it, pick any reaction. Reactions on the issue body count toward the sort; reactions on comments do not.

Your reactions shape what ships next.

## License

Prism is open-source under the [PolyForm Noncommercial 1.0.0](LICENSE) license. Free for personal and non-commercial use.

## Acknowledgments

Built with Claude Code. Inspired by frustration with existing solutions. Made better by the self-hosting community.
