# Installing Prism

Prism ships as a Docker Compose application, and as a Home Assistant add-on. You have three install paths:

1. **Clone and build**: for any platform with Docker + git.
2. **Pull pre-built image**: for amd64 or ARM64 (Raspberry Pi).
3. **Home Assistant add-on**: if you already run Home Assistant, no terminal or certificate work needed.

After installation, open **<http://localhost:3000>**. A fresh install has no accounts yet, so it opens the **setup wizard** (Welcome → Family → Household → Done), where you create each family member and choose their PIN. (If you loaded the optional demo seed instead, every seeded user has PIN `1234`.)

---

## Option 1: Clone and build

### HTTPS / Nginx certificate prerequisite (Linux / WSL)

Prism's default Nginx config terminates TLS on port `443` and expects:

- `config/certs/prism.crt`
- `config/certs/prism.key`

If these files are missing, Nginx fails with `cannot load certificate "/etc/nginx/certs/prism.crt"`.

Generate a local self-signed cert:

```bash
mkdir -p config/certs
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout config/certs/prism.key \
  -out config/certs/prism.crt \
  -subj "/CN=localhost"
```

If you see `Permission denied` while writing certs:

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
    If you prefer `./scripts/install.sh`, make it executable first with `chmod +x scripts/install.sh`.

---

## Option 2: Pull pre-built image

Works on both amd64 and ARM64. The manifest auto-selects the right binary.

```bash
# Download docker-compose.yml and .env.example
curl -O https://raw.githubusercontent.com/sandydargoport/prism/master/docker-compose.yml
curl -O https://raw.githubusercontent.com/sandydargoport/prism/master/.env.example
cp .env.example .env
# Edit .env with your secrets

docker-compose up -d
```

!!! note "Raspberry Pi"
    Tested on Pi 4 (4 GB+). Works with the pre-built ARM64 image, no compilation needed.

---

## Option 3: Home Assistant add-on

If you already run Home Assistant (OS or Supervised), Prism installs as an add-on. No Docker Compose, no Nginx, no certificates.

1. Go to **Settings → Add-ons → Add-on store**.
2. Open the **⋮** menu in the top right and choose **Repositories**.
3. Paste `https://github.com/sandydargoport/prism` and click **Add**.
4. Find **Prism** in the store and click **Install**.
5. On the **Info** tab, click **Start**. The add-on panel then links to the web UI on port 3000.

Postgres and Redis run inside the add-on container by default (`bundled_db: true`), and every piece of state lives under Home Assistant's `/data` volume, so add-on updates and HA snapshots preserve your family's history. Point the add-on at an existing Postgres instead by setting `bundled_db: false` plus `database_url`.

!!! note "Add-ons are not HACS"
    HACS distributes integrations, dashboard cards and themes, not add-ons, so Prism will not appear there. The custom-repository flow above is the install path.

Full option reference, the `/data` layout and add-on troubleshooting are in [`ha-app/README.md`](https://github.com/sandydargoport/prism/blob/master/ha-app/README.md). To connect Google Calendar on a LAN-only add-on install, see [Google Calendar without a public URL](../features/CALENDAR.md#google-calendar-without-a-public-url-oauth-playground).

---

## First login

Open **<http://localhost:3000>**. On a fresh install this lands on the **setup wizard**, where you create your family members and set each one's PIN (4 or 6 digits). There is no default login PIN: you choose them here. (The optional demo seed is the only case with preset PINs, and it uses `1234` for every user.)

Next: [first-time setup](first-time-setup.md).

## Troubleshooting

### Photo or avatar uploads return a 500

The app container runs as uid `1001`. If the bind-mounted `data/` directory is
owned by a different user, the app can't write photos/avatars and uploads fail
with a 500 (`EACCES … mkdir '/app/data/...'` in `docker logs prism-app`). The
installer chowns it for you; if you created the directory manually, fix it with:

```bash
docker run --rm -v "$PWD/data":/d alpine chown -R 1001:1001 /d
```

No container restart is needed. Permissions are checked at write time.

### Locked out: forgot a PIN

Each member picks their own PIN (**4 or 6 digits**) in the setup wizard or
under **Settings → Security**. If someone forgets their PIN, that member can be
locked out. Reset it from the server with the recovery script:

```bash
# List family members:
docker compose exec app node scripts/reset-pin.js --list

# Reset a member's PIN (must match that member's own PIN length):
docker compose exec app node scripts/reset-pin.js "Jordan" 1234
```

It hashes the new PIN exactly like the app and updates only that member. They
can log in immediately with the new PIN, no restart needed.
