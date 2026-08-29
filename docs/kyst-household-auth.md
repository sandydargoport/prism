# KYST household authentication

This deployment layer sits in front of Prism's existing member PIN and role checks. It does not replace them. A household session gets a browser through the outer wall; Prism still enforces member PINs, `requirePinForDelete`, `requirePinForSettings`, API-token scopes, and role permissions underneath.

## Fly secrets

Set these four names on `kyst-board`:

- `KYST_AUTH_PASSWORD`: the household password or PIN (minimum four characters).
- `KYST_AUTH_SECRET`: 32 or more random characters used only to HMAC-sign sessions.
- `KYST_AUTH_DEVICE_TOKEN`: kiosk bootstrap credential, exactly `v1.` plus 64 lowercase hex characters.
- `KYST_AUTH_SERVICE_TOKEN`: outer-wall credential for trusted automation, exactly `v1.` plus 64 lowercase hex characters.

Generate the three random values locally without displaying them, save the only operator copy in a mode-600 credential file, then set the Fly secrets from that file. Example commands are intentionally written so normal output exposes only property names:

```bash
umask 077
auth_file="$HOME/.openclaw/credentials/kyst-board-auth.env"
{
  printf 'KYST_AUTH_SECRET=%s\n' "$(openssl rand -hex 32)"
  printf 'KYST_AUTH_DEVICE_TOKEN=v1.%s\n' "$(openssl rand -hex 32)"
  printf 'KYST_AUTH_SERVICE_TOKEN=v1.%s\n' "$(openssl rand -hex 32)"
} > "$auth_file"
printf 'KYST_AUTH_PASSWORD=' >> "$auth_file"
read -rs household_password
printf '%s\n' "$household_password" >> "$auth_file"
unset household_password
```

After review, import only the four KYST lines through stdin so values never enter the `flyctl` argument list:

```bash
set -a
. "$HOME/.openclaw/credentials/fly.env"
set +a
sed -n '/^KYST_AUTH_\(PASSWORD\|SECRET\|DEVICE_TOKEN\|SERVICE_TOKEN\)=/p' \
  "$HOME/.openclaw/credentials/kyst-board-auth.env" \
  | "$HOME/.fly/bin/flyctl" secrets import -a kyst-board
"$HOME/.fly/bin/flyctl" secrets list -a kyst-board
```

The final command must show all four names. Do not import the secrets until the kiosk bootstrap and rollback steps are ready because the import restarts the machine and immediately closes the public routes.

## Browser session contract

- Cookie name: `kyst_household_session`
- Domain: host-only `kyst-board.fly.dev` (the `Domain` attribute is intentionally omitted)
- Path: `/`
- Attributes: `HttpOnly; Secure; SameSite=Lax`
- Value: opaque `v1.<issued-at-unix-seconds>.<expires-at-unix-seconds>.<32-byte-base64url-nonce>.<HMAC-SHA256-base64url-signature>`
- Expiry: 90 days after issue; a valid request in the final 45 days renews it to another 90 days

The cookie is not a Prism member session. Member PIN prompts and destructive/settings authorization continue normally.

## Kiosk bootstrap

The real kiosk uses Chromium's default profile at `/home/admin/.config/chromium/Default` and launches from `/home/admin/.xinitrc`. Resolve its current address from the mode-600 kiosk credential file, then seed that exact profile once over SSH. These commands expose neither token nor cookie value in normal output:

```bash
kiosk_env="$HOME/.openclaw/credentials/mynode-kiosk.env"
kiosk_user=$(sed -n 's/^MYNODE_SSH_USER=//p' "$kiosk_env" | tr -d '"')
kiosk_password=$(sed -n 's/^MYNODE_SSH_PASSWORD=//p' "$kiosk_env" | tr -d '"')
kiosk_host=$(sed -n 's/^MYNODE_IP=//p' "$kiosk_env" | tr -d '"')
test -n "$kiosk_host"
SSHPASS="$kiosk_password" sshpass -e ssh -o ConnectTimeout=5 \
  -o StrictHostKeyChecking=accept-new "$kiosk_user@$kiosk_host" true

auth_file="$HOME/.openclaw/credentials/kyst-board-auth.env"
device_token=$(sed -n 's/^KYST_AUTH_DEVICE_TOKEN=//p' "$auth_file")
test -n "$device_token"

SSHPASS="$kiosk_password" sshpass -e ssh -o StrictHostKeyChecking=accept-new \
  "$kiosk_user@$kiosk_host" bash -s -- "$device_token" <<'REMOTE'
set -eu
device_token=$1
xinitrc=/home/admin/.xinitrc
backup=/home/admin/.xinitrc.pre-kyst-auth
cp -a "$xinitrc" "$backup"
restore() {
  cp -a "$backup" "$xinitrc"
  pkill -x chromium 2>/dev/null || true
}
trap restore EXIT

bootstrap_url="https://kyst-board.fly.dev/api/household-auth/device?token=$device_token"
sed -i "s#https://kyst-board.fly.dev/#$bootstrap_url#" "$xinitrc"
pkill -x chromium 2>/dev/null || true
sleep 15

python3 - <<'PY'
import datetime as dt
import sqlite3

path = "/home/admin/.config/chromium/Default/Cookies"
db = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=5)
row = db.execute(
    "SELECT host_key,name,path,is_secure,is_httponly,expires_utc "
    "FROM cookies WHERE host_key='kyst-board.fly.dev' "
    "AND name='kyst_household_session'"
).fetchone()
if row is None:
    raise SystemExit("kyst_household_session cookie not found")
expiry = dt.datetime(1601, 1, 1, tzinfo=dt.timezone.utc) + dt.timedelta(microseconds=row[5])
print(
    f"host={row[0]} name={row[1]} path={row[2]} secure={row[3]} "
    f"httponly={row[4]} expires={expiry.isoformat()}"
)
PY

restore
trap - EXIT
sleep 10
grep -F "'https://kyst-board.fly.dev/'" "$xinitrc" >/dev/null
pgrep -x chromium >/dev/null
REMOTE

unset device_token kiosk_password
```

