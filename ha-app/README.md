# Prism — Home Assistant addon

Self-hosted family dashboard, packaged as a Home Assistant addon. One-click install, no terminal, no nginx, no certs. Bundled Postgres and Redis run inside the addon container; data persists under HA's `/data` volume so addon updates never wipe your family's history.

## Install (custom repository)

1. In Home Assistant, go to **Settings → Add-ons → Add-on store**.
2. Click the **⋮** menu in the top-right → **Repositories**.
3. Paste:
   ```
   https://github.com/sandydargoport/prism
   ```
4. Find **Prism** in the store, click **Install**.
5. Once installed, go to the **Info** tab and click **Start**.
6. Open the Web UI: HA shows a port-3000 link in the addon panel.

> **Note**: Home Assistant **addons** ≠ HACS. HACS distributes integrations and frontend cards. Prism is an addon; the install path is the custom-repository flow above, not HACS.

## Options

| Option | Default | Meaning |
|---|---|---|
| `log_level` | `info` | HA-standard log level (`trace`/`debug`/`info`/`notice`/`warning`/`error`/`fatal`). |
| `bundled_db` | `true` | Run Postgres + Redis inside this container. Set to `false` only if you already have an external Postgres + Redis and want Prism to point at them. |
| `database_url` | `` | Required when `bundled_db=false`. Example: `postgresql://user:pass@host:5432/db`. |
| `redis_url` | `` | Optional with `bundled_db=false`. Example: `redis://host:6379`. Prism degrades gracefully if absent. |
| `photos_root` | `/data/photos` | Where photos live on the host. Default works for everyone; override only if you want photos under HA's `/share` or `/media` instead. |

## Data persistence

Everything that matters lives under `/data`, which HA preserves across addon updates and snapshots:

| Path | What's there |
|---|---|
| `/data/postgres` | Postgres data directory (the family's whole history). |
| `/data/redis` | Redis dump. |
| `/data/photos/{originals,thumbs,cache}` | Photo originals, generated thumbs, OneDrive cache. |
| `/data/avatars` | Family member avatar images. |
| `/data/.prism_secrets` | Auto-generated session / encryption keys. **Do not delete** — losing this means sessions and stored OAuth tokens become unrecoverable. |
| `/data/.prism_db_password` | Auto-generated Postgres password for the bundled DB. |

If you ever need to back up Prism outside of HA's snapshot system: stop the addon, copy `/data`, restart. That's the entire state.

## Updating

When a new Prism version is published, HA Supervisor shows an **Update available** badge in the addon panel. Click **Update** — takes 2–5 min. Postgres data and your settings survive every update.

## Bundled vs external database

The default (`bundled_db: true`) is what most people want — Prism runs as a single self-contained addon, no extra services to install or maintain. The bundled Postgres uses ~50–80 MB RSS with default tuning.

`bundled_db: false` is for users who already run Postgres elsewhere (e.g. the official MariaDB addon doesn't help here — Prism is Postgres-only) and want Prism to point at it. In that mode, the addon container doesn't start its own Postgres or Redis; you supply `database_url` (required) and `redis_url` (optional but recommended). See [the Prism docs](https://sandydargoport.github.io/prism) for `DATABASE_URL` format.

## Troubleshooting

- **"Database connection refused" on first boot** — wait ~10 seconds and refresh. The bundled Postgres takes a moment to initialize on a fresh `/data` volume. Check the addon logs if it persists.
- **Lost session / can't log in after update** — `/data/.prism_secrets` was wiped. Restoring a Snapshot from before the update should bring it back.
- **Photos don't appear** — confirm `/data/photos/originals` exists and is writable. If you've changed `photos_root` in options, point it at a writable path under `/data`, `/share`, or `/media`.

## Source

Built from the same source tree as the standalone Docker image. See [github.com/sandydargoport/prism](https://github.com/sandydargoport/prism) — this addon lives in the `ha-app/` directory.
