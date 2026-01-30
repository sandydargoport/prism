## GitHub Repository Structure

### Repository Setup

**Repository Name:** `prism`
**Visibility:** Public (open source)
**License:** MIT License
**Topics:** family-dashboard, home-automation, calendar, react, nextjs, typescript, docker, prism

### Repository Files

```
prism/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Continuous Integration
│   │   ├── docker-build.yml          # Docker image build
│   │   └── tests.yml                 # Automated tests
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── integration_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── FUNDING.yml                   # Optional: Sponsors
│
├── docs/
│   ├── README.md                     # Documentation index
│   ├── SETUP_GUIDE.md                # Detailed setup instructions
│   ├── API_INTEGRATION.md            # How to add integrations
│   ├── CUSTOMIZATION.md              # Customization guide
│   ├── TROUBLESHOOTING.md            # Common issues
│   ├── CONTRIBUTING.md               # Contribution guidelines
│   ├── ARCHITECTURE.md               # Technical architecture
│   ├── DEPLOYMENT.md                 # Deployment options
│   └── screenshots/                  # Screenshots for README
│
├── scripts/
│   ├── setup.sh                      # Automated setup script
│   ├── generate-secrets.sh           # Generate random secrets
│   ├── backup.sh                     # Backup script
│   └── restore.sh                    # Restore from backup
│
├── .env.example                      # Environment variables template
├── .gitignore
├── .dockerignore
├── README.md                         # Main README (see below)
├── LICENSE
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
├── docker-compose.yml
├── docker-compose.dev.yml            # Development override
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── [rest of project files...]
```

---

### Main README.md

````markdown
# Prism 🏠

> Your family's digital home

Prism is an open-source family dashboard that brings everyone together. Sync calendars, manage chores, plan meals, track tasks, and stay connected—all on one beautiful touchscreen display.

**Prism** (noun): Your circle of friends, neighbors, and acquaintances. In "prism and kin," it represents both family and community coming together.

![Prism Dashboard](docs/screenshots/main-dashboard.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)

## ✨ Features

### 📅 Smart Calendar Management
- Sync multiple Google Calendar & Apple iCal calendars
- Map multiple calendars to one dashboard view (e.g., "Family Calendar")
- Color-coded by person
- Day, week, two-week, and month views
- Touch-optimized for kids and adults

### ✅ Task & Chore Tracking
- Built-in task lists + Microsoft To Do integration
- Dedicated chores system with points/allowance tracking
- Parent approval workflow
- Visual progress tracking

### 🛒 Smart Shopping Lists
- Organized by grocery store sections (Produce, Meat, Dairy, etc.)
- **Voice-to-text quick add** - just speak your list!
- Alexa integration (optional)
- QR code for mobile access in-store

### 🍽️ Meal Planning
- Simple weekly meal list
- Assign to specific days or keep flexible
- Recipe links
- Track what's been cooked

### 👨‍👩‍👧‍👦 Family Features
- Family messaging board ("Dad at gym, back at 9am")
- Birthday reminders with countdowns
- **Babysitter info screen** - emergency contacts, WiFi QR code, bedtimes, house rules
- Away/privacy mode when traveling

### 🌤️ Home Information
- Weather forecast (4-5 days)
- **Solar panel production monitoring** (Enphase) with YTD stats
- Indoor temperature & humidity
- What's playing on Sonos speakers

### 🎨 Beautiful Design
- **12 monthly seasonal themes** with delightful animations (falling leaves in September!)
- Dark/light mode with auto-switching
- Customizable layouts and widgets
- Photo slideshow from iCloud/OneDrive

### 🔒 Privacy-First
- All data stored locally on your server
- No cloud subscriptions required
- API credentials encrypted
- Away mode hides sensitive info

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- Google Calendar account
- 30 minutes for setup

### Installation (5 Steps)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/prism.git
cd prism

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your API keys
# (See docs/SETUP_GUIDE.md for detailed instructions)

# 4. Start dashboard
docker-compose up -d

