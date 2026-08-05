# Public Demo Deployment

> **Status: not yet hosted.** This page is the recipe for standing up a public read-only Prism instance on your own VM. There is no live demo URL yet; when one is published, it will be linked from the [home page](index.md) and the [GitHub README](https://github.com/sandydargoport/prism).

This page explains how a public Prism demo (e.g. at a hostname like `prism-demo.duckdns.org`) would be hosted, why it's structured the way it is, and how to stand up your own copy.

## What the demo is

A read-only public Prism instance seeded with **synthetic** data: fictional family Alex / Jordan / Emma / Sophie, no real names, addresses, schools, calendars, or photos. The dashboard, calendar, chores, meals, etc. all work; mutations are intercepted by middleware and rejected with a friendly *"this is a read-only demo"* message. The database is wiped and reseeded nightly so any state that does change (login session, locally-cached layout) returns to baseline.

## Why this shape

Three things need to be true for the demo to be safe to leave running on the open internet:

1. **No real PII.** The seed file `src/lib/db/init/03-seed.sql` only ever contained fictional data. Demo deployments never receive `.env` keys for real Google Calendar / OneDrive / Gmail, so even if a visitor tried to connect external accounts, the integration credentials don't exist.
2. **Visitors can't trash it for everyone else.** `DEMO_MODE=true` is checked in `src/middleware.ts`. Every `POST/PUT/PATCH/DELETE` returns 403 with a `demo_mode` error code, except auth login/logout/session (so visitors can switch between Alex/Jordan/Emma/Sophie to see role-based UI).
3. **State drift is bounded.** A nightly cron job runs `scripts/demo-reset.sh`, which truncates every table in the public schema (except migration bookkeeping) and reapplies the seed. Worst case, the demo is wrong for ≤24 hours.

The demo is never the same host as your real install. Standing it up needs its own VM, its own DNS name, its own `.env`.

## Hosting options

### Recommended: Hetzner CPX11 (~$4/mo)

Why this is the default recommendation:

- **Predictable capacity**: pick the image, click Create, the VM is yours in 30 seconds. No region-roulette like Oracle.
- **x86, not ARM**: same architecture as your dev machine, so any ad-hoc `docker run` debugging works without `--platform` flags.
- **Trivially small bill**: CPX11 is 2 vCPU / 2 GB / 40 GB SSD for ~€3.79/mo. A demo for marketing purposes is worth $4/mo.
- **Linear UX**: the Hetzner Cloud Console has roughly 4 screens. You won't get lost.

Caveats:
- Not free (but it's $4/mo, calibrate accordingly).
- 2 GB RAM is tight if you also run the optional bus-tracking integration. For a demo without external integrations, it's fine.

### Alternative: Oracle Cloud Always Free

Why someone might pick this: it's actually free, indefinitely, and the free tier hardware is generous (4 ARM cores + 24 GB RAM + 200 GB storage).

Caveats:
- **Capacity is the catch.** ARM Always Free instances are frequently exhausted. People have spent days running scripts that retry every few minutes until capacity opens up. For a "ship it tonight" demo this is unacceptable; for a "I'm fine waiting" hobbyist it's free hardware.
- ARM-only: Prism's Dockerfile is multi-arch so this works, but cross-arch debugging from your x86 dev machine is one extra friction point.
- Console is dense. Networking has a learning curve (VCN, subnets, security lists, route tables). You don't need to understand it deeply, but the first walkthrough takes longer.

### Other alternatives

| Option | Pros | Cons |
|---|---|---|
| **Fly.io** | Pretty CDN edges; rolling deploys | Free tier shrunk; persistent volumes for Postgres + Redis are awkward to configure correctly |
| **Self-host on a spare Pi** | Zero cost if you already own the hardware | Residential IP / ISP TOS / dynamic IP friction; mixes demo traffic with home network |

For a demo, the sweet spot is "public, low-friction, not connected to your home network." Hetzner wins that on the friction axis; Oracle wins it on cost.

## DNS

You need a public hostname that **does not** point at your home network or any tied to your real identity. A free DDNS name is sufficient: DuckDNS, FreeDNS, or No-IP all work. Pick something neutral (`prism-demo.duckdns.org`).

> Do **not** reuse the same hostname pattern as your real install (e.g. `prism.<your-real-domain>`). Keep the demo on its own DNS so visitors of the demo can never see traffic from your real install and vice versa.

## Walkthrough: Hetzner CPX11 (recommended)

End-to-end, this is ~30 minutes the first time.

### 0. Pick a DDNS hostname before you start

You need a public hostname pointing at your demo VM that **isn't tied to your real identity**. The free option:

- Go to https://www.duckdns.org and sign in with GitHub.
- On the dashboard, type a subdomain (e.g. `prism-demo`) and click **add domain**.
- Save the **token** at the top of the page, you'll need it in step 4.
- The hostname will be `<whatever>.duckdns.org`. Don't fill in the IP yet; you'll do that after the VM is provisioned.

> Don't reuse your real install's hostname pattern (e.g. don't pick `prism.<your-real-domain>`). Keep the demo on its own DNS so visitors of the demo can never see traffic from your real install and vice versa.

### 1. Create a Hetzner account

- Go to https://www.hetzner.com/cloud and click **Sign Up**.
- Fill in name + email + payment method. ID verification is sometimes required for new accounts in the EU; takes 5-10 minutes if so.
- Once logged in, you land on the Cloud Console. Click **+ New Project**, name it `prism-demo`, click **Add Project**, then click into the project.

### 2. Add an SSH key

- On your local machine, if you don't already have one: `ssh-keygen -t ed25519 -C "prism-demo"` (press Enter at every prompt).
- `cat ~/.ssh/id_ed25519.pub` and copy the output.
- In the Hetzner project, **Security → SSH Keys → Add SSH Key**, paste the key, give it a name like `laptop`, click **Add**.

### 3. Provision the VM

- In the project, click **Servers → Add Server**.
- **Location**: pick whatever's closest to where most of your demo viewers live. Ashburn (US East) or Hillsboro (US West) for North America; Falkenstein/Nuremberg/Helsinki for Europe.
- **Image**: Ubuntu 22.04
- **Type**: Shared vCPU → **CPX11** (2 vCPU / 2 GB RAM / 40 GB SSD, ~€3.79/mo)
- **Networking**: leave defaults (public IPv4 + IPv6).
- **SSH Keys**: tick the key you just added.
- **Firewalls**: skip for now (we'll handle ports via UFW on the VM itself).
- **Name**: `prism-demo`
- Click **Create & Buy now**.

After ~30 seconds the server is running. Note the **public IPv4 address**, you'll need it next.

### 4. Point DDNS at the VM

- Back at https://www.duckdns.org, paste your VM's public IPv4 into the **current ip** field next to your subdomain and click **update ip**.
- Verify: `nslookup prism-demo.duckdns.org` (substitute your hostname) should return the Hetzner IP.

### 5. SSH in and bootstrap

```bash
ssh root@<your-vm-ip>
```

(First time only, accept the host fingerprint.)

```bash
# Make a non-root user so we don't run Docker as root
adduser --disabled-password --gecos "" prism
usermod -aG sudo prism
mkdir -p /home/prism/.ssh
cp ~/.ssh/authorized_keys /home/prism/.ssh/
chown -R prism:prism /home/prism/.ssh
chmod 700 /home/prism/.ssh
chmod 600 /home/prism/.ssh/authorized_keys

# Basic firewall: only HTTP/HTTPS/SSH exposed
ufw allow OpenSSH
ufw allow 80
ufw allow 443
ufw --force enable

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker prism

# Install Caddy (provides automatic TLS via Let's Encrypt, zero config)
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
apt update
apt install -y caddy

# Drop to the prism user for the rest
su - prism
```

```bash
# As prism user now:
sudo mkdir -p /opt/prism && sudo chown prism /opt/prism
git clone https://github.com/sandydargoport/prism.git /opt/prism
cd /opt/prism
```

### 6. Configure environment

```bash
cp .env.example .env
nano .env
```

In the editor, set:

- `DB_PASSWORD=<long random string>` (run `openssl rand -hex 24` in another shell to generate)
- `SESSION_SECRET=<long random string>` (run `openssl rand -hex 32`)
- **Leave empty:** any Google Calendar / Gmail / OneDrive / OpenWeather / Pirate Weather keys. The demo must not have access to your real integrations.

Save (`Ctrl+O`, `Enter`, `Ctrl+X` in nano).

### 7. Configure Caddy for TLS

Replace your DDNS hostname in the snippet below.

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
prism-demo.duckdns.org {
    reverse_proxy localhost:3000
}
EOF

sudo systemctl reload caddy
```

Caddy will request a Let's Encrypt cert on first request. This usually completes within 30 seconds.

### 8. Start the demo stack

```bash
cd /opt/prism
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
docker compose ps   # wait until app shows "healthy"
```

First build takes 5-10 minutes. After it's up, visit `https://prism-demo.duckdns.org`. You should see:

- The amber **"Prism Demo · Read-only · Resets daily at midnight UTC"** banner across the top
- The dashboard with the synthetic Alex / Jordan / Emma / Sophie family
- Any attempt to add/edit/delete returns a "this is a read-only demo" message

### 9. Wire the nightly reset

```bash
sudo tee /etc/cron.d/prism-demo-reset > /dev/null <<'EOF'
0 0 * * * prism /opt/prism/scripts/demo-reset.sh >> /var/log/prism-demo-reset.log 2>&1
EOF

sudo touch /var/log/prism-demo-reset.log
sudo chown prism /var/log/prism-demo-reset.log

# Test it manually first
/opt/prism/scripts/demo-reset.sh
```

The reset truncates every table in the public schema, reapplies `03-seed.sql`, and flushes Redis. Visit the demo afterward to confirm it's back to baseline.

### 10. (Optional) Add the demo URL to your README

Open a PR adding the public demo link to the project README so visitors discover it.

## Walkthrough: Oracle Cloud Always Free (alternative)

Oracle gives you more hardware for $0 if you can stomach the friction. The high-level flow:

### 1. Sign up

- https://www.oracle.com/cloud/free
- Fill in the (long) form. Credit card is required even for the free tier, they verify it but don't charge.
- Pick a **home region** carefully. This is permanent and capacity varies wildly. Phoenix and Frankfurt typically have more ARM headroom than Ashburn.

### 2. Provision the VM

- Console → **Compute → Instances → Create Instance**
- **Image**: Canonical Ubuntu 22.04 (ARM-compatible variant)
- **Shape**: change shape, switch to **Ampere**, pick **VM.Standard.A1.Flex**, allocate 4 OCPUs and 24 GB RAM (the full Always Free allowance)
- **Networking**: create a new VCN if you don't have one. Make sure "Assign a public IPv4 address" is checked.
- **SSH keys**: upload your `~/.ssh/id_ed25519.pub`
- Click **Create**

If you get **"Out of capacity for shape VM.Standard.A1.Flex"**, you'll need to retry: either manually every few hours or via a retry script. There are GitHub repos like `hitrov/oci-arm-host-capacity` that automate this.

### 3. Open ports in the VCN

- **Networking → Virtual Cloud Networks → your VCN → Subnets → your subnet → Default Security List → Add Ingress Rules**:
  - Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination Port Range `80`
  - Source CIDR `0.0.0.0/0`, IP Protocol TCP, Destination Port Range `443`
- **Do not** open `5432` or `6379`. Those stay container-internal.
- On the VM itself, also `iptables -I INPUT -p tcp --dport 80 -j ACCEPT` and `--dport 443` (Oracle's Ubuntu image has aggressive default iptables rules).

### 4. Continue from Hetzner step 0

The DDNS, SSH, Docker, Caddy, env, compose, and cron steps are identical to the Hetzner walkthrough. Skip to **step 0** above and continue from there. The user on Oracle's Ubuntu image is `ubuntu` instead of `root`, adjust the `adduser` step accordingly.

## Security model

| Threat | Defense |
|---|---|
| Visitor trashes data for other visitors | `DEMO_MODE=true` middleware blocks mutations; nightly reset bounds drift to ≤24h |
| Visitor harvests PII | Seed is fictional; no real integration credentials in demo `.env` |
| Visitor uses demo to enumerate your real users | Demo is its own host with its own DDNS hostname; no shared DB, no shared session, no link back to your real install |
| Visitor exfiltrates the bearer token (Voice API) | Voice API tokens are not seeded into the demo. `/api/v1/voice/*` returns 401 without a token, which is fine |
| Visitor overloads the host | Compose mem limits cap the app at 2 GB; nightly reset clears any DoS-y state |
| Long-running denial-of-service | Out-of-scope; if it gets bad, take the demo down. It's free advertising, not critical infra |

## Updating the demo

```bash
cd /opt/prism
git pull
docker compose -f docker-compose.yml -f docker-compose.demo.yml build app
docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d --force-recreate app
```

The `--force-recreate` is important. Without it the container can keep running the old image even after a successful build.

## Tearing down

```bash
docker compose -f docker-compose.yml -f docker-compose.demo.yml down -v
```

`-v` deletes the volumes too. The demo's data is disposable, so this is fine.
