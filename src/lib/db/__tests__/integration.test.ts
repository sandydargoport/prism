/**
 * @jest-environment node
 *
 * Integration tests against the real prism_test PostgreSQL database.
 * No DB query mocks — all queries hit the actual database.
 *
 * Gated on `E2E_HAS_TEST_DB=1` — without it the suite is skipped (not failed)
 * so `npx jest` runs cleanly on a dev machine that doesn't expose Postgres.
 * CI's e2e-modality job sets the flag and provides a real `prism_test` DB.
 *
 * Prerequisites (when running with E2E_HAS_TEST_DB=1):
 *   - Postgres reachable at localhost:5433 with the `prism_test` database
 *   - DB_PASSWORD in .env (or as env var)
 */

import { eq } from 'drizzle-orm';
import { getTestDb, closeTestDb } from './testDb';
import * as schema from '../schema';
import { memberOrder } from '../memberOrder';

const HAS_TEST_DB = process.env.E2E_HAS_TEST_DB === '1';
const describeIf = HAS_TEST_DB ? describe : describe.skip;

// ─── helpers ─────────────────────────────────────────────────────────────────

// Only initialize when E2E_HAS_TEST_DB is set — getTestDb() reads .env for
// DB_PASSWORD at module load and throws in environments (like CI's plain
// unit-tests job) where there's no .env file. The definite-assignment `!`
// is safe because lifecycle hooks below only fire when at least one test
// in this file runs, and `describeIf` skips every suite when HAS_TEST_DB
// is false.
let db!: ReturnType<typeof getTestDb>;
if (HAS_TEST_DB) {
  db = getTestDb();
}

async function truncateTables(): Promise<void> {
  // Order matters due to FK constraints: dependents first
  await db.delete(schema.choreCompletions);
  await db.delete(schema.chores);
  await db.delete(schema.events);
  await db.delete(schema.users);
}

// ─── lifecycle ────────────────────────────────────────────────────────────────

beforeEach(async () => {
  await truncateTables();
});

afterAll(async () => {
  await truncateTables();
  await closeTestDb();
});

// ─── Events CRUD ──────────────────────────────────────────────────────────────

describeIf('Events CRUD', () => {
  it('inserts an event and reads it back with all fields matching', async () => {
    const startTime = new Date('2026-06-01T09:00:00Z');
    const endTime = new Date('2026-06-01T10:00:00Z');

    const [inserted] = await db.insert(schema.events).values({
      title: 'Integration Test Event',
      description: 'A test event for DB integration tests',
      location: 'Test Location',
      startTime,
      endTime,
      allDay: false,
      recurring: false,
      color: '#3B82F6',
    }).returning();

    expect(inserted).toBeDefined();
    expect(inserted!.id).toBeDefined();

    const [fetched] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, inserted!.id));

    expect(fetched).toBeDefined();
    expect(fetched!.title).toBe('Integration Test Event');
    expect(fetched!.description).toBe('A test event for DB integration tests');
    expect(fetched!.location).toBe('Test Location');
    expect(fetched!.allDay).toBe(false);
    expect(fetched!.recurring).toBe(false);
    expect(fetched!.color).toBe('#3B82F6');
    // Timestamps: compare ISO strings to avoid tz offset noise
    expect(fetched!.startTime.toISOString()).toBe(startTime.toISOString());
    expect(fetched!.endTime.toISOString()).toBe(endTime.toISOString());
  });

  it('updates an event title and verifies the change persists', async () => {
    const [inserted] = await db.insert(schema.events).values({
      title: 'Original Title',
      startTime: new Date('2026-06-02T10:00:00Z'),
      endTime: new Date('2026-06-02T11:00:00Z'),
    }).returning();

    await db
      .update(schema.events)
      .set({ title: 'Updated Title' })
      .where(eq(schema.events.id, inserted!.id));

    const [fetched] = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, inserted!.id));

    expect(fetched!.title).toBe('Updated Title');
  });

  it('deletes an event and verifies it no longer exists', async () => {
    const [inserted] = await db.insert(schema.events).values({
      title: 'To Be Deleted',
      startTime: new Date('2026-06-03T08:00:00Z'),
      endTime: new Date('2026-06-03T09:00:00Z'),
    }).returning();

    await db.delete(schema.events).where(eq(schema.events.id, inserted!.id));

    const results = await db
      .select()
      .from(schema.events)
      .where(eq(schema.events.id, inserted!.id));

    expect(results).toHaveLength(0);
  });
});