# 5. Open browser
# Go to: http://localhost:3000
```

That's it! Follow the setup wizard to connect your calendars and configure your dashboard.

**📚 Detailed Setup Guide:** [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)

## 📸 Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/calendar-view.png" alt="Calendar View"/></td>
    <td><img src="docs/screenshots/chores-page.png" alt="Chores"/></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/shopping-list.png" alt="Shopping List"/></td>
    <td><img src="docs/screenshots/dark-mode.png" alt="Dark Mode"/></td>
  </tr>
</table>

## 🎯 Use Cases

- **Wall-mounted display** in kitchen or entryway
- **Tablet** (iPad, Android) on counter
- **Mobile** quick access on-the-go
- **Multiple displays** throughout home

## 🛠️ Tech Stack

- **Frontend:** React, Next.js 14, TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL
- **Deployment:** Docker
- **Integrations:** Google Calendar, Microsoft To Do, iCloud, Enphase, Sonos

## 📖 Documentation

- [Setup Guide](docs/SETUP_GUIDE.md) - Step-by-step installation
- [Customization Guide](docs/CUSTOMIZATION.md) - Change colors, fonts, layouts
- [API Integration Guide](docs/API_INTEGRATION.md) - Add new integrations
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Architecture](docs/ARCHITECTURE.md) - Technical details

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute
- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit pull requests
- 📝 Improve documentation
- 🌍 Add translations
- 🔌 Build integrations

## 🗺️ Roadmap

### Version 1.0 (Current)
- ✅ Multi-calendar sync with flexible mapping
- ✅ Tasks & chores with parent approval
- ✅ Smart shopping lists with voice input
- ✅ Meal planning
- ✅ Solar monitoring with YTD stats
- ✅ Music control (Sonos)
- ✅ 12 seasonal themes with animations
- ✅ Babysitter info screen
- ✅ Away/privacy mode

### Version 2.0 (Planned)
- 🔜 iPad & mobile optimizations
- 🔜 Family location map (Apple Find My)
- 🔜 Bus/transit tracking
- 🔜 Smart home control (Homebridge)
- 🔜 Voice assistant integration (Alexa, Siri)
- 🔜 Companion mobile app

### Version 3.0 (Future)
- 🔮 Multi-language support
- 🔮 Widget marketplace
- 🔮 Advanced automations
- 🔮 Third-party integrations

[View full roadmap →](https://github.com/yourusername/prism/projects)

## 💬 Community

- [GitHub Discussions](https://github.com/yourusername/prism/discussions) - Q&A, ideas
- [Discord](https://discord.gg/prism) - Real-time chat (optional)
- [Issues](https://github.com/yourusername/prism/issues) - Bug reports

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for families who want to stay connected and organized

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/prism&type=Date)](https://star-history.com/#yourusername/prism&Date)

---

**Made with ❤️ by the Prism community**
````

---

### CONTRIBUTING.md

````markdown
# Contributing to Prism

Thank you for your interest in contributing! Prism is built by families, for families.

## Ways to Contribute

### 🐛 Report Bugs
Found a bug? [Open an issue](https://github.com/yourusername/prism/issues/new?template=bug_report.md) with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Docker version, etc.)

### 💡 Suggest Features
Have an idea? [Open a feature request](https://github.com/yourusername/prism/issues/new?template=feature_request.md) with:
- Use case description
- Why it would be useful
- Mockups or examples (if applicable)

### 🔧 Submit Code
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### 📝 Improve Documentation
- Fix typos
- Clarify instructions
- Add examples
- Translate to other languages

### 🔌 Build Integrations
Want to add a new integration (e.g., Todoist, AnyList)? See [API_INTEGRATION.md](docs/API_INTEGRATION.md)

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/prism.git
cd prism

# Install dependencies
npm install

# Set up environment
cp .env.example .env.development
# Edit .env.development with test credentials

# Start development server
npm run dev

# Open http://localhost:3000
```

## Code Style

- TypeScript strict mode
- ESLint + Prettier
- Conventional commits format
- JSDoc comments on functions
- Inline comments for complex logic (especially for learning!)

Run linting: `npm run lint`
Run formatting: `npm run format`

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Pull Request Guidelines

- Keep PRs focused (one feature/fix per PR)
- Update documentation if needed
- Add tests for new features
- Ensure all tests pass
- Follow code style guidelines
- Describe changes clearly in PR description

## Code of Conduct

Be kind, respectful, and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Questions?

