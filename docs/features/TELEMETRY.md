# Update check

Prism checks for updates once a week. In the same request it adds **one
anonymous install** to a count the maintainer uses to understand how many people
run Prism. It is on by default and you can turn it off with a single switch.

## What is sent

Prism sends these fields once a week (`schema` only says which version of this list it is):

```json
{
  "schema": 1,
  "id": "9f2c7b3e-…",     // a random id this install made up for itself
  "version": "1.14.2",     // which Prism version you're running
  "deployment": "docker",  // how you installed: "docker", "ha", "pikapods", …
  "arch": "arm64"          // CPU architecture
}
```

The `deployment` field shows the maintainer how installs split between Home
Assistant, one-click hosts such as PikaPods, and plain self-hosted Docker. It
says which channel you installed through and nothing more specific.

You can see exactly what your own install sends at any time under
**Settings → About → Anonymous update check → "Show exactly what's sent."**

## What is **not** sent

- No IP address. The collector is written so it never reads or stores the
  address a request comes from.
- No personal data: no names, emails, family members, events, photos,
  locations or anything else you put into Prism.
- No usage data. Prism collects nothing about which pages you open, what you
  click or how long the screen is on.
- No link to an account. The `id` is a random UUID (a long random identifier)
  made on your install. It doesn't come from your hardware, hostname or any
  account, and it means nothing outside the maintainer's count.

The id has one job: an install that checks every week counts as one install,
where it would otherwise count as dozens. That is why the number can be trusted.
Registry download counts can't be, because they count every re-pull and every CI
job again.

## Why it's on by default

A self-hosted server has no other way to tell you a new version is out, and the
maintainer has no other honest way to know how many people use the project.
Next.js, Astro and Homebrew also keep it on by default. If it were off, the
count would only include the few people who go looking for a setting to switch
on. The check is anonymous and runs once a week, and stopping it takes one
click.

## Update notices are quiet

When the weekly check finds a newer version, Prism shows a small line under
**Settings → About**. It never shows a pop-up and puts nothing on the dashboard.
Patch releases (`1.14.1` → `1.14.2`) don't show at all. You only see a notice
when a new **minor or major** version comes out, so a busy release schedule
never turns into nagging.

The check is also explained **at first-run setup**: the last step of the setup
wizard shows this information with an off switch right there, so you never have
to go looking for it.

## How to turn it off

Any one of these turns it off:

- **In the app:** Settings → About → **Anonymous update check** → switch off.
  Nothing more is sent.
- **Home Assistant:** the addon's **Configuration** tab has an **Anonymous
  stats** toggle. Turn it off there and the addon switches the check off when it
  starts.
- **Environment variable:** set `PRISM_DISABLE_TELEMETRY=true`. This turns the
  feature off for the whole install, which suits distro or workplace builds, and
  greys out the switch in the app.

## Self-hosting the collector

The collector is a small open-source Cloudflare Worker in
[`/collector`](https://github.com/sandydargoport/prism/tree/master/collector).
If you run your own Prism fork and want your own counts, deploy it and point
installs at it with `PRISM_TELEMETRY_URL=https://your-worker-url`. If no
endpoint is set, Prism sends nothing at all.