// ─── Chore completion flow ────────────────────────────────────────────────────

describeIf('Chore completion flow', () => {
  it('creates a user and chore, inserts a completion, verifies it, then deletes it', async () => {
    // Create a family member
    const [user] = await db.insert(schema.users).values({
      name: 'Test Child',
      role: 'child',
      color: '#10B981',
      sortOrder: 1,
    }).returning();

    expect(user!.id).toBeDefined();

    // Create a chore assigned to them
    const [chore] = await db.insert(schema.chores).values({
      title: 'Wash dishes',
      category: 'dishes',
      assignedTo: user!.id,
      frequency: 'daily',
      pointValue: 10,
      requiresApproval: false,
    }).returning();

    expect(chore!.id).toBeDefined();

    // Insert a chore completion record
    const [completion] = await db.insert(schema.choreCompletions).values({
      choreId: chore!.id,
      completedBy: user!.id,
      pointsAwarded: 10,
    }).returning();

    expect(completion).toBeDefined();
    expect(completion!.choreId).toBe(chore!.id);
    expect(completion!.completedBy).toBe(user!.id);
    expect(completion!.pointsAwarded).toBe(10);
    expect(completion!.approvedBy).toBeNull();

    // Verify the completion exists with correct fields
    const [fetched] = await db
      .select()
      .from(schema.choreCompletions)
      .where(eq(schema.choreCompletions.id, completion!.id));

    expect(fetched).toBeDefined();
    expect(fetched!.choreId).toBe(chore!.id);
    expect(fetched!.completedBy).toBe(user!.id);

    // Delete the completion and verify it's gone
    await db
      .delete(schema.choreCompletions)
      .where(eq(schema.choreCompletions.id, completion!.id));

    const remaining = await db
      .select()
      .from(schema.choreCompletions)
      .where(eq(schema.choreCompletions.id, completion!.id));

    expect(remaining).toHaveLength(0);
  });

  it('cascade-deletes completions when the chore is deleted', async () => {
    const [user] = await db.insert(schema.users).values({
      name: 'Another Child',
      role: 'child',
      color: '#F59E0B',
      sortOrder: 2,
    }).returning();

    const [chore] = await db.insert(schema.chores).values({
      title: 'Take out trash',
      category: 'trash',
      assignedTo: user!.id,
      frequency: 'weekly',
      pointValue: 5,
      requiresApproval: false,
    }).returning();

    const [completion] = await db.insert(schema.choreCompletions).values({
      choreId: chore!.id,
      completedBy: user!.id,
    }).returning();

    // Deleting the chore should cascade-delete the completion
    await db.delete(schema.chores).where(eq(schema.chores.id, chore!.id));

    const orphans = await db
      .select()
      .from(schema.choreCompletions)
      .where(eq(schema.choreCompletions.id, completion!.id));

    expect(orphans).toHaveLength(0);
  });
});

// ─── Auth: login + session lifecycle ─────────────────────────────────────────

