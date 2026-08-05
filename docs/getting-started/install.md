# Installing Prism

Prism ships as a Docker Compose application. You have two install paths:

1. **Clone and build**: for any platform with Docker + git.
2. **Pull pre-built image**: for amd64 or ARM64 (Raspberry Pi).

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
