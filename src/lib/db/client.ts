/**
 *
 * Creates and exports the database client used throughout the application.
 * This is the single connection point to PostgreSQL.
 *
 * HOW IT WORKS:
 * 1. Reads the DATABASE_URL from environment variables
 * 2. Creates a connection pool (efficient connection reuse)
 * 3. Wraps it with Drizzle ORM for type-safe queries
 *
 * WHY A SINGLE CLIENT:
 * - Database connections are expensive to create
 * - Connection pooling reuses connections efficiently
 * - A single client ensures consistent configuration
 * - Prevents "too many connections" errors
 *
 * HOW TO USE:
 *   import { db } from '@/lib/db/client';
 *   const users = await db.select().from(users);
 *
 * CONNECTION POOLING:
 * The postgres library (postgres.js) automatically manages a pool of
 * connections. It creates connections as needed and reuses them for
 * subsequent queries. This is much more efficient than creating a new
 * connection for each query.
 *
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';


/**
 * LAZY DATABASE CONNECTION
 * We use lazy initialization to avoid errors during Next.js build time.
 * The database connection is only established when first accessed at runtime.
 */
let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Please check your .env file or environment configuration. ' +
      'See .env.example for the expected format.'
    );
  }
  return connectionString;
}

function getClient(): ReturnType<typeof postgres> {
  if (!_client) {
    const connectionString = getConnectionString();
    _client = postgres(connectionString, {
      // Maximum number of connections in the pool
      max: 10,
      // Close idle connections after 30 seconds
      idle_timeout: 30,
      // Timeout waiting for a connection from the pool
      connect_timeout: 10,
      // Prepare statements for better performance
      prepare: true,
      // Transform options for consistent data handling
      transform: {
        undefined: null,
      },
      // Debug logging (only in development)
      debug: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true',
      // Connection event handlers
      onnotice: (notice) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('[PostgreSQL Notice]:', notice.message);
        }
      },
    });
  }
  return _client;
}


/**
 * DRIZZLE ORM CLIENT
 * Wraps the postgres client with Drizzle ORM for type-safe queries.
 *
 * With Drizzle, instead of writing:
 *   await client`SELECT * FROM users WHERE id = ${userId}`;
 *
 * You write:
 *   await db.select().from(users).where(eq(users.id, userId));
 *
 * Benefits:
 * - TypeScript knows the exact shape of results
 * - Autocomplete for table and column names
 * - Compile-time error checking
 * - SQL injection protection (queries are parameterized)
 */
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    if (!_db) {
      _db = drizzle(getClient(), {
        schema,
        logger: process.env.NODE_ENV === 'development',
      });
    }
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  },
});


/**
 * DATABASE HEALTH CHECK
 * Verifies the database connection is working.
 * Call this during startup to fail fast if the database is unreachable.
 *
 * @returns true if connection is healthy, throws error otherwise
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const client = getClient();
    await client`SELECT 1 as connected`;
    return true;
  } catch (error) {
    console.error('Database connection check failed:', error);
    throw new Error(
      'Failed to connect to database. ' +
      'Please verify DATABASE_URL and that PostgreSQL is running.'
    );
  }
}


/**
 * CLOSE DATABASE CONNECTION
 * Gracefully closes all database connections.
 * Call this when shutting down the application.
 */
export async function closeDatabase(): Promise<void> {
  if (_client) {
    await _client.end();
    _client = null;
    _db = null;
  }
}


/**
 * EXPORT TYPES
 * Export types for use in other files.
 */
export type Database = typeof db;
