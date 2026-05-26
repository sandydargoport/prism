# Prism vs. Skylight, Dakboard, and MagicMirror²

A factual comparison for anyone evaluating a shared family display.

The TL;DR: Skylight is the easiest if you're willing to pay forever, Dakboard is fine if you trust someone else with your calendar, MagicMirror² is great if you enjoy YAML and live alone, and Prism is the answer if you want **no subscription, no cloud, and a touch-first interface the whole family will actually use** — and you're comfortable running Docker.

---

## The matrix

| | **Prism** | **Skylight Calendar** | **Dakboard** | **MagicMirror²** |
|---|---|---|---|---|
| **License** | Open source ([PolyForm NC](https://polyformproject.org/licenses/noncommercial/1.0.0/)) | Closed, proprietary | Closed, proprietary | Open source (MIT) |
| **Hardware** | Bring your own (any browser + touch optional) | Branded device only ($159–$299) | Bring your own (any browser) | Optimized for one-way mirror + Raspberry Pi |
| **Data storage** | **100% local** — Postgres in your house | Their cloud | Their cloud (some self-host tiers) | Local on the Pi |
| **Subscription** | **$0/month, forever** | ~$80/yr Plus subscription | $0–$15/mo per display | $0 |
| **Setup difficulty** | Docker Compose + ~15 min | Plug in, done | Sign up, done | Linux + JS modules + community plugins |
| **Touch UI** | ✅ Designed touch-first | ✅ | Partial (kiosk-mode-ish) | ❌ Display-only |
| **Multi-user PIN auth** | ✅ | Limited | ❌ | ❌ |
| **Custom layouts per display** | ✅ Per-display layouts + screensaver | Single layout | ✅ | ✅ Via config |
| **Mobile companion** | ✅ PWA + barcode scanner | Their app | Mobile control panel | ❌ |
| **Google Calendar** | ✅ OAuth + iCal | ✅ | ✅ | ✅ Via module |
| **Apple iCloud** | ✅ CalDAV (calendars + contacts→birthdays) | ✅ | ✅ | ✅ Via module |
| **Microsoft To Do** | ✅ | ❌ | Limited | ✅ Via module |
| **Chores with kid approval flow** | ✅ Built-in points + redemption | Limited | ❌ | ❌ |
| **Meal planning + recipes** | ✅ Built-in (Paprika import, OCR) | ❌ | ❌ | Via module |
| **Photo screensaver** | ✅ OneDrive sync + slideshow + Ken Burns | ✅ | ✅ | Via module |
| **Shopping with Kroger / Mariano's push** | ✅ One-click cart push | ❌ | ❌ | ❌ |
| **Home Assistant integration** | 🚧 [In progress (#81)](https://github.com/sandydargoport/prism/issues/81) | ❌ | Limited | ✅ Native HA card available |
| **Voice / Alexa skill** | ✅ Voice API foundation (v1.8) | ❌ | ❌ | Via module |
| **Vendor lock-in** | None — your data, your DB | High | Medium | None |
| **You own your data** | ✅ Always | ❌ Hosted by Skylight | ❌ Hosted by Dakboard | ✅ |
| **Works offline (your LAN)** | ✅ | ❌ | ❌ | ✅ |

---

## Where each one is actually the right choice

### Choose Skylight Calendar if…

- You want the simplest possible setup and don't mind paying a recurring subscription
- You're not technical, don't want to manage a server, and don't have Docker experience
- The non-negotiable feature is the **dedicated, polished hardware** with a frame finish that looks nice on a kitchen wall
- You're OK with your family calendar living in someone else's cloud

### Choose Dakboard if…

- You already have a spare display you want to repurpose
- You're OK with the subscription cost for the convenience
- You don't need touch interactivity — Dakboard is primarily a display dashboard

### Choose MagicMirror² if…

- You enjoy tinkering with Raspberry Pi configs, YAML, and community modules
- You're building a smart mirror (literally, a two-way mirror over a display) and don't need touch
- You're comfortable being the IT department for your own dashboard

### Choose Prism if…

- You want a shared family display that actually feels like a product, not a hobbyist project
- The whole family needs to interact with it (touch, multi-user PINs, chore tracking, shopping list updates from your phone)
- You refuse to pay $80/yr forever for software that should be open
- You want your calendar, chores, and photos to **stay in your house**
- You're comfortable running `docker-compose up` (or are willing to learn — there's an installer)

---

## What Prism is honestly worse at

Being fair:

- **Hardware curation.** Skylight ships a beautiful purpose-built display. You have to source your own (a 27" 4K display + a small PC works great, but you have to pick it).
- **Onboarding friction.** Skylight is plug-and-play. Prism needs Docker + ~15 minutes of setup. We're working on the Home Assistant addon path ([#81](https://github.com/sandydargoport/prism/issues/81)) to close this gap.
- **Mature ecosystem.** MagicMirror² has a community module for everything. Prism is younger; we're integration-rich but not module-exhaustive.

If those trade-offs are deal-breakers for your household, one of the others is the better fit. If they aren't — Prism is what you've been looking for.

---

## Pricing comparison over 5 years

| | Year 1 | Year 5 | Notes |
|---|---|---|---|
| **Prism** | $0 (+ ~$300 one-time hardware if buying a display + mini PC) | $0 | Open source, runs on what you have |
| **Skylight 15"** | $299 device + $80 subscription = $379 | $719 | Subscription required for full features |
| **Dakboard Premium** | $155/yr per display | $775 per display | Per-display pricing |
| **MagicMirror²** | $0–$60 (Raspberry Pi) | $0 | Free, hardware optional |

Prices accurate as of mid-2026; check current vendor pages.
