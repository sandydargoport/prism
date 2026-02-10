# Prism

[![Test Install](https://github.com/sandydargoport/prism/actions/workflows/test-install.yml/badge.svg)](https://github.com/sandydargoport/prism/actions/workflows/test-install.yml)

> Your family's digital home

Prism is an open-source family dashboard that brings everyone together. Sync calendars, manage chores, plan meals, track tasks, and stay connected—all on one beautiful touchscreen display.

![Dashboard Preview](docs/images/dashboard-preview.png)

## Features

| Category | Features |
|----------|----------|
| **Calendar** | Google Calendar & iCal sync, day/week/month views, color-coded by member |
| **Chores** | Points system, parent approval workflow, recurring schedules |
| **Tasks** | Built-in lists + Microsoft To Do sync, assignments, due dates |
| **Shopping** | Category-organized lists, check-off mode, Microsoft To Do sync |
| **Meals** | Weekly planning, recipe import from URLs, Paprika integration |
| **Goals** | Waterfall point tracking, recurring rewards, family leaderboard |
| **Photos** | OneDrive sync, screensaver mode, auto-rotate by orientation |
| **Messages** | Family message board, pinned messages, auto-expiring notes |

## Quick Start

### Option 1: One-Line Install (Recommended)

```bash
git clone https://github.com/sandydargoport/prism.git && cd prism && ./scripts/install.sh
```

This will:
- Auto-generate secure database passwords and encryption keys
- Build and start all containers
- Seed a demo family (PIN: `1234` for parent, `0000` for child)

### Option 2: Manual Setup

```bash
git clone https://github.com/sandydargoport/prism.git
cd prism
cp .env.example .env
# Edit .env with your passwords and API keys

docker-compose up -d
```

Then open **http://localhost:3000**

### Adding Integrations

After install, edit `.env` to enable:
- **Google Calendar** — Sync family calendars
- **Microsoft To Do** — Sync tasks and shopping lists
- **OpenWeatherMap** — Weather widget (free tier)

See `.env.example` for step-by-step API key instructions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser / Kiosk                        │
├─────────────────────────────────────────────────────────────┤
│                   Next.js 15 (App Router)                   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │   React UI   │ │  API Routes  │ │   Server Components  │ │
│  │  (Widgets)   │ │   (/api/*)   │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                     Data Layer                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │  PostgreSQL  │ │    Redis     │ │   External APIs      │ │
│  │  (Drizzle)   │ │   (Cache)    │ │ (Google, Microsoft)  │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**
- **PIN-based auth** — Optimized for shared family tablets, not username/password
- **Server-side RBAC** — All permissions enforced on API routes, never trust the client
- **Encrypted OAuth tokens** — AES-256-GCM encryption at rest for all external service tokens
- **Visibility-based polling** — Pauses API calls when tab is hidden to save resources
- **Automated backups** — Daily PostgreSQL dumps with optional off-site sync (OneDrive, S3)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Next.js 15, TypeScript |
| Styling | Tailwind CSS, shadcn/ui |
| Database | PostgreSQL 15, Drizzle ORM |
| Cache | Redis 7 |
| Layout | react-grid-layout v2 |
| Testing | Playwright (E2E) |
| Deployment | Docker Compose |

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# E2E tests
npm run test:e2e

# Database commands
npm run db:push      # Push schema changes
npm run db:seed      # Seed sample data
npm run db:studio    # Open Drizzle Studio
```

## Project Structure

```
prism/
├── src/
│   ├── app/              # Next.js App Router pages & API routes
│   ├── components/       # React components (ui/, widgets/, modals/)
│   ├── lib/              # Core logic
│   │   ├── api/          # API utilities (withAuth wrapper)
│   │   ├── cache/        # Redis caching & rate limiting
│   │   ├── db/           # Database schema & client
│   │   ├── hooks/        # Custom React hooks
│   │   ├── integrations/ # External API clients
│   │   └── utils/        # Helpers (formatters, validators)
│   └── types/            # TypeScript definitions
├── e2e/                  # Playwright E2E tests
├── scripts/              # Utility scripts (backup, restore)
├── docker-compose.yml    # Production orchestration
└── Dockerfile            # Multi-stage build
```

## Security

- **Authentication:** PIN-based with bcrypt hashing, Redis-backed sessions
- **Authorization:** Role-based (parent/child/guest) with 25+ granular permissions
- **Rate Limiting:** Per-user limits on mutations via Redis
- **File Uploads:** Magic byte validation (JPEG/PNG/WebP only)
- **SSRF Protection:** Internal IP blocklist on URL imports
- **Secrets:** OAuth tokens encrypted at rest, .env for local config

## Deployment

The default Docker Compose setup includes:
- `prism-app` — Next.js application
- `prism-db` — PostgreSQL database
- `prism-redis` — Redis cache
- `prism-backup` — Automated daily backups with optional cloud sync

For production, ensure:
1. Strong `DB_PASSWORD` and `ENCRYPTION_KEY` in `.env`
2. Configure off-site backups (see `scripts/README.md`)
3. Set up HTTPS via reverse proxy (nginx, Caddy, Traefik)

## License

AGPL-3.0 — See [LICENSE](LICENSE) for details.

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Run `npm run lint` and `npm run type-check`
4. Submit a pull request

---

**Built for families who want to stay connected and organized.**
