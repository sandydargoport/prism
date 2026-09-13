# Prism add-on documentation

Self-hosted family dashboard, packaged as a Home Assistant add-on. One-click install, no terminal, no nginx, no certs. Bundled Postgres and Redis run inside the add-on container; data persists under HA's `/data` volume so add-on updates never wipe your family's history.

## Install (custom repository)

1. In Home Assistant, go to **Settings → Add-ons → Add-on store**.
2. Click the **⋮** menu in the top-right → **Repositories**.
3. Paste:
   ```
   https://github.com/sandydargoport/prism
   ```
4. Find **Prism** in the store, click **Install**.
5. Once installed, go to the **Info** tab and click **Start**.
6. Open the Web UI: HA shows a port-3000 link in the add-on panel.

> **Note**: Home Assistant **add-ons** are not HACS. HACS distributes integrations and frontend cards. Prism is an add-on; the install path is the custom-repository flow above, not HACS.

## Options

| Option | Default | Meaning |
|---|---|---|
| `log_level` | `info` | HA-standard log level (`trace`/`debug`/`info`/`notice`/`warning`/`error`/`fatal`). |
| `bundled_db` | `true` | Run Postgres + Redis inside this container. Set to `false` only if you already have an external Postgres + Redis and want Prism to point at them. |
| `database_url` | `` | Required when `bundled_db=false`. Example: `postgresql://user:pass@host:5432/db`. |
| `redis_url` | `` | Optional with `bundled_db=false`. Example: `redis://host:6379`. Prism degrades gracefully if absent. |
| `photos_root` | `/data/photos` | Where photos live on the host. Default works for everyone; override only if you want photos under HA's `/share` or `/media` instead. |
| `anonymous_stats` | `true` | Opt-out install counter and update check. See the [telemetry notes](https://sandydargoport.github.io/prism/features/TELEMETRY/). |

## Data persistence

Everything that matters lives under `/data`, which HA preserves across add-on updates and snapshots:

| Path | What's there |
|---|---|
| `/data/postgres` | Postgres data directory (the family's whole history). |
| `/data/redis` | Redis dump. |
| `/data/photos/{originals,thumbs,cache}` | Photo originals, generated thumbs, OneDrive cache. |
| `/data/avatars` | Family member avatar images. |
| `/data/.prism_secrets` | Auto-generated session / encryption keys. **Do not delete**: losing this means sessions and stored OAuth tokens become unrecoverable. |
| `/data/.prism_db_password` | Auto-generated Postgres password for the bundled DB. |

If you ever need to back up Prism outside of HA's snapshot system: stop the add-on, copy `/data`, restart. That's the entire state.

## Updating

When a new Prism version is published, HA Supervisor shows an **Update available** badge in the add-on panel. Click **Update**, which takes 30 s to 5 min depending on whether the published image is cached. Postgres data and your settings survive every update.

**First install on pre-1.8.5 versions** falls back to building from source on your host (no pre-built image existed yet). Subsequent installs (and any version 1.8.5 or later) pull the pre-built `ghcr.io/sandydargoport/prism-ha-{arch}` image directly.

## Bundled vs external database

The default (`bundled_db: true`) is what most people want: Prism runs as a single self-contained add-on, no extra services to install or maintain. The bundled Postgres uses ~50-80 MB RSS with default tuning.

`bundled_db: false` is for users who already run Postgres elsewhere (the official MariaDB add-on doesn't help here, since Prism is Postgres-only) and want Prism to point at it. In that mode, the add-on container doesn't start its own Postgres or Redis; you supply `database_url` (required) and `redis_url` (optional but recommended). See [the Prism docs](https://sandydargoport.github.io/prism) for `DATABASE_URL` format.

## Connecting Google Calendar on a LAN-only install

Google refuses to register a private LAN address as an OAuth redirect URI, so the normal **Connect** button cannot finish on a typical add-on install. Use **Settings → Integrations → Google → "Connect without a public URL (advanced)"**, which walks you through generating a refresh token with Google's OAuth Playground. Full two-way sync, no reverse proxy or tunnel needed. See [Google Calendar without a public URL](https://sandydargoport.github.io/prism/features/CALENDAR/#google-calendar-without-a-public-url-oauth-playground).

## Troubleshooting

- **"Database connection refused" on first boot**: wait ~10 seconds and refresh. The bundled Postgres takes a moment to initialize on a fresh `/data` volume. Check the add-on logs if it persists.
- **Lost session / can't log in after update**: `/data/.prism_secrets` was wiped. Restoring a Snapshot from before the update should bring it back.
- **Photos don't appear**: confirm `/data/photos/originals` exists and is writable. If you've changed `photos_root` in options, point it at a writable path under `/data`, `/share`, or `/media`.

## Source

Built from the same source tree as the standalone Docker image. See [github.com/sandydargoport/prism](https://github.com/sandydargoport/prism); this add-on lives in the `ha-app/` directory.