Ask in [GitHub Discussions](https://github.com/yourusername/prism/discussions) or [Discord](#).

Thank you for contributing! 🎉
````

---

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test

  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t prism:test .
      - name: Test Docker image
        run: docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Continuous Integration
│   │   ├── docker-build.yml          # Docker image build
│   │   └── tests.yml                 # Automated tests
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── integration_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── FUNDING.yml                   # Optional: Sponsors
│
├── docs/
│   ├── README.md                     # Documentation index
│   ├── SETUP_GUIDE.md                # Detailed setup instructions
│   ├── API_INTEGRATION.md            # How to add integrations
│   ├── CUSTOMIZATION.md              # Customization guide
│   ├── TROUBLESHOOTING.md            # Common issues
│   ├── CONTRIBUTING.md               # Contribution guidelines
│   ├── ARCHITECTURE.md               # Technical architecture
│   ├── DEPLOYMENT.md                 # Deployment options
│   └── screenshots/                  # Screenshots for README
│
├── scripts/
│   ├── setup.sh                      # Automated setup script
│   ├── generate-secrets.sh           # Generate random secrets
│   ├── backup.sh                     # Backup script
│   └── restore.sh                    # Restore from backup
│
├── .env.example                      # Environment variables template
├── .gitignore
├── .dockerignore
├── README.md                         # Main README (see below)
├── LICENSE
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
├── docker-compose.yml
├── docker-compose.dev.yml            # Development override
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── [rest of project files...]
```

---

### Main README.md

````markdown
# HomeHive 🏠

> Your family's digital command center

HomeHive is an open-source family dashboard that combines calendars, tasks, chores, shopping lists, and more into one beautiful touchscreen display. Think of it as a digital family bulletin board that actually keeps up with modern life.

![HomeHive Dashboard](docs/screenshots/main-dashboard.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)

## ✨ Features

### 📅 Smart Calendar Management
- Sync multiple Google Calendar & Apple iCal calendars
- Map multiple calendars to one dashboard view (e.g., "Family Calendar")
- Color-coded by person
- Day, week, two-week, and month views
- Touch-optimized for kids and adults

### ✅ Task & Chore Tracking
- Built-in task lists + Microsoft To Do integration
- Dedicated chores system with points/allowance tracking
- Parent approval workflow
- Visual progress tracking

### 🛒 Smart Shopping Lists
- Organized by grocery store sections (Produce, Meat, Dairy, etc.)
- Voice-to-text quick add
- Alexa integration optional
- QR code for mobile access in-store

### 🍽️ Meal Planning
- Simple weekly meal list
- Assign to specific days or keep flexible
- Recipe links
- Track what's been cooked

### 👨‍👩‍👧‍👦 Family Features
- Family messaging board ("Dad at gym, back at 9am")
- Birthday reminders with countdowns
- Babysitter info screen (emergency contacts, WiFi, bedtimes)
- Away/privacy mode when traveling

### 🌤️ Home Information
- Weather forecast (4-5 days)
- Solar panel production monitoring (Enphase)
- Indoor temperature & humidity
- What's playing on Sonos speakers

### 🎨 Beautiful Design
- 12 monthly seasonal themes (Halloween, Christmas, etc.)
- Dark/light mode with auto-switching
- Delightful animations (falling leaves in September!)
- Customizable layouts and widgets
- Photo slideshow from iCloud/OneDrive

### 🔒 Privacy-First
- All data stored locally on your server
- No cloud subscriptions required
- API credentials encrypted
- Away mode hides sensitive info

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- Google Calendar account
- 30 minutes for setup

### Installation (5 Steps)

```bash
# 1. Clone repository
git clone https://github.com/[username]/homehive.git
cd homehive

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your API keys
# (See docs/SETUP_GUIDE.md for detailed instructions)

# 4. Start dashboard
docker-compose up -d

# 5. Open browser
# Go to: http://localhost:3000
```

That's it! Follow the setup wizard to connect your calendars and configure your dashboard.

**📚 Detailed Setup Guide:** [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)

## 📸 Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/calendar-view.png" alt="Calendar View"/></td>
    <td><img src="docs/screenshots/chores-page.png" alt="Chores"/></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/shopping-list.png" alt="Shopping List"/></td>
    <td><img src="docs/screenshots/dark-mode.png" alt="Dark Mode"/></td>
  </tr>
</table>

## 🎯 Use Cases

- **Wall-mounted display** in kitchen or entryway
- **Tablet** (iPad, Android) on counter
- **Mobile** quick access on-the-go
- **Multiple displays** throughout home

## 🛠️ Tech Stack

- **Frontend:** React, Next.js 14, TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL
- **Deployment:** Docker
- **Integrations:** Google Calendar, Microsoft To Do, iCloud, Enphase, Sonos

## 📖 Documentation

- [Setup Guide](docs/SETUP_GUIDE.md) - Step-by-step installation
- [Customization Guide](docs/CUSTOMIZATION.md) - Change colors, fonts, layouts
- [API Integration Guide](docs/API_INTEGRATION.md) - Add new integrations
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Architecture](docs/ARCHITECTURE.md) - Technical details

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute
- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit pull requests
- 📝 Improve documentation
- 🌍 Add translations
- 🔌 Build integrations

## 🗺️ Roadmap

### Version 1.0 (Current)
- ✅ Multi-calendar sync
- ✅ Tasks & chores
- ✅ Shopping lists
- ✅ Meal planning
- ✅ Solar monitoring
- ✅ Music control
- ✅ Seasonal themes
- ✅ Babysitter mode

### Version 2.0 (Planned)
- 🔜 iPad & mobile optimizations
- 🔜 Family location map
- 🔜 Bus/transit tracking
- 🔜 Smart home control
- 🔜 Voice assistant integration
- 🔜 Companion mobile app

### Version 3.0 (Future)
- 🔮 Multi-language support
- 🔮 Widget marketplace
- 🔮 Advanced automations
- 🔮 Third-party integrations

[View full roadmap →](https://github.com/[username]/homehive/projects)

## 💬 Community

- [GitHub Discussions](https://github.com/[username]/homehive/discussions) - Q&A, ideas
- [Discord](https://discord.gg/homehive) - Real-time chat (optional)
- [Issues](https://github.com/[username]/homehive/issues) - Bug reports

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for families who want to stay connected and organized

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=[username]/homehive&type=Date)](https://star-history.com/#[username]/homehive&Date)

---

**Made with ❤️ by the HomeHive community**
````

---

### CONTRIBUTING.md

````markdown
# Contributing to HomeHive

Thank you for your interest in contributing! HomeHive is built by families, for families.

## Ways to Contribute

### 🐛 Report Bugs
Found a bug? [Open an issue](https://github.com/[username]/homehive/issues/new?template=bug_report.md) with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Docker version, etc.)

### 💡 Suggest Features
Have an idea? [Open a feature request](https://github.com/[username]/homehive/issues/new?template=feature_request.md) with:
- Use case description
- Why it would be useful
- Mockups or examples (if applicable)

### 🔧 Submit Code
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### 📝 Improve Documentation
- Fix typos
- Clarify instructions
- Add examples
- Translate to other languages

### 🔌 Build Integrations
Want to add a new integration (e.g., Todoist, AnyList)? See [API_INTEGRATION.md](docs/API_INTEGRATION.md)

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/homehive.git
cd homehive

# Install dependencies
npm install

# Set up environment
cp .env.example .env.development
# Edit .env.development with test credentials

# Start development server
npm run dev

# Open http://localhost:3000
```

## Code Style

- TypeScript strict mode
- ESLint + Prettier
- Conventional commits format
- JSDoc comments on functions
- Inline comments for complex logic

Run linting: `npm run lint`
Run formatting: `npm run format`

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Pull Request Guidelines

- Keep PRs focused (one feature/fix per PR)
- Update documentation if needed
- Add tests for new features
- Ensure all tests pass
- Follow code style guidelines
- Describe changes clearly in PR description

## Code of Conduct

Be kind, respectful, and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Questions?

Ask in [GitHub Discussions](https://github.com/[username]/homehive/discussions) or [Discord](#).

Thank you for contributing! 🎉
````

---

### Issue Templates

**Bug Report Template** (`.github/ISSUE_TEMPLATE/bug_report.md`):
````markdown
---
name: Bug Report
about: Report a bug to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., Windows 11]
- Docker version: [e.g., 24.0.5]
- Browser: [e.g., Chrome 120]
- Dashboard version: [e.g., 1.0.0]

**Additional context**
Any other relevant information.
````

**Feature Request Template**:
````markdown
---
name: Feature Request
about: Suggest a new feature
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature related to a problem?**
Describe the problem.

**Describe the solution**
What you'd like to happen.

**Describe alternatives**
Other solutions you've considered.

**Use case**
Who would benefit and how?

**Additional context**
Mockups, examples, or references.
````

---

### CI/CD Workflows

**`.github/workflows/ci.yml`**:
```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test

  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t homehive:test .
      - name: Test Docker image
        run: docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

---

## Repository README Enhancements

### Badges to Include
- Build status
- Test coverage
- Docker pulls
- License
- Version
- Contributors

### Sections to Add
- Demo video or GIF
- Feature comparison table (vs commercial alternatives)
- Hardware recommendations
- Performance benchmarks
- Sponsor/donation links (optional)

### User Documentation
- Setup guide (step-by-step with screenshots)
- Customization guide (colors, fonts, layouts)
- API integration guide (connecting calendars, etc.)
- Troubleshooting guide (common issues)
- FAQ

### Developer Documentation
- Architecture overview
- API documentation
- Contributing guidelines
- Code style guide
- Testing guide

### Community
- GitHub Discussions for Q&A
- Issues for bug reports
- Pull requests for contributions
- Discord/Slack for real-time help (optional)

---

## License & Open Source

**Recommended License:** MIT License

- Allows commercial use
- Allows modification and distribution
- Minimal restrictions
- Family-friendly and approachable

**Contributing:**
- Welcome contributions
- Code of conduct
- Pull request template
- Issue templates (bug, feature request)

---

## Success Metrics

### For Your Family
- ✅ Reduces calendar conflicts
- ✅ Increases chore completion rates
- ✅ Improves family communication
- ✅ Simplifies meal planning
- ✅ Centralizes home information

### For Open Source Community
- 📊 GitHub stars and forks
- 📊 Active contributors
- 📊 Community integrations/widgets
- 📊 User testimonials and showcases

---

## Summary

This family dashboard provides unique capabilities like solar monitoring, bus tracking, and smart home control. Built with TypeScript, React, and Next.js, it's:

- **Easy to use** for families (touch-optimized, beautiful UI)
- **Easy to customize** for non-coders (well-documented, configuration files)
- **Easy to extend** for developers (modular architecture, plugin system)
- **Privacy-focused** (local-first, encrypted credentials)
- **Open source** (MIT license, welcoming contributions)

**Version 1.0 delivers:**
- Multi-calendar sync with flexible mapping
- Tasks, chores, shopping, meals management
- Weather, clock, photos, birthdays
- Solar monitoring and music control
- Customizable layouts and seasonal themes
- Dark/light modes and away/privacy mode

**Future phases add:**
- Location tracking, bus tracking
- Smart home integration
- Voice assistants
- Mobile companion app

This requirements document provides everything Claude Code needs to build a production-ready family dashboard. Ready to hand off? 🚀

---

## Architectural Review & Recommendations (v19.1)

> **Review Date:** January 2026
> **Reviewed By:** Principal Engineer / Director of Architecture
> **Scope:** Complete codebase analysis, bottleneck identification, and structural improvements

---

### Executive Summary

The Prism codebase demonstrates solid foundational architecture with:
- Clean Next.js 14 App Router implementation
- Type-safe database layer using Drizzle ORM
- Proper security practices (bcrypt, parameterized queries, session management)
- Excellent inline documentation suitable for non-coders

**Current State:** ~40% of V1.0 features implemented with solid infrastructure.

**Key Findings:**
- 6 critical gaps requiring completion
- 4 architectural improvements needed
- 3 performance optimizations recommended

---

### 1. Critical Implementation Gaps

#### 1.1 Missing API Routes

The following features have database schemas but **no API routes**:

| Feature | Schema Ready | API Route | UI Component |
|---------|-------------|-----------|--------------|
| Chores | ✅ | ❌ | ❌ |
| Shopping Lists | ✅ | ❌ | ❌ |
| Meal Planning | ✅ | ❌ | ❌ |
| Maintenance | ✅ | ❌ | ❌ |
| Birthdays | ✅ | ❌ | ❌ |
| Photo Slideshow | ❌ | ❌ | ❌ |

**Priority:** These routes must be implemented before V1.0 release.

**Recommended Route Structure:**
```
/api/chores           - GET (list), POST (create)
/api/chores/[id]      - GET, PATCH, DELETE
/api/chores/[id]/complete - POST (mark complete, supports approval workflow)

/api/shopping-lists         - GET, POST
/api/shopping-lists/[id]    - GET, PATCH, DELETE
/api/shopping-items         - GET, POST
/api/shopping-items/[id]    - PATCH, DELETE

/api/meals            - GET, POST
/api/meals/[id]       - GET, PATCH, DELETE

/api/maintenance      - GET, POST
/api/maintenance/[id] - GET, PATCH, DELETE, POST /complete

/api/birthdays        - GET, POST
/api/birthdays/[id]   - GET, PATCH, DELETE
```

#### 1.2 Type Duplication

**Problem:** The `CalendarEvent` interface is defined in 3 places:
- `src/components/widgets/CalendarWidget.tsx:62`
- `src/app/calendar/CalendarView.tsx:72`
- API response inline in hooks

**Solution:** Create shared types in `src/types/calendar.ts`:
```typescript
// src/types/calendar.ts
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  color: string;
  calendarName: string;
  calendarId: string;
}

