/**
 *
 * ENDPOINT: /api/chores
 * - GET:  List all chores (with optional filters)
 * - POST: Create a new chore
 *
 * QUERY PARAMETERS (GET):
 * - assignedTo: Filter by user ID
 * - enabled: Filter by enabled status (default: true)
 *
 * EXAMPLE:
 * GET /api/chores?assignedTo=user-uuid&enabled=true
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { chores, users, choreCompletions } from '@/lib/db/schema';
import { eq, and, desc, isNull, or, lte } from 'drizzle-orm';
import { createChoreSchema, validateRequest } from '@/lib/validations';
import { getCached } from '@/lib/cache/redis';
import { getHouseholdTimezone } from '@/lib/householdTimezone';
import { todayKey } from '@/lib/utils/zonedDate';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { formatChoreRow } from '@/lib/utils/formatters';
import { logError } from '@/lib/utils/logError';

/**
 * GET /api/chores
 * Lists all chores with optional filtering.
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ chores: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo');
    const enabledOnly = searchParams.get('enabled') !== 'false';
    // When true, return future-dated chores too (calendar overlay needs them
    // so a chore dragged onto a date later this month doesn't disappear).
    // The chores list page omits this and gets only currently-due items.
    const includeFuture = searchParams.get('includeFuture') === 'true';

    // The household's today, not the server's. In the key so the cached list
    // rolls over at the household's midnight.
    const today = todayKey(await getHouseholdTimezone());
    const cacheKey = `chores:${assignedTo || 'all'}:${enabledOnly}:future=${includeFuture}:${today}`;

    const data = await getCached(cacheKey, async () => {
      // First, get all pending completions
      const pendingCompletions = await db
        .select({
          choreId: choreCompletions.choreId,
          completionId: choreCompletions.id,
          completedAt: choreCompletions.completedAt,
          completedById: choreCompletions.completedBy,
          completedByName: users.name,
          completedByColor: users.color,
        })
        .from(choreCompletions)
        .innerJoin(users, eq(choreCompletions.completedBy, users.id))
        .where(isNull(choreCompletions.approvedBy));

      const pendingMap = new Map<string, {
        completionId: string;
        completedAt: string;
        completedBy: { id: string; name: string; color: string };
      }>();

      const choreIdsWithPending = new Set<string>();

      for (const pc of pendingCompletions) {
        choreIdsWithPending.add(pc.choreId);
        pendingMap.set(pc.choreId, {
          completionId: pc.completionId,
          completedAt: pc.completedAt.toISOString(),
          completedBy: {
            id: pc.completedById,
            name: pc.completedByName,
            color: pc.completedByColor,
          },
        });
      }

      // Build base query for all matching chores
      const query = db
        .select({
          id: chores.id,
          title: chores.title,
          description: chores.description,
          category: chores.category,
          frequency: chores.frequency,
          customIntervalDays: chores.customIntervalDays,
          startDay: chores.startDay,
          lastCompleted: chores.lastCompleted,
          nextDue: chores.nextDue,
          nextDueTime: chores.nextDueTime,
          pointValue: chores.pointValue,
          requiresApproval: chores.requiresApproval,
          enabled: chores.enabled,
          createdAt: chores.createdAt,
          assignedToId: chores.assignedTo,
          assignedToName: users.name,
          assignedToColor: users.color,
          assignedToAvatar: users.avatarUrl,
        })
        .from(chores)
        .leftJoin(users, eq(chores.assignedTo, users.id))
        .orderBy(desc(chores.createdAt));

      // Apply filters
      const conditions = [];
      if (assignedTo) {
        conditions.push(eq(chores.assignedTo, assignedTo));
      }
      if (enabledOnly) {
        conditions.push(eq(chores.enabled, true));
      }

      const results = await query.where(and(...conditions));

      // Filter to show chores that are either:
      // 1. Due today or earlier (nextDue <= today or no nextDue)
      // 2. Have a pending completion awaiting approval
      // 3. Were completed within the last 24 hours (so they still appear as "done" in the UI)
      // When includeFuture=true (calendar overlay), skip the date filter so
      // future-dated chores remain visible after a drag-and-drop reschedule.
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const filteredResults = includeFuture
        ? results
        : results.filter(row => {
            const isDue = !row.nextDue || row.nextDue <= today;
            const hasPending = choreIdsWithPending.has(row.id);
            const recentlyCompleted = row.lastCompleted && row.lastCompleted > oneDayAgo;
            return isDue || hasPending || recentlyCompleted;
          });

      const formattedChores = filteredResults.map(row => {
        const pendingCompletion = pendingMap.get(row.id);
        return formatChoreRow(row, pendingCompletion);
      });

      return { chores: formattedChores };
    }, 60);

    return NextResponse.json(data);
  } catch (error) {
    logError('Error fetching chores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chores' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chores
 * Creates a new chore.
 *
 * REQUEST BODY:
 * {
 *   title: string (required)
 *   description?: string
 *   assignedTo?: string (user UUID)
 *   schedule: 'daily' | 'weekly' | 'monthly' | 'custom'
 *   scheduleDays?: number[] (for custom schedules, 0=Sun)
 *   points?: number (default: 0)
 *   requiresApproval?: boolean (default: false)
 *   createdBy?: string (user UUID)
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const roleCheck = requireRole(auth, 'canManageChores');
  if (roleCheck) return roleCheck;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'chores', 30, 60);
  if (limited) return limited;

  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(createChoreSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      category,
      assignedTo,
      frequency,
      customIntervalDays,
      startDay,
      pointValue,
      requiresApproval,
      createdBy,
      nextDue,
      nextDueTime,
    } = validation.data;

    // Insert the chore
    const [newChore] = await db
      .insert(chores)
      .values({
        title,
        description: description || null,
        category,
        assignedTo: assignedTo || null,
        frequency,
        customIntervalDays: customIntervalDays || null,
        startDay: startDay || null,
        pointValue: pointValue || 0,
        requiresApproval: requiresApproval || false,
        createdBy: createdBy || null,
        nextDue: nextDue || undefined,
        nextDueTime: nextDueTime ?? null,
      })
      .returning();

    if (!newChore) {
      return NextResponse.json(
        { error: 'Failed to create chore' },
        { status: 500 }
      );
    }

    await invalidateEntity('chores');

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'chore',
      entityId: newChore.id,
      summary: `Created chore: ${title.trim()}`,
    });

    return NextResponse.json(newChore, { status: 201 });
  } catch (error) {
    logError('Error creating chore:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create chore: ${errorMessage}` },
      { status: 500 }
    );
  }
}
