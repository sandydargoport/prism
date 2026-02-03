import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarGroups, calendarSources, users } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';

/**
 * GET /api/calendar-groups
 * Lists all calendar groups. Auto-creates user groups if missing.
 */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    // Auto-seed: ensure every user has a group, plus one "Family" group
    await seedDefaultGroups();

    const groups = await db
      .select({
        id: calendarGroups.id,
        name: calendarGroups.name,
        color: calendarGroups.color,
        type: calendarGroups.type,
        userId: calendarGroups.userId,
        sortOrder: calendarGroups.sortOrder,
        sourceCount: sql<number>`(SELECT count(*)::int FROM calendar_sources WHERE calendar_sources.group_id = ${calendarGroups.id})`,
      })
      .from(calendarGroups)
      .orderBy(asc(calendarGroups.sortOrder), asc(calendarGroups.name));

    return NextResponse.json({ groups });
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
  // Get all users
  const allUsers = await db.select({ id: users.id, name: users.name, color: users.color }).from(users);

  // Get existing groups
  const existingGroups = await db.select().from(calendarGroups);

  // Create user groups if missing
  for (const user of allUsers) {
    const hasGroup = existingGroups.some((g) => g.type === 'user' && g.userId === user.id);
    if (!hasGroup) {
      await db.insert(calendarGroups).values({
        name: user.name,
        color: user.color || '#3B82F6',
        type: 'user',
        userId: user.id,
        sortOrder: 10,
      });
    }
  }

  // Create "Family" custom group if no custom group named "Family" exists
  const hasFamily = existingGroups.some((g) => g.type === 'custom' && g.name === 'Family');
  if (!hasFamily) {
    await db.insert(calendarGroups).values({
      name: 'Family',
      color: '#F59E0B',
      type: 'custom',
      sortOrder: 0,
    });
  }

  // Migrate existing calendar_sources that have userId or isFamily but no groupId
  const refreshedGroups = await db.select().from(calendarGroups);
  const ungroupedSources = await db
    .select({ id: calendarSources.id, userId: calendarSources.userId, isFamily: calendarSources.isFamily })
    .from(calendarSources)
    .where(sql`${calendarSources.groupId} IS NULL AND (${calendarSources.userId} IS NOT NULL OR ${calendarSources.isFamily} = true)`);

  for (const source of ungroupedSources) {
    let targetGroup;
    if (source.isFamily) {
      targetGroup = refreshedGroups.find((g) => g.type === 'custom' && g.name === 'Family');
    } else if (source.userId) {
      targetGroup = refreshedGroups.find((g) => g.type === 'user' && g.userId === source.userId);
    }
    if (targetGroup) {
      await db.update(calendarSources).set({ groupId: targetGroup.id }).where(eq(calendarSources.id, source.id));
    }
  }
}
