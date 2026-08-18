# Anonymous update check

Prism checks for updates once a week. In the same request it adds **one
anonymous install** to a count the maintainer uses to understand how many people
run Prism. It is on by default and you can turn it off with a single switch.

This page tells you exactly what is sent, why, and how to disable it — whether
you prefer a checkbox or an environment variable.

## What is sent

Exactly four fields, once a week:

```json
{
  "schema": 1,
  "id": "9f2c7b3e-…",     // a random id this install made up for itself
  "version": "1.14.2",     // which Prism version you're running
  "deployment": "docker",  // how you installed: "docker", "ha", "pikapods", …
  "arch": "arm64"          // CPU architecture
}
```

The `deployment` field lets the maintainer see the split between Home Assistant,
one-click hosts like PikaPods, and plain self-hosted Docker — nothing more
specific than the channel you installed through.

You can see the live payload for your own install any time under
**Settings → About → Anonymous update check → "Show exactly what's sent."**

## What is **not** sent

- **No IP address.** The collector is built to never read or store client
  addresses.
- **No personal data.** No names, emails, family members, events, photos,
  locations, or any content you put into Prism.
- **No usage data.** Which pages you open, what you click, how long the screen
  is on — none of it is collected.
- **No account link.** The `id` is a random UUID generated on your install. It
  is not derived from your hardware, hostname, or any account, and it means
  nothing outside the maintainer's count.

The id exists for one reason: so an install that updates every week counts as
**one** install instead of dozens. That is what makes the number trustworthy —
and it is also why registry "download" counts are not (they double-count every
re-pull and every CI job).

## Why it's on by default

A self-hosted server has no other way to tell you a new version exists, and the
maintainer has no other honest way to tell how many people the project actually
serves. Keeping it on by default — like Next.js, Astro, and Homebrew do — is
what makes the install count reflect reality instead of only the handful of
people who go looking for a setting to switch on. It is anonymous, it is one
request a week, and it is one click to stop.

## Update notices are quiet

The weekly check may learn that a newer version is available. If so, Prism shows
a small line under **Settings → About** — never a pop-up, never anything on the
dashboard itself. Patch releases (`1.14.1` → `1.14.2`) are **not** surfaced at
all; you're only nudged when a new **minor or major** version lands, so a busy
release schedule never turns into nagging.

It is also disclosed **at first-run setup** — the final step of the setup wizard
shows exactly this, with an off switch right there — so it is never a surprise
you have to go hunting for.

## How to turn it off

Any one of these disables it:

- **In the app:** Settings → About → **Anonymous update check** → switch off.
  Nothing further is sent.
- **Home Assistant:** the addon's **Configuration** tab has an **Anonymous
  stats** toggle — turn it off there and the addon disables it at startup.
- **Environment variable:** set `PRISM_DISABLE_TELEMETRY=true`. This hard-disables
  the feature for the whole install (useful for distro or workplace builds) and
  greys the switch out in the UI.

## Self-hosting the collector

The collector is a small open Cloudflare Worker in
[`/collector`](https://github.com/sandydargoport/prism/tree/master/collector).
If you run your own Prism fork and want your own counts, deploy it and point
installs at it with `PRISM_TELEMETRY_URL=https://your-worker-url`. If no endpoint
is configured, Prism sends nothing at all.