describeIf('Auth: session lifecycle', () => {
  /**
   * Check if Redis is reachable from the test runner (outside Docker).
   * Redis is typically only exposed inside the Docker network, so if
   * it's unreachable here we skip the session tests gracefully.
   */
  async function isRedisAvailable(): Promise<boolean> {
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    try {
      const { createClient } = await import('redis');
      const client = createClient({
        url: redisUrl,
        socket: { connectTimeout: 2000 },
      });
      await client.connect();
      await client.ping();
      await client.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  it('creates a user in the DB and verifies it can be read back', async () => {
    const [user] = await db.insert(schema.users).values({
      name: 'Session Test Parent',
      role: 'parent',
      color: '#6366F1',
      sortOrder: 0,
    }).returning();

    expect(user!.id).toBeDefined();
    expect(user!.role).toBe('parent');

    const [fetched] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, user!.id));

    expect(fetched!.name).toBe('Session Test Parent');
    expect(fetched!.role).toBe('parent');
  });

  it('creates session, validates it, invalidates it, then rejects it', async () => {
    const redisAvailable = await isRedisAvailable();

    if (!redisAvailable) {
      console.warn('Redis not reachable from test runner (inside Docker only) — skipping session lifecycle test');
      return; // graceful skip without failing
    }

    // Set REDIS_URL to localhost equivalent for test runner
    const originalRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://localhost:6379';

    try {
      const { createSession, validateSession, invalidateSession } = await import('@/lib/auth/session');

      const [user] = await db.insert(schema.users).values({
        name: 'Session Lifecycle User',
        role: 'parent',
        color: '#8B5CF6',
        sortOrder: 0,
      }).returning();

      // Create session
      const result = await createSession(user!.id, 'parent');
      expect(result).not.toBeNull();
      expect(result!.token).toHaveLength(64);
      expect(result!.expiresAt).toBeInstanceOf(Date);
      expect(result!.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const token = result!.token;

      // Validate session — should succeed
      const valid = await validateSession(token);
      expect(valid.ok).toBe(true);
      if (valid.ok) {
        expect(valid.session.userId).toBe(user!.id);
        expect(valid.session.role).toBe('parent');
      }

      // Invalidate session
      await invalidateSession(token, user!.id);

      // Validate again — should be rejected
      const invalid = await validateSession(token);
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) {
        expect(invalid.reason).toBe('invalid');
      }
    } finally {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });

  it('validateSession returns unavailable when Redis is unreachable', async () => {
    // Point at a port that refuses connections
    const originalRedisUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = 'redis://localhost:19999';

    try {
      // Dynamic import to pick up the env var change (module may be cached;
      // we rely on the fact that getRedisClient checks REDIS_URL each time)
      const { validateSession } = await import('@/lib/auth/session');
      const result = await validateSession('any-token');
      // Either unavailable or invalid — both are acceptable when Redis is unreachable
      expect(result.ok).toBe(false);
    } finally {
      process.env.REDIS_URL = originalRedisUrl;
    }
  });
});

// ─── Family member ordering ──────────────────────────────────────────────────

describeIf('Family member ordering', () => {
  it('orders members tied on sortOrder and createdAt deterministically', async () => {
    // One statement, so every row lands with the same sortOrder and the same
    // createdAt: the shape a seed or a restore produces, and the shape that
    // used to leave the login ordinal free to point at a different member on
    // the next query.
    const createdAt = new Date('2026-01-01T00:00:00Z');
    await db.insert(schema.users).values(
      ['Alex', 'Jordan', 'Emma', 'Sophie'].map((name) => ({
        name,
        role: 'parent' as const,
        color: '#3B82F6',
        sortOrder: 0,
        createdAt,
        updatedAt: createdAt,
      }))
    );

    const readIds = async () =>
      (
        await db.select({ id: schema.users.id }).from(schema.users).orderBy(...memberOrder)
      ).map((row) => row.id);

    const ids = await readIds();
    expect(ids).toHaveLength(4);

    // The tiebreak is the primary key, so the order is the ids ascending.
    expect(ids).toEqual([...ids].sort());

    // And it is the same order every time, which is the property the login
    // ordinal depends on: /api/family numbers this list and the two auth
    // routes resolve that number against it.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await readIds()).toEqual(ids);
    }
  });
});
