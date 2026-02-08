import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarGroups, calendarSources, users } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { getCached, invalidateCache } from '@/lib/cache/redis';

/**
 * GET /api/calendar-groups
 * Lists all calendar groups. Auto-creates user groups if missing.
 */
export async function GET() {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ groups: [] });
  }

  try {
    const data = await getCached('calendar-groups:all', async () => {
      // Auto-seed: ensure every user has a group, plus one "Family" group
      await seedDefaultGroups();

      // Get groups with user names joined for type='user' groups
      const groups = await db
        .select({
          id: calendarGroups.id,
          storedName: calendarGroups.name,
          color: calendarGroups.color,
          type: calendarGroups.type,
          userId: calendarGroups.userId,
          sortOrder: calendarGroups.sortOrder,
          sourceCount: sql<number>`(SELECT count(*)::int FROM calendar_sources WHERE calendar_sources.group_id = ${calendarGroups.id})`,
          userName: users.name,
          userColor: users.color,
        })
        .from(calendarGroups)
        .leftJoin(users, eq(calendarGroups.userId, users.id))
        .orderBy(asc(calendarGroups.sortOrder), asc(calendarGroups.name));

      // For user-type groups, use the current user name but preserve the stored color
      // (allows users to customize calendar colors independently of their profile color)
      const processedGroups = groups.map(g => ({
        id: g.id,
        name: g.type === 'user' && g.userName ? g.userName : g.storedName,
        color: g.color,
        type: g.type,
        userId: g.userId,
        sortOrder: g.sortOrder,
        sourceCount: g.sourceCount,
      }));

      return { groups: processedGroups };
    }, 600);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching calendar groups:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar groups' }, { status: 500 });
  }
}

/**
 * POST /api/calendar-groups
 * Create a new custom calendar group.
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (body.color && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
    }

    const [group] = await db
      .insert(calendarGroups)
      .values({
        name: body.name.trim(),
        color: body.color || '#3B82F6',
        type: 'custom',
        sortOrder: body.sortOrder ?? 100,
      })
      .returning();

    await invalidateCache('calendar-groups:*');

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error('Error creating calendar group:', error);
    return NextResponse.json({ error: 'Failed to create calendar group' }, { status: 500 });
  }
}

/**
 * Auto-seed default groups for all users + migrate family/user assignments.
 */
async function seedDefaultGroups() {
  const allUsers = await db.select({ id: users.id, name: users.name, color: users.color }).from(users);
  const existingGroups = await db.select().from(calendarGroups);

  // Batch-insert missing user groups
  const existingUserIds = new Set(
    existingGroups.filter((g) => g.type === 'user' && g.userId).map((g) => g.userId!)
  );
  const newGroups: (typeof calendarGroups.$inferInsert)[] = allUsers
    .filter((u) => !existingUserIds.has(u.id))
    .map((u) => ({
      name: u.name,
      color: u.color || '#3B82F6',
      type: 'user',
      userId: u.id,
      sortOrder: 10,
    }));

  const hasFamily = existingGroups.some((g) => g.type === 'custom' && g.name === 'Family');
  if (!hasFamily) {
    newGroups.push({
      name: 'Family',
      color: '#F59E0B',
      type: 'custom',
      sortOrder: 0,
    });
  }

  if (newGroups.length > 0) {
    await db.insert(calendarGroups).values(newGroups);
  }

  // Migrate ungrouped sources using a Map for O(1) lookups
  const ungroupedSources = await db
    .select({ id: calendarSources.id, userId: calendarSources.userId, isFamily: calendarSources.isFamily })
    .from(calendarSources)
    .where(sql`${calendarSources.groupId} IS NULL AND (${calendarSources.userId} IS NOT NULL OR ${calendarSources.isFamily} = true)`);

  if (ungroupedSources.length > 0) {
    const refreshedGroups = await db.select().from(calendarGroups);
    const userGroupMap = new Map(
      refreshedGroups.filter((g) => g.type === 'user' && g.userId).map((g) => [g.userId!, g.id])
    );
    const familyGroupId = refreshedGroups.find((g) => g.type === 'custom' && g.name === 'Family')?.id;

    for (const source of ungroupedSources) {
      const targetGroupId = source.isFamily ? familyGroupId : (source.userId ? userGroupMap.get(source.userId) : undefined);
      if (targetGroupId) {
        await db.update(calendarSources).set({ groupId: targetGroupId }).where(eq(calendarSources.id, source.id));
      }
    }
  }
}
