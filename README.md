# Prism

> Your family's digital home

Prism is an open-source family dashboard that brings everyone together. Sync calendars, manage chores, plan meals, track tasks, and stay connected—all on one beautiful touchscreen display.

**Prism** (noun): Your circle of friends, neighbors, and acquaintances. In "prism and kin," it represents both family and community coming together.

## Features

### Smart Calendar Management
- Sync multiple Google Calendar & Apple iCal calendars
- Map multiple calendars to one dashboard view
- Color-coded by family member
- Day, week, two-week, and month views
- Touch-optimized for all ages

### Task & Chore Tracking
- Built-in task lists + Microsoft To Do integration
- Chores system with points/allowance tracking
- Parent approval workflow
- Visual progress tracking

### Smart Shopping Lists
- Organized by grocery store sections
- Voice-to-text quick add
- QR code for mobile access in-store

### Meal Planning
- Weekly meal list
- Assign to specific days
- Recipe links
- Track what's been cooked

### Family Features
- Family messaging board
- Birthday reminders with countdowns
- Babysitter info screen
- Away/privacy mode

### Beautiful Design
- 12 monthly seasonal themes
- Dark/light mode with auto-switching
- Customizable layouts and widgets
- Photo slideshow from iCloud/OneDrive

## Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- 30 minutes for setup

### Installation

```bash
# 1. Clone repository
git clone https://github.com/yourusername/prism.git
cd prism

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your settings
# (See .env.example for instructions)

# 4. Start the application
docker-compose up -d

# 5. Open browser
# Go to: http://localhost:3000
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run linting
npm run lint

# Run type checking
npm run type-check

# Format code
npm run format
```

## Tech Stack

- **Frontend:** React 18, Next.js 14, TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL 15
- **ORM:** Drizzle ORM
- **Deployment:** Docker

## Project Structure

```
prism/
├── src/
│   ├── app/                 # Next.js App Router pages
│   │   ├── api/             # API routes
│   │   ├── layout.tsx       # Root layout
│   │   └── page.tsx         # Home page
│   ├── components/          # React components
│   │   ├── ui/              # Base UI components
│   │   └── widgets/         # Dashboard widgets
│   ├── lib/                 # Utilities and helpers
│   │   ├── db/              # Database client and schema
│   │   └── utils/           # Utility functions
│   ├── hooks/               # Custom React hooks
│   ├── types/               # TypeScript type definitions
│   └── styles/              # Global styles
├── public/                  # Static assets
├── config/                  # Runtime configuration
├── docker-compose.yml       # Docker orchestration
└── Dockerfile               # Container build instructions
```

## Documentation

Every file in this codebase includes extensive documentation with educational comments. The code is designed to teach as you read it.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

---

**Made with love for families who want to stay connected and organized**
