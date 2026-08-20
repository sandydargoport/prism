# Contributing to Prism

## Getting Started

1. Fork the repository and clone your fork
2. Copy `.env.example` to `.env` and configure your environment
3. Run `docker-compose up -d` to start all services
4. Run `npm install` for local development

## Development Workflow

1. Create a feature branch from `master`
2. Make your changes following the conventions below
3. Run the quality checks (see below)
4. Submit a pull request

**Not sure what to work on?** The public roadmap is the [Prism Roadmap project](https://github.com/users/sandydargoport/projects/3) (vote with an emoji reaction). Internal planning, the untracked backlog, and the engineering-reference docs are all indexed in [`docs/planning.md`](docs/planning.md).

## Quality Standards

All pull requests must meet the following Lighthouse score thresholds:

| Category | Dashboard (`/`) | Subpages |
|---|---|---|
| Performance | Monitored* | 85% |
| Accessibility | 90% | 95% |
| Best Practices | 90% | 95% |
| SEO | 90% | 95% |

*\*Dashboard performance is monitored but not gated. The dashboard loads 8+ real-time data sources on mount and Next.js framework hydration adds ~650ms TBT — this is structural to the architecture. PRs should not regress performance below 65%. Target is 75+.*

**PRs that degrade any category by more than 5 points from the current baseline will not be merged.**

### Running Lighthouse

```bash
# Build and start the app
docker-compose up -d

# Run Lighthouse via Chrome DevTools or CLI
npx lighthouse http://localhost:3000 --output=json --output=html
```

### Other Checks

```bash
# TypeScript type checking
npx tsc --noEmit

# Linting
npx next lint

# Unit tests
npx jest

# E2E tests
npx playwright test
```

## Code Conventions

- **TypeScript**: Strict mode, no `any` unless unavoidable
- **Styling**: Tailwind CSS only — no inline styles or CSS modules
- **Components**: Keep under 250 lines; extract hooks or sub-components if larger
- **API Routes**: Use `withAuth` middleware, add Redis cache invalidation on mutations
- **Accessibility**: All interactive elements need accessible names; maintain WCAG 2.1 AA contrast ratios
- **Touch targets**: Minimum 44px (Apple HIG)

## Commit Messages

Write descriptive commit messages that explain the "why" rather than the "what".

Sign off your commits with `git commit -s`. The `Signed-off-by:` line
certifies the [Developer Certificate of Origin](https://developercertificate.org/)
— that you wrote the change or otherwise have the right to submit it under the
project's license.

## Licensing of Contributions

By submitting a contribution (pull request, patch, or commit) to Prism, you
agree that:

- Your contribution is licensed under the **PolyForm Noncommercial License
  1.0.0**, together with Prism's **Hosting Exception** — the same terms as
  Prism itself — so it stays free for families to self-host, including
  one-click deployment on managed hosting platforms for personal, noncommercial
  use.
- You have the right to license your contribution under those terms.
- Consistent with Prism's [`LICENSE`](LICENSE), **all commercial rights in the
  software, including in your contribution, are reserved to the project
  maintainer.** No third party may sell, sublicense, rebrand, or otherwise
  commercialize Prism or your contribution, and the maintainer retains the
  right to offer Prism under additional or commercial terms in the future.

This keeps Prism free for families forever and permits managed hosting for
personal, noncommercial use, while preserving the maintainer's ability to
sustain the project — without ever removing the free noncommercial edition. For
code and documentation contributions, we also ask you to sign the
[Contributor License Agreement](CLA.md), which records this grant.