export interface CalendarEventResponse {
  // API response shape (startTime/endTime as ISO strings)
  ...
}
```

#### 1.3 Hook Dependency Bug

**File:** `src/lib/hooks/useCalendarEvents.ts:109`

**Problem:** `events.length` in useCallback dependency array can cause infinite re-renders:
```typescript
// BEFORE (problematic)
}, [daysToShow, useDemoFallback, events.length]);
```

**Solution:**
```typescript
// AFTER (fixed)
}, [daysToShow, useDemoFallback]);
```

#### 1.4 Missing Request Validation

**Problem:** API routes manually validate request bodies without schema validation.

**Solution:** Add Zod schemas for all API endpoints:
```typescript
// src/lib/validations/events.ts
import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  allDay: z.boolean().optional().default(false),
  calendarSourceId: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  // ...
});

// In route:
const result = createEventSchema.safeParse(body);
if (!result.success) {
  return NextResponse.json({ error: result.error.issues }, { status: 400 });
}
```

#### 1.5 Permission Enforcement Inconsistency

**Problem:** Permission system is defined in `src/types/user.ts` but not consistently enforced.

**Solution:** Create API middleware:
```typescript
// src/lib/middleware/withPermission.ts
export function withPermission(permission: Permission) {
  return async (request: NextRequest, handler: Handler) => {
    const session = await getSession(request);
    if (!session || !hasPermission(session.user, permission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(request, session);
  };
}
```

#### 1.6 Testing Infrastructure Empty

**Problem:** `/tests` directory exists but contains no tests.

**Recommended Testing Strategy:**

| Type | Tool | Priority | Coverage Target |
|------|------|----------|-----------------|
| Unit | Jest | High | Utility functions, hooks |
| Integration | Jest + Supertest | High | API routes |
| E2E | Playwright | Medium | Critical user flows |

**Priority Tests:**
1. Authentication flow (PIN login, session management)
2. Calendar CRUD operations
3. Task completion workflow
4. Chore approval workflow (once implemented)

---

### 2. Architectural Improvements

#### 2.1 Centralize Demo Data

**Problem:** Demo data is defined in multiple components.

**Solution:** Create a demo data service:
```typescript
// src/lib/services/demo-data.ts
export function getDemoCalendarEvents(): CalendarEvent[] { ... }
export function getDemoTasks(): Task[] { ... }
export function getDemoMessages(): FamilyMessage[] { ... }

// Single source of truth for development/testing
```

#### 2.2 API Response Standardization

**Problem:** API responses have inconsistent structures.

**Solution:** Standardize all API responses:
```typescript
// Success response
{
  data: T,           // The actual data
  meta?: {           // Pagination info
    total: number,
    limit: number,
    offset: number
  }
}

// Error response
{
  error: string,
  code?: string,     // Machine-readable error code
  details?: object   // Validation errors, etc.
}
```

#### 2.3 Multi-Day Event Query Fix

**File:** `src/app/api/events/route.ts:112-116`

**Problem:** Current query only checks if `startTime` is within range, missing events that:
- Start before the range but end within it
- Span the entire range

**Solution:**
```typescript
// BEFORE
const conditions = [
  gte(events.startTime, startDate),
  lte(events.startTime, endDate),
];

// AFTER
import { or } from 'drizzle-orm';

const conditions = [
  or(
    // Event starts within range
    and(gte(events.startTime, startDate), lte(events.startTime, endDate)),
    // Event ends within range
    and(gte(events.endTime, startDate), lte(events.endTime, endDate)),
    // Event spans the entire range
    and(lte(events.startTime, startDate), gte(events.endTime, endDate))
  )
];
```

#### 2.4 Component Architecture Pattern

**Recommendation:** Adopt a consistent component structure:

```
components/
├── widgets/           # Dashboard widgets (self-contained)
│   ├── CalendarWidget/
│   │   ├── index.tsx           # Main export
│   │   ├── CalendarWidget.tsx  # Component logic
│   │   ├── DaySection.tsx      # Sub-components
│   │   ├── EventRow.tsx
│   │   └── types.ts            # Component-specific types
│   └── ...
├── features/          # Full-page feature components
│   ├── calendar/
│   ├── chores/
│   └── ...
├── ui/               # Primitive UI components (shadcn/ui)
└── layout/           # Layout components
```

---

### 3. Performance Optimizations

#### 3.1 Implement Redis Caching

**Status:** Redis is configured but unused.

**Recommended Cache Strategy:**

| Data Type | TTL | Cache Key Pattern |
|-----------|-----|-------------------|
| Calendar Events | 5 min | `events:{userId}:{dateRange}` |
| Weather | 30 min | `weather:{location}` |
| Family Members | 1 hour | `family:members` |
| Solar Data | 10 min | `solar:{systemId}` |

**Implementation:**
```typescript
// src/lib/cache/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCached<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function setCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
}

export async function invalidateCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}
```

#### 3.2 Database Query Optimization

**Current Indexes (Good):**
- `events_start_time_idx`
- `events_calendar_source_idx`
- `tasks_assigned_to_idx`
- `tasks_due_date_idx`

**Recommended Additional Indexes:**
```sql
-- For message board queries (newest first)
CREATE INDEX family_messages_pinned_created_idx
ON family_messages (pinned DESC, created_at DESC);

