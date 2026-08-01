import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { calendarGroups, calendarSources, users } from '@/lib/db/schema';
import { eq, asc, sql } from 'drizzle-orm';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logError } from '@/lib/utils/logError';

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
          userSortOrder: users.sortOrder,
          // Count only sources that actually carry events — CalDAV reminder
          // lists (supportsEvents=false) are hidden from the Calendar UI so
          // including them here would make the badge show "3 sources" while
          // the user can only see 2. The IS DISTINCT FROM 'false' check
          // treats missing/null flags as truthy for backward compatibility
          // with non-CalDAV providers and legacy rows.
          sourceCount: sql<number>`(
            SELECT count(*)::int FROM calendar_sources
            WHERE calendar_sources.group_id = ${calendarGroups.id}
              AND (
                calendar_sources.provider != 'caldav'
                OR (calendar_sources.sync_errors->>'supportsEvents') IS DISTINCT FROM 'false'
              )
          )`,
          userName: users.name,
          userColor: users.color,
        })
        .from(calendarGroups)
        .leftJoin(users, eq(calendarGroups.userId, users.id))
        .orderBy(
          // Non-user groups (Family, etc.) come first, then user groups in family member order
          sql`CASE WHEN ${calendarGroups.type} = 'user' THEN 1 ELSE 0 END`,
          sql`CASE WHEN ${calendarGroups.type} = 'user' THEN COALESCE(${users.sortOrder}, 999) ELSE ${calendarGroups.sortOrder} END`,
          asc(calendarGroups.name)
        );

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
    logError('Error fetching calendar groups:', error);
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
    const trimmedName = body.name.trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (body.color && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
    }

    // Names must be unique (case-insensitive) across every group AND every
    // family member — a member's name is reserved for their auto-managed
    // personal group, so a second "Alex" group (or one shadowing the "Family"
    // aggregate) would be ambiguous in the filter and event picker.
    const lower = trimmedName.toLowerCase();
    const [existingGroups, existingUsers] = await Promise.all([
      db.select({ name: calendarGroups.name }).from(calendarGroups),
      db.select({ name: users.name }).from(users),
    ]);
    const clash =
      existingGroups.some((g) => g.name.trim().toLowerCase() === lower) ||
      existingUsers.some((u) => u.name.trim().toLowerCase() === lower);
    if (clash) {
      return NextResponse.json(
        { error: `A calendar group named "${trimmedName}" already exists.` },
        { status: 409 }
      );
    }

    const [group] = await db
      .insert(calendarGroups)
      .values({
        name: trimmedName,
        color: body.color || '#3B82F6',
        type: 'custom',
        sortOrder: body.sortOrder ?? 100,
      })
      .returning();

    await invalidateEntity('calendar-groups');

    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    logError('Error creating calendar group:', error);
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

  // The shared "Family" aggregate is a SYSTEM group (type 'family'), not a
  // user-created 'custom' one — so it's non-deletable and non-renamable like the
  // per-member 'user' groups. Match on type OR name so a pre-migration install
  // (Family still typed 'custom') isn't given a duplicate.
  const hasFamily = existingGroups.some((g) => g.type === 'family' || g.name === 'Family');
  if (!hasFamily) {
    newGroups.push({
      name: 'Family',
      color: '#F59E0B',
      type: 'family',
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
    const familyGroupId = refreshedGroups.find((g) => g.type === 'family' || g.name === 'Family')?.id;

    for (const source of ungroupedSources) {
      const targetGroupId = source.isFamily ? familyGroupId : (source.userId ? userGroupMap.get(source.userId) : undefined);
      if (targetGroupId) {
        await db.update(calendarSources).set({ groupId: targetGroupId }).where(eq(calendarSources.id, source.id));
      }
    }
  }
}
