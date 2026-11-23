# Prism telemetry collector

A tiny [Cloudflare Worker](https://developers.cloudflare.com/workers/) + [D1](https://developers.cloudflare.com/d1/)
database that receives Prism's weekly anonymous check-in, counts **active
installs** (de-duplicated by a random install id), and replies with the latest
published version so installs can show an "update available" line. It also
takes the feedback votes from the card in More (one answer per install per
question).

It is the maintainer-side half of the opt-out update check in
`src/lib/telemetry/`. Runs comfortably inside Cloudflare's free tier.

## What it stores

One row per install, and nothing else:

| column | example | notes |
|---|---|---|
| `id` | `9f2c…` | random UUID the install generated for itself |
| `version` | `1.14.2` | running app version |
| `deployment` | `docker` / `ha` | distribution channel |
| `arch` | `x64` / `arm64` | CPU architecture |
| `first_seen` / `last_seen` | ISO timestamps | for active-install windows |

A second table, `votes`, holds one row per install per question:

| column | example | notes |
|---|---|---|
| `id` | `9f2c…` | the same random install id as `checkins.id` |
| `referendum` | `2026-11-navigation` | question id, from `src/lib/feedback/referendum.ts` |
| `answer` | `bottom-bar` | answer id; a second vote from the install replaces it |
| `updated_at` | ISO timestamp | when the answer was last set |

**No IP address, no cookies, no fingerprint, no usage data.** The Worker never
reads the client address. The id is meaningless outside these tables.

## Deploy

```bash
cd collector
npm i -g wrangler        # if you don't have it
wrangler login

# 1. Create the D1 database and paste the printed id into wrangler.toml
wrangler d1 create prism-telemetry

# 2. Create the table
wrangler d1 execute prism-telemetry --remote --file=schema.sql

# 3. Set the stats token (any random string) and deploy
wrangler secret put STATS_TOKEN
wrangler deploy
```

`wrangler deploy` prints the Worker URL, e.g.
`https://prism-telemetry.<you>.workers.dev`.

## Update a running collector for feedback votes

A collector deployed before votes existed needs the `votes` table, then the new
Worker. Every statement in `schema.sql` is `IF NOT EXISTS`, so running it again
adds the new table and leaves `checkins` and its rows as they are. Table first,
then the Worker:

```bash
cd collector
wrangler d1 execute prism-telemetry --remote --file=schema.sql
wrangler deploy
```

Votes arrive at `POST /vote` (or `/v1/vote`) on the same Worker as the check-in;
the app works the address out from its check-in endpoint, so nothing in Prism's
settings changes.

## Point Prism at it

Set the endpoint the app checks in to, either way:

- **Per deployment:** `PRISM_TELEMETRY_URL=https://prism-telemetry.<you>.workers.dev`
- **Baked into release builds:** set `DEFAULT_TELEMETRY_ENDPOINT` in
  `src/lib/telemetry/constants.ts` to that URL.

Until one of those is set, the app sends nothing — the feature is inert.

## Read the numbers

```bash
curl "https://prism-telemetry.<you>.workers.dev/stats?token=<STATS_TOKEN>"
```

```json
{
  "totalInstalls": 412,
  "activeInstalls7d": 231,
  "activeInstalls30d": 388,
  "byVersion":   [{ "version": "1.14.2", "n": 190 }, …],
  "byDeployment":[
    { "deployment": "docker",   "n": 240 },
    { "deployment": "ha",       "n": 88  },
    { "deployment": "pikapods", "n": 60  }
  ],
  "votes": {
    "2026-11-navigation": { "total": 57, "answers": { "bottom-bar": 41, "sidebar": 16 } }
  }
}
```

`votes` has one entry per question: how many installs answered, and how many
chose each answer, each install counted once at its latest answer.

`activeInstalls7d` is the honest "how many live installs" number — de-duplicated
and free of the CI/re-pull inflation that makes registry pull counts unreliable.