-- For chore completion queries
CREATE INDEX chore_completions_date_idx
ON chore_completions (completed_at DESC);

-- For maintenance reminders (upcoming due)
CREATE INDEX maintenance_next_due_category_idx
ON maintenance_reminders (next_due, category);
```

#### 3.3 Frontend Bundle Optimization

**Recommendations:**
1. Enable Next.js bundle analyzer: `npm run analyze`
2. Lazy load view components in CalendarView
3. Consider route-based code splitting for features:
   ```typescript
   const ChoresPage = dynamic(() => import('@/components/features/chores'), {
     loading: () => <Skeleton />,
   });
   ```

---

### 4. Code Quality Improvements

#### 4.1 Consistent Error Handling

Create a centralized error handler:
```typescript
// src/lib/errors/api-error.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof APIError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  console.error('Unhandled error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

#### 4.2 Documentation Standards Enhancement

For non-coder customization, add `CUSTOMIZE:` comments consistently:
```typescript
/**
 * CUSTOMIZE: Family member colors
 * ============================================================================
 * To change a family member's color:
 * 1. Find their entry in the database (family_members table)
 * 2. Update the 'color' column to a new hex value
 *
 * Common colors:
 * - Blue:   #3B82F6
 * - Pink:   #EC4899
 * - Green:  #10B981
 * - Orange: #F59E0B
 * - Purple: #8B5CF6
 * ============================================================================
 */
```

