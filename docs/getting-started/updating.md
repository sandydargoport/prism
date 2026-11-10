# Updating

Updating Prism to the latest release keeps all of your family's data.

## From the latest stable release

```bash
cd prism
git pull
docker compose up -d --build
```

Your database, settings and uploaded files live in Docker volumes, so a rebuild keeps them. Database migrations (the changes a new version makes to the database) run on their own when the container starts, so you never need to run `drizzle-kit push` by hand.

## Trying a feature branch

Some features are built on a separate branch before they are merged into master. To try one, check out its branch:

```bash
cd prism
git fetch origin
git checkout feature/branch-name
docker compose up -d --build
```

To go back to the stable release, switch back to master:

```bash
git checkout master
docker compose up -d --build
```

Switching branches rebuilds the app and keeps your data. A feature branch may still have rough edges, so use one at your own risk.

## Major version notes

The [changelog](../CHANGELOG.md) has the notes for every major version. Anything you should know before upgrading is at the top of that release's entry.
