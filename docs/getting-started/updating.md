# Updating Prism

## From the latest stable release

```bash
cd prism
git pull
docker compose up -d --build
```

Your database, settings, and uploaded files are stored in Docker volumes and are preserved across rebuilds. Database migrations run automatically on container startup: no manual `drizzle-kit push` needed.

## Trying a feature branch

Some features are developed on branches before merging to master. To try one:

```bash
cd prism
git fetch origin
git checkout feature/branch-name
docker compose up -d --build
```

To go back to the stable release:

```bash
git checkout master
docker compose up -d --build
```

Switching branches rebuilds the app but preserves your data. Feature branches may have rough edges. Use at your own risk.

## Major version notes

Major-version changelogs live in the [changelog](../CHANGELOG.md). Notable upgrade-time behaviors are called out at the top of each release entry.