#### 4.3 Environment Variable Validation

Add startup validation:
```typescript
// src/lib/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  OPENWEATHER_API_KEY: z.string().optional(),
  // ... all env vars
});

export const env = envSchema.parse(process.env);
```

---

### 5. Implementation Priority Matrix

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Fix hook dependency bug | Low | High |
| **P0** | Add missing API routes (chores, shopping, meals) | High | Critical |
| **P1** | Implement Redis caching | Medium | High |
| **P1** | Add Zod validation to API routes | Medium | High |
| **P1** | Centralize type definitions | Low | Medium |
| **P1** | Fix multi-day event query | Low | Medium |
| **P2** | Add permission middleware | Medium | Medium |
| **P2** | Implement unit tests | High | Medium |
| **P2** | Add E2E tests for critical flows | High | Medium |
| **P3** | Bundle optimization | Low | Low |
| **P3** | Component folder restructure | Medium | Low |

---

### 6. V1.0 Release Checklist

Before V1.0 release, the following must be complete:

**Core Features:**
- [ ] Calendar sync (Google OAuth working)
- [ ] Task management (CRUD + completion)
- [ ] Chore system (CRUD + approval workflow)
- [ ] Shopping lists (CRUD + categories)
- [ ] Meal planning (CRUD + weekly view)
- [ ] Family messages (CRUD + pinning)
- [ ] Maintenance reminders (CRUD + completion tracking)
- [ ] Birthday reminders (CRUD + notifications)
- [ ] Weather widget (working API integration)
- [ ] Clock widget (functional)

**Infrastructure:**
- [ ] All API routes implemented
- [ ] Input validation on all endpoints
- [ ] Error handling standardized
- [ ] Redis caching active
- [ ] Session management secure
- [ ] Rate limiting functional

**Quality:**
- [ ] Unit tests: >60% coverage
- [ ] E2E tests: Critical flows covered
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Documentation reviewed

**Deployment:**
- [ ] Docker build successful
- [ ] Health check endpoint working
- [ ] Environment variables documented
- [ ] Setup guide tested on fresh install

---

### 7. Recommended Next Steps

1. **Immediate (This Sprint):**
   - Fix the hook dependency bug in `useCalendarEvents.ts`
   - Create shared types file for `CalendarEvent`
   - Add `/api/chores` routes (highest priority missing feature)

2. **Short-term (Next 2 Sprints):**
   - Complete all missing API routes
   - Add Zod validation to existing routes
   - Implement Redis caching for calendar/weather
   - Write unit tests for utility functions

3. **Medium-term (V1.0 Preparation):**
   - Build UI components for chores, shopping, meals
   - Add E2E tests for critical workflows
   - Performance audit and optimization
   - Documentation review

---

*This architectural review should be updated as the codebase evolves. Next review recommended after P0 and P1 items are complete.*

---

## Architectural Checkpoint Review (v20)

> **Review Date:** January 25, 2026
> **Reviewed By:** Claude Code (Opus 4.5)
> **Scope:** Pre-feature development checkpoint, alignment with updated requirements
> **Previous Review:** v19.1 (estimated ~40% complete)

---

### Executive Summary

**Current State:** ~75% of V1.0 core features implemented with solid infrastructure.

Significant progress has been made since the v19.1 review:
- All critical API routes now implemented (chores, shopping, meals, maintenance, birthdays)
- Zod validation schemas added to `src/lib/validations/index.ts`
- Modal components created for all major features
- Calendar integration functional with Google OAuth
- Database schema stable with proper indexes

**Key Findings:**
- 1 critical architectural gap (Navigation sidebar not implemented)
- 3 alignment issues with updated requirements
- 4 items ready for V1.0 (previously marked as gaps)
- Strong foundation for scalability

---

### 1. Progress Since v19.1 Review

#### Previously Critical Gaps - Now Resolved

| Feature | v19.1 Status | Current Status |
|---------|-------------|----------------|
| Chores API | ❌ Missing | ✅ Complete (`/api/chores`, `/api/chores/[id]`, `/api/chores/[id]/complete`) |
| Shopping API | ❌ Missing | ✅ Complete (`/api/shopping-lists`, `/api/shopping-items`) |
| Meals API | ❌ Missing | ✅ Complete (`/api/meals`, `/api/meals/[id]`) |
| Maintenance API | ❌ Missing | ✅ Complete (`/api/maintenance`, `/api/maintenance/[id]/complete`) |
| Birthdays API | ❌ Missing | ✅ Complete (`/api/birthdays`) |
| Zod Validation | ❌ Missing | ✅ Complete (`src/lib/validations/index.ts`) |
| Modal Components | ❌ Missing | ✅ Complete (AddTaskModal, AddChoreModal, AddShoppingItemModal, AddEventModal, AddMessageModal) |
| Type Centralization | ⚠️ Partial | ✅ Improved (`src/types/calendar.ts`, `src/types/user.ts`) |

