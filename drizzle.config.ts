/**
 * ============================================================================
 * PRISM - Drizzle ORM Configuration
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Configures Drizzle Kit, the CLI tool for managing database migrations.
 *
 * DRIZZLE KIT COMMANDS:
 * - npm run db:generate  - Generate SQL migrations from schema changes
 * - npm run db:migrate   - Run pending migrations
 * - npm run db:push      - Push schema directly (development only)
 * - npm run db:studio    - Open visual database browser
 *
 * WORKFLOW:
 * 1. Edit schema in src/lib/db/schema.ts
 * 2. Run `npm run db:generate` to create migration file
 * 3. Review the generated SQL in drizzle/ folder
 * 4. Run `npm run db:migrate` to apply changes
 *
 * MIGRATION FILES:
 * Generated migrations are stored in the drizzle/ folder.
 * These are SQL files that can be version controlled and reviewed.
 * They ensure consistent database changes across all environments.
 *
 * ============================================================================
 */

import { defineConfig } from 'drizzle-kit';


// Load environment variables
// In development, this reads from .env file
// In production, these are set by the environment
const databaseUrl = process.env.DATABASE_URL;

// Validate DATABASE_URL
if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is not set. ' +
    'Create a .env file with DATABASE_URL=postgresql://user:password@host:5432/database'
  );
}


export default defineConfig({
  // ==========================================================================
  // SCHEMA LOCATION
  // ==========================================================================
  // Path to your schema definition file(s).
  // Drizzle reads this to understand your database structure.
  // ==========================================================================
  schema: './src/lib/db/schema.ts',

  // ==========================================================================
  // OUTPUT DIRECTORY
  // ==========================================================================
  // Where to save generated migration files.
  // These files are SQL scripts that modify the database.
  // ==========================================================================
  out: './drizzle',

  // ==========================================================================
  // DATABASE DRIVER
  // ==========================================================================
  // Which database you're using.
  // Drizzle supports PostgreSQL, MySQL, SQLite, and others.
  // ==========================================================================
  dialect: 'postgresql',

  // ==========================================================================
  // DATABASE CONNECTION
  // ==========================================================================
  // Connection details for the database.
  // Used by Drizzle Kit to connect and run migrations.
  // ==========================================================================
  dbCredentials: {
    url: databaseUrl,
  },

  // ==========================================================================
  // VERBOSE OUTPUT
  // ==========================================================================
  // Enable detailed logging during migration operations.
  // Helpful for debugging migration issues.
  // ==========================================================================
  verbose: true,

  // ==========================================================================
  // STRICT MODE
  // ==========================================================================
  // Fail on warnings (recommended for production safety).
  // In strict mode, Drizzle won't proceed if it detects potential issues.
  // ==========================================================================
  strict: true,
});
