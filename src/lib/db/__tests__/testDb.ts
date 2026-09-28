/**
 * Test database client — connects to prism_test database.
 *
 * Reads DB_PASSWORD from .env at project root so credentials
 * are never hardcoded. Uses localhost:5433 (the Docker host port).
 */

import fs from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../schema';
import { DB_SESSION_PARAMS } from '../client';

function getDbPassword(): string {
  // If already set in environment, use it
  if (process.env.DB_PASSWORD) {
    return process.env.DB_PASSWORD;
  }

  // Otherwise read from .env at project root.
  // Try __dirname-relative first (4 levels up: __tests__ -> db -> lib -> src -> project root),
  // then fall back to process.cwd() (reliable when Jest is run from the project root).
  const candidatePaths = [
    path.resolve(__dirname, '../../../../.env'),
    path.resolve(process.cwd(), '.env'),
  ];
  const envPath = candidatePaths.find(p => fs.existsSync(p)) ?? candidatePaths[0];
  if (!fs.existsSync(envPath!)) {
    throw new Error(`.env not found (tried: ${candidatePaths.join(', ')}) — set DB_PASSWORD env var`);
  }

  const envContents = fs.readFileSync(envPath!, 'utf-8');
  for (const line of envContents.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eqIndex = trimmed.indexOf('=');
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    if (key === 'DB_PASSWORD') {
      return value;
    }
  }

  throw new Error('DB_PASSWORD not found in .env');
}

let _testClient: ReturnType<typeof postgres> | null = null;
let _testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getTestDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!_testDb) {
    const password = getDbPassword();
    const connectionString = `postgresql://prism:${password}@localhost:5433/prism_test`;

    _testClient = postgres(connectionString, {
      max: 5,
      idle_timeout: 10,
      connect_timeout: 10,
      prepare: false, // avoid prepared statement conflicts between tests
      // The same session zone as the app, so now() defaults on zone-less
      // columns are UTC here too, whatever the test database's default is.
      connection: DB_SESSION_PARAMS,
    });

    _testDb = drizzle(_testClient, { schema });
  }
  return _testDb;
}

export async function closeTestDb(): Promise<void> {
  if (_testClient) {
    await _testClient.end();
    _testClient = null;
    _testDb = null;
  }
}