The metadata line must report host `kyst-board.fly.dev`, name `kyst_household_session`, path `/`, secure `1`, HttpOnly `1`, and an expiry about 90 days out. The final two checks prove the canonical URL and Chromium process are restored.

The bootstrap URL is a bearer credential and Chromium may retain it in history. Immediately rotate only the device token after seeding; the already-minted session remains valid because its signature uses `KYST_AUTH_SECRET`:

```bash
auth_file="$HOME/.openclaw/credentials/kyst-board-auth.env"
new_device_token="v1.$(openssl rand -hex 32)"
sed -i "s/^KYST_AUTH_DEVICE_TOKEN=.*/KYST_AUTH_DEVICE_TOKEN=$new_device_token/" "$auth_file"
set -a
. "$HOME/.openclaw/credentials/fly.env"
set +a
sed -n '/^KYST_AUTH_\(PASSWORD\|SECRET\|DEVICE_TOKEN\|SERVICE_TOKEN\)=/p' "$auth_file" \
  | "$HOME/.fly/bin/flyctl" secrets import -a kyst-board
unset new_device_token
```

Never paste the bootstrap URL into chat, logs, screenshots, or interactive shell history. Never retain a backup containing it.

## Trusted automation

HTTP automation must send both layers where the underlying Prism route requires Prism authorization:

```text
X-Kyst-Service-Token: <KYST_AUTH_SERVICE_TOKEN>
Authorization: Bearer <existing Prism API token>
```

The outer service token alone opens the deployment wall but does not grant a Prism role or scope. Existing Prism API tokens still enforce route-level permissions. Internal `calendar-cron` and `photo-cron` are not HTTP callers: they invoke `syncAllGoogleCalendars`, `syncAllIcalCalendars`, `syncAllCalDAVCalendars`, `syncCardDAVBirthdays`, and `syncAllPhotoSources` directly, so the middleware cannot 401 those jobs.

Before enabling the wall, add `KYST_AUTH_SERVICE_TOKEN` to the mode-600 Prism automation credential file and update each trusted HTTP caller (currently `scripts/kyst_ask_nox_poll.py`, `scripts/kyst_board_task.py`, and `scripts/kyst_voice_ask_poll.py`) to send `X-Kyst-Service-Token` while retaining its existing Prism bearer token. Verify one read and one mutation through each active caller before importing the Fly secrets.

## NOX deploy and rollback

The branch is based on the live Prism `v1.17.0` commit, not a newer upstream release. As of the implementation readback, the rollback image is `ghcr.io/sandydargoport/prism@sha256:c727a8b02deff695dff97c26223d337908c704c0fa56a94f93041bc3bafec116` (Prism 1.17.0). Re-read `flyctl image show -a kyst-board` immediately before deployment and replace this digest if live state changed.

From the reviewed branch:

```bash
cd /tmp/kyst-board
test "$(git branch --show-current)" = feature/kyst-auth-wall
git status --short

set -a
. "$HOME/.openclaw/credentials/fly.env"
set +a
"$HOME/.fly/bin/flyctl" config save -a kyst-board -c /tmp/kyst-board/fly.toml -y
"$HOME/.fly/bin/flyctl" deploy -a kyst-board -c /tmp/kyst-board/fly.toml \
  --dockerfile /tmp/kyst-board/Dockerfile --remote-only --build-only
"$HOME/.fly/bin/flyctl" deploy -a kyst-board -c /tmp/kyst-board/fly.toml \
  --dockerfile /tmp/kyst-board/Dockerfile --remote-only --strategy rolling
```

Do not commit the fetched `fly.toml`; it contains KYST deployment-specific non-secret configuration. After the source deploy is healthy, import the four auth secrets through stdin as shown above, run the required readback, update trusted automation, and seed the kiosk. Do not announce completion until the kiosk renders the dashboard and fresh post-deploy calendar/photo cron lines have both appeared.

If the source deploy or auth activation fails, roll back code immediately while leaving the database untouched:

```bash
"$HOME/.fly/bin/flyctl" deploy -a kyst-board -c /tmp/kyst-board/fly.toml \
  --image ghcr.io/sandydargoport/prism@sha256:c727a8b02deff695dff97c26223d337908c704c0fa56a94f93041bc3bafec116 \
  --strategy rolling
```

The vanilla image ignores `KYST_AUTH_*`, so that rollback restores the pre-wall behavior. Keep the auth credential file; do not print or discard it during rollback.

## Required readback

After deployment:

1. Confirm `/api/health` and `/api/health/ready` remain public for Fly health checks, while `/api/health/deep` requires household authentication.
2. Confirm unauthenticated `GET /api/tasks`, `/api/family`, `/api/chores`, and `/api/settings` each returns 401 and no response body contains household data.
3. Log in through `/auth/household`, store the cookie in a cookie jar, and confirm all four endpoints return 200 with that cookie.
4. Confirm a deliberately wrong cookie and a deliberately wrong `X-Kyst-Service-Token` both return 401.
5. Confirm trusted automation returns its prior status when it sends the service header plus its existing Prism bearer token.
6. Inspect Fly logs through at least one 10-minute calendar interval and one 30-minute photo interval. Require fresh `[calendar-cron] synced` and `[photo-cron] synced` lines after the deploy; earlier lines are not proof.
7. Seed and verify the kiosk before declaring the rollout complete.
