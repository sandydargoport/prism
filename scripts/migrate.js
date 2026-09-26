#!/usr/bin/env node
'use strict';

/**
 * scripts/migrate.js
 *
 * Runs before the Next.js server starts (via docker/entrypoint.sh).
 * Brings the database schema up to date with the current codebase.
 *
 * How it works:
 *  - First run on any database: executes drizzle/0000_upgrade.sql, which is a
 *    fully idempotent catch-up script (all IF NOT EXISTS). Works correctly
 *    whether the database is brand new or was installed months ago.
 *  - Subsequent runs: skips 0000_upgrade (already recorded), applies any new
 *    numbered migration files (0001_xxx.sql, 0002_xxx.sql, etc.) in order.
 *
 * Adding a new schema change:
 *  1. Update src/lib/db/schema.ts
 *  2. Update src/lib/db/init/02-schema.sql (for fresh installs via Docker Postgres init)
 *  3. Create drizzle/NNNN_description.sql with the ALTER TABLE / CREATE TABLE statement
 *  That's it — migrate.js picks it up automatically on next container start.
 */

const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[migrate] ERROR: DATABASE_URL is not set');
  process.exit(1);
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'drizzle');
const UPGRADE_FILE = path.join(MIGRATIONS_DIR, '0000_upgrade.sql');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForDatabase(sql) {
  const maxAttempts = 15;
  const delayMs = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await sql`SELECT 1`;
      return;
    } catch {
      if (attempt === maxAttempts) {
        throw new Error(`Database not reachable after ${maxAttempts} attempts`);
      }
      console.log(`[migrate] Waiting for database... (${attempt}/${maxAttempts})`);
      await sleep(delayMs);
    }
  }
}

async function main() {
  // Run in UTC, as the app's client does (DB_SESSION_PARAMS in
  // src/lib/db/client.ts), so a migration's now() matches the app's.
  const sql = postgres(DATABASE_URL, {
    max: 1,
    connect_timeout: 10,
    onnotice: () => {},
    connection: { TimeZone: 'UTC' },
  });

  try {
    await waitForDatabase(sql);
    console.log('[migrate] Connected');

    await sql`
      CREATE TABLE IF NOT EXISTS public.__prism_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Always decide based on recorded migration state (not just table existence).
    // If a previous run failed midway, __prism_migrations may exist without
    // having 0000_upgrade recorded yet; in that case we must still run it.
    let applied = new Set(
      (await sql`SELECT name FROM public.__prism_migrations`).map(r => r.name)
    );
    if (!applied.has('0000_upgrade')) {
      if (!fs.existsSync(UPGRADE_FILE)) {
        throw new Error('drizzle/0000_upgrade.sql not found');
      }
      console.log('[migrate] Applying 0000_upgrade.sql...');
      const upgradeContent = fs.readFileSync(UPGRADE_FILE, 'utf8');
      await sql.begin(async sql => {
        await sql.unsafe(upgradeContent);
        await sql`
          INSERT INTO public.__prism_migrations (name)
          VALUES ('0000_upgrade')
          ON CONFLICT DO NOTHING
        `;
      });
      console.log('[migrate] 0000_upgrade.sql applied');

      // Refresh applied set after recording 0000_upgrade.
      applied = new Set(
        (await sql`SELECT name FROM public.__prism_migrations`).map(r => r.name)
      );
    }

    const pending = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql') && f !== '0000_upgrade.sql')
      .sort()
      .filter(f => !applied.has(f.replace('.sql', '')));

    if (pending.length === 0) {
      console.log('[migrate] No pending migrations');
    }

    for (const file of pending) {
      const name = file.replace('.sql', '');
      console.log(`[migrate] Applying ${file}...`);
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

      // Run the migration and record it atomically.
      await sql.begin(async sql => {
        await sql.unsafe(content);
        await sql`INSERT INTO public.__prism_migrations (name) VALUES (${name})`;
      });

      console.log(`[migrate] ${file} done`);
    }

    console.log('[migrate] Complete');
  } finally {
    await sql.end();
  }
}

main().catch(err => {
  console.error('[migrate] Fatal error:', err.message);
  process.exit(1);
});
