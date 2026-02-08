/**
 * ============================================================================
 * PRISM - Database Clear Script
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Clears user-created data from the database while preserving the schema.
 * Use this to reset the database to a fresh state.
 *
 * HOW TO RUN:
 * npm run db:clear           # Clear all data including users
 * npm run db:clear -- --keep-users  # Clear data but keep family members
 *
 * WARNING: This is destructive and cannot be undone!
 * Always backup your database first:
 *   docker exec prism-db pg_dump -U prism prism > backup.sql
 *
 * ============================================================================
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const client = postgres(connectionString);
const db = drizzle(client);

// Tables to clear, in order that respects foreign key constraints
// Child tables (with FKs) must be cleared before parent tables
const TABLES_TO_CLEAR = [
  // Goal-related (depends on users, goals)
  'goal_achievements',
  'goals',

  // Photo-related (depends on photo_sources)
  'photos',
  'photo_sources',

  // Chore-related (depends on users, chores)
  'chore_completions',
  'chores',

  // Maintenance-related (depends on maintenance_reminders)
  'maintenance_completions',
  'maintenance_reminders',

  // Shopping-related (depends on shopping_lists)
  'shopping_items',
  'shopping_lists',

  // Other user content
  'meals',
  'family_messages',
  'tasks',
  'birthdays',
  'events',
  'layouts',

  // Calendar-related (depends on users, calendar_groups)
  'calendar_sources',
  'calendar_groups',

  // Settings and credentials
  'settings',
  'api_credentials',
];

// Tables to clear only when --keep-users is NOT specified
const USER_TABLES = ['users'];

async function clearDatabase(keepUsers: boolean) {
  console.log('\n🗑️  PRISM Database Clear\n');
  console.log('=' .repeat(50));

  if (keepUsers) {
    console.log('Mode: Clearing data but KEEPING family members\n');
  } else {
    console.log('Mode: Clearing ALL data including family members\n');
  }

  const tablesToClear = keepUsers
    ? TABLES_TO_CLEAR
    : [...TABLES_TO_CLEAR, ...USER_TABLES];

  let cleared = 0;
  let skipped = 0;

  for (const table of tablesToClear) {
    try {
      // Use TRUNCATE with CASCADE to handle any remaining FK constraints
      await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
      console.log(`  ✓ Cleared: ${table}`);
      cleared++;
    } catch (error) {
      // Table might not exist or be empty
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('does not exist')) {
        console.log(`  - Skipped: ${table} (table does not exist)`);
        skipped++;
      } else {
        console.error(`  ✗ Error clearing ${table}:`, message);
      }
    }
  }

  console.log('\n' + '=' .repeat(50));
  console.log(`\n✅ Database cleared!`);
  console.log(`   Tables cleared: ${cleared}`);
  if (skipped > 0) {
    console.log(`   Tables skipped: ${skipped}`);
  }

  if (keepUsers) {
    console.log('\n💡 Family members were preserved.');
    console.log('   Run "npm run db:seed" to add sample data.\n');
  } else {
    console.log('\n💡 All data cleared including users.');
    console.log('   Run "npm run db:seed" to create sample family and data.\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const keepUsers = args.includes('--keep-users');

// Run the clear
clearDatabase(keepUsers)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed to clear database:', error);
    process.exit(1);
  });
