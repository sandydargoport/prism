# Install

Install Prism on a computer that stays on at home. There are three ways to do it, and each takes a few minutes:

- If you already run Home Assistant, use the add-on (Option 3). You will not need a terminal or any certificates.
- If you have Docker on an amd64 or ARM64 machine (such as a Raspberry Pi), pull the pre-built image (Option 2).
- On any machine with Docker and git, clone the code and build it (Option 1).

When it is running, open **<http://localhost:3000>**. A fresh install opens the **setup wizard** (Welcome → Family → Household → Calendars → Look → Done), where you add each family member and choose their PIN. If you loaded the optional demo family instead, every demo account uses the PIN `1234`.

---

## Option 1: Clone and build

### HTTPS / Nginx certificate prerequisite (Linux / WSL)

The microphone, camera scanning, copy buttons and installing as an app only work when Prism is opened over `https://`. If you want a certificate that every device trusts without a warning, follow [Using https at home](https.md).

Prism's default Nginx config handles TLS (the encryption behind `https://`) on port `443` and expects these two files:

- `config/certs/prism.crt`
- `config/certs/prism.key`

If they are missing, Nginx stops with `cannot load certificate "/etc/nginx/certs/prism.crt"`.

To make a self-signed certificate on your machine, run:

```bash
mkdir -p config/certs
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout config/certs/prism.key \
  -out config/certs/prism.crt \
  -subj "/CN=localhost"
```

If you see `Permission denied` while the certificate is being written, take ownership of the folder:

```bash
sudo chown -R "$USER:$USER" config/certs
```

### Clone and run

```bash
git clone https://github.com/sandydargoport/prism.git
cd prism
bash scripts/install.sh
```

!!! tip
    If you would like to run it as `./scripts/install.sh`, make it executable first with `chmod +x scripts/install.sh`.

---

## Option 2: Pull pre-built image

The image works on amd64 and ARM64, and Docker picks the right one for your machine on its own.

```bash
# Download docker-compose.yml and .env.example
curl -O https://raw.githubusercontent.com/sandydargoport/prism/master/docker-compose.yml
curl -O https://raw.githubusercontent.com/sandydargoport/prism/master/.env.example
cp .env.example .env
# Edit .env with your secrets

docker compose up -d
```

!!! note "Raspberry Pi"
    Prism has been tested on a Pi 4 with 4 GB of memory or more. The pre-built ARM64 image runs on it as is, with nothing to compile.

---

## Option 3: Home Assistant add-on

If you already run Home Assistant (OS or Supervised), Prism installs as an add-on, and you do not have to deal with Docker Compose, Nginx or certificates.

1. Go to **Settings → Add-ons → Add-on store**.
2. Open the **⋮** menu in the top right and choose **Repositories**.
3. Paste `https://github.com/sandydargoport/prism` and click **Add**.
4. Find **Prism** in the store and click **Install**.
5. On the **Info** tab, click **Start**. The add-on panel then links to the web UI on port 3000.

By default the add-on runs its own Postgres and Redis inside its container (`bundled_db: true`) and keeps everything under Home Assistant's `/data` volume, so add-on updates and Home Assistant snapshots keep your family's history. To use a Postgres you already have, set `bundled_db: false` and fill in `database_url`.

!!! note "Add-ons are not HACS"
    HACS (the Home Assistant Community Store) only carries integrations, dashboard cards and themes, so Prism does not appear there. Install it by adding the repository as shown above.

Every add-on option, the layout of `/data` and add-on troubleshooting are in [`ha-app/README.md`](https://github.com/sandydargoport/prism/blob/master/ha-app/README.md). If your add-on is only reachable on your home network and you want Google Calendar, follow [Google Calendar without a public URL](../features/CALENDAR.md#google-calendar-without-a-public-url-oauth-playground).

---

## First login

Open **<http://localhost:3000>**. On a fresh install this takes you to the **setup wizard**, where you add your family members and set a 4- or 6-digit PIN for each one. There is no default PIN to log in with, because you choose every PIN here. The optional demo family is the only case with preset PINs, and it uses `1234` for everyone.

The next step is [first-time setup](first-time-setup.md).

## Troubleshooting

### Photo or avatar uploads return a 500

The app container runs as uid `1001` (the user ID inside the container). If the
`data/` folder mounted into it belongs to a different user, the app cannot save
photos or avatars, and uploads fail with a 500 (`docker logs prism-app` shows
`EACCES … mkdir '/app/data/...'`). The installer sets the owner for you. If you
made the folder yourself, fix it with:

```bash
docker run --rm -v "$PWD/data":/d alpine chown -R 1001:1001 /d
```

You do not need to restart the container, because the permissions are checked each time a file is written.

### Locked out: forgot a PIN

Each member picks their own 4- or 6-digit PIN in the setup wizard or under
**Settings → Security**. Someone who forgets their PIN can be locked out. You
can reset it from the server with the recovery script:

```bash
# List family members:
docker compose exec app node scripts/reset-pin.js --list

# Reset a member's PIN (must match that member's own PIN length):
docker compose exec app node scripts/reset-pin.js "Jordan" 1234
```

The script stores the new PIN the same way the app does and changes only that
member. They can log in with the new PIN straight away, without a restart.