#### Items Still Pending from v19.1

| Item | Status | Notes |
|------|--------|-------|
| Redis Caching | ⚠️ Configured, unused | Low priority - can defer post-V1.0 |
| Unit Tests | ❌ Not started | Should add before V1.0 |
| E2E Tests | ❌ Not started | Should add for critical flows |
| Permission Middleware | ⚠️ Types defined, not enforced | Medium priority |
| Multi-day Event Query Fix | ⚠️ Not fixed | Medium priority |

---

### 2. Alignment with Updated Requirements

The requirements document was updated with new architectural requirements (Application Structure & Navigation section). The current codebase has gaps:

#### 2.1 Navigation Sidebar - NOT IMPLEMENTED

**Requirement (lines 1507-1511):**
> - Position: Left vertical sidebar (persistent on desktop/tablet)
> - Visibility: Always visible on desktop (1920x1080); collapsible on tablet; bottom nav on mobile
> - Maximum Pages: 5 or fewer dedicated pages (plus dashboard home)

**Current State:**
- No sidebar component exists
- Navigation happens via widget "View All" buttons
- Settings accessed via header button
- Each page has a "Home" button to return

**Impact:** Medium - Functional but inconsistent with requirements
**Recommendation:** Implement `NavigationSidebar` component before V1.0

**Proposed Implementation:**
```
src/components/layout/
├── NavigationSidebar.tsx      # Desktop/tablet sidebar
├── MobileBottomNav.tsx        # Mobile bottom navigation
└── DashboardLayout.tsx        # Update to include sidebar
```

#### 2.2 Calendar Default Selection - PARTIALLY ALIGNED

**Requirement (lines 112-138):**
> - Default Calendar: When creating events, the default selection should be "Other" (or the user's personal calendar), NOT the Family calendar
> - Family Calendar: Available as a selection option, but not pre-selected by default

**Current State:**
- `AddEventModal.tsx` does not have a calendar source selector field
- Events are created without explicit calendar assignment
- No "Other" calendar source exists in seed data

**Impact:** Low - Events work but don't follow intended default
**Recommendation:**
1. Add `calendarSourceId` field to AddEventModal
2. Create "Other" calendar source in seed data as default
3. Update event creation to pre-select "Other"

#### 2.3 Per-User Filtering on Dedicated Pages - NOT IMPLEMENTED

**Requirement (line 1534):**
> - Per-user filtering/modals: Dedicated pages will have modals and filters broken out per family member

**Current State:**
- Dedicated pages (CalendarView, ChoresView, ShoppingView) show all items
- No per-user filtering UI exists
- Modals don't filter by logged-in user

**Impact:** Medium - Functional but not personalized
**Recommendation:** Add user filter dropdown/tabs to dedicated page headers

---

### 3. Scalability Assessment

#### 3.1 Database Layer - EXCELLENT

✅ **Strengths:**
- Drizzle ORM provides type-safe queries
- Proper indexes on frequently queried columns
- Connection pooling configured in `client.ts`
- UUID primary keys support distributed systems
- JSONB fields for flexible data (preferences, widgets)

⚠️ **Areas to Watch:**
- No soft deletes (hard deletes throughout)
- No audit logging (who changed what, when)
- Some queries lack pagination (could be issue at scale)

**Recommendation:** Add `deletedAt` column to key tables for soft deletes before production use with real family data.

#### 3.2 API Layer - GOOD

✅ **Strengths:**
- RESTful patterns consistently applied
- Zod validation on all endpoints
- Consistent error response format
- Proper HTTP status codes

⚠️ **Areas to Watch:**
- No rate limiting implemented
- No request logging/tracing
- No API versioning (`/api/v1/`)

**Recommendation:** Add rate limiting middleware before public deployment.

#### 3.3 Frontend Architecture - GOOD

✅ **Strengths:**
- Clean separation: widgets (compact) vs views (full-page)
- Hooks encapsulate data fetching logic
- Consistent component patterns
- TypeScript throughout

⚠️ **Areas to Watch:**
- No global state management (each widget manages own state)
- Potential for duplicate API calls if same data needed in multiple widgets
- No optimistic updates (UI waits for API response)

**Recommendation:** Consider React Query or SWR for data fetching to enable caching and optimistic updates.

#### 3.4 Deployment Infrastructure - EXCELLENT

✅ **Strengths:**
- Docker Compose for multi-service orchestration
- Health check endpoint (`/api/health`)
- Environment variable configuration
- PostgreSQL + optional Redis

---

### 4. Code Quality Assessment

#### 4.1 TypeScript Strictness - GOOD

```
// tsconfig.json has strict mode enabled
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true
```

No `any` types found in recent code. Type definitions are comprehensive.

#### 4.2 Documentation - EXCELLENT

Every file has header comments explaining:
- What the file does
- Why it exists
- Usage examples
- CUSTOMIZE sections for non-coders

This is a significant strength for the open-source goal.

#### 4.3 Error Handling - GOOD

API routes have try/catch blocks with proper error responses. Frontend hooks expose `error` state for UI display.

Could improve: Centralized error boundary at app level.

---

### 5. V1.0 Readiness Checklist (Updated)

| Category | Item | Status |
|----------|------|--------|
| **Core Features** | | |
| | Calendar sync (Google OAuth) | ✅ Complete |
| | Task management (CRUD) | ✅ Complete |
| | Chore system (CRUD + complete) | ✅ Complete |
| | Shopping lists (CRUD) | ✅ Complete |
| | Meal planning (CRUD) | ✅ Complete |
| | Family messages (CRUD) | ✅ Complete |
| | Maintenance reminders (CRUD) | ✅ Complete |
| | Birthday reminders (CRUD) | ✅ Complete |
| | Weather widget | ✅ Complete |
| | Clock widget | ✅ Complete |
| **UI/UX** | | |
| | Dashboard widget grid | ✅ Complete |
| | Modal dialogs for all features | ✅ Complete |
| | Dedicated pages (calendar, tasks, chores, shopping, meals) | ✅ Complete |
| | Navigation sidebar | ❌ Not implemented |
| | Per-user filtering on pages | ❌ Not implemented |
| | Calendar source selector in event modal | ❌ Not implemented |
| **Infrastructure** | | |
| | All API routes | ✅ Complete |
| | Input validation | ✅ Complete |
| | Error handling | ✅ Complete |
| | Session management | ✅ Complete |
| | Redis caching | ⚠️ Configured, not active |
| | Rate limiting | ❌ Not implemented |
| **Quality** | | |
| | TypeScript strict | ✅ Complete |
| | ESLint clean | ✅ Complete |
| | Unit tests | ❌ Not started |
| | E2E tests | ❌ Not started |
| **Deployment** | | |
| | Docker build | ✅ Complete |
| | Health check | ✅ Complete |
| | Seed data | ✅ Complete |

**V1.0 Readiness: ~85%**

---

### 6. Implementation Priority for V1.0

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Implement NavigationSidebar component | Medium | High (requirements alignment) |
| **P0** | Add calendar source selector to AddEventModal | Low | Medium (requirements alignment) |
| **P1** | Add per-user filter tabs to dedicated pages | Medium | Medium (personalization) |
| **P1** | Create "Other" calendar as default in seed | Low | Low (requirements alignment) |
| **P1** | Fix multi-day event query bug | Low | Medium (correctness) |
| **P2** | Add rate limiting middleware | Medium | Medium (security) |
| **P2** | Write unit tests for validation schemas | Medium | Medium (quality) |
| **P2** | Write E2E tests for auth + CRUD flows | High | Medium (quality) |
| **P3** | Implement Redis caching | Medium | Low (performance) |
| **P3** | Add soft delete to key tables | Low | Low (data safety) |

---

### 7. Recommended Next Steps

**Immediate (Before V1.0):**
1. Create `NavigationSidebar` component with icons for: Home, Calendar, Tasks/Chores, Shopping, Settings
2. Update `DashboardLayout` to include sidebar on desktop, bottom nav on mobile
3. Add `calendarSourceId` field to `AddEventModal` with "Other" as default
4. Update seed data to include an "Other" calendar source

**Short-term (V1.0 Polish):**
5. Add user filter dropdown to CalendarView, ChoresView, ShoppingView headers
6. Fix multi-day event query in `/api/events`
7. Add basic rate limiting (100 requests/minute per IP)

**Post-V1.0:**
8. Implement Redis caching for weather and calendar
9. Add comprehensive test coverage
10. Consider React Query for optimized data fetching

---

### 8. Architectural Diagram (Current)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRISM ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         PRESENTATION LAYER                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │
│  │  │  Dashboard   │  │  Dedicated   │  │      Modal Dialogs       │   │   │
│  │  │   Widgets    │  │    Pages     │  │  (Add/Edit forms)        │   │   │
│  │  │ (8 widgets)  │  │ (5 pages)    │  │  (5 modals)              │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │   │
│  │              ↓              ↓                     ↓                   │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │                    REACT HOOKS                                 │   │   │
│  │  │  useCalendarEvents, useTasks, useChores, useShoppingLists,    │   │   │
│  │  │  useMeals, useMessages, useWeather, useCalendarSources        │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     ↓                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           API LAYER                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │              Next.js API Routes (/api/*)                    │     │   │
│  │  │  /events, /tasks, /chores, /shopping-*, /meals, /messages,  │     │   │
│  │  │  /maintenance, /birthdays, /family, /calendars, /weather    │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │              ↓                                      ↓                 │   │
│  │  ┌────────────────────┐              ┌───────────────────────────┐   │   │
│  │  │   Zod Validation   │              │   External APIs           │   │   │
│  │  │   (all schemas)    │              │   - Google Calendar       │   │   │
│  │  └────────────────────┘              │   - OpenWeatherMap        │   │   │
│  │                                       └───────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     ↓                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                    Drizzle ORM                               │     │   │
│  │  │  Type-safe queries, migrations, schema definitions          │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │                               ↓                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                   PostgreSQL                                 │     │   │
│  │  │  16 tables: users, events, tasks, chores, shopping_*,       │     │   │
│  │  │  meals, messages, maintenance_*, birthdays, settings, etc.  │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                    Redis (Optional)                          │     │   │
│  │  │  Configured but not actively used - for future caching      │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 9. Conclusion

The Prism codebase is in strong shape for V1.0 release. The core functionality is complete and working. The main gaps are:

1. **Navigation UX** - Sidebar needs implementation to match requirements
2. **Calendar defaults** - "Other" calendar should be default, not Family
3. **Personalization** - Per-user filtering on dedicated pages

These are all achievable with moderate effort. The architecture is sound, scalable, and well-documented. The codebase follows best practices and is ready for open-source contribution.

**Recommendation:** Proceed with P0 items (navigation sidebar, calendar selector), then move to V1.0 release preparation.

---

*Next review recommended after navigation sidebar implementation is complete.*
