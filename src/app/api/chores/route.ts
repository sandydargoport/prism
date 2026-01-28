/**
 * ============================================================================
 * PRISM - Chores API Route
 * ============================================================================
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
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { chores, users, choreCompletions } from '@/lib/db/schema';
import { eq, and, desc, isNull, or, lte } from 'drizzle-orm';
import { createChoreSchema, validateRequest } from '@/lib/validations';
import { format } from 'date-fns';

/**
 * GET /api/chores
 * ============================================================================
 * Lists all chores with optional filtering.
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assignedTo = searchParams.get('assignedTo');
    const enabledOnly = searchParams.get('enabled') !== 'false';

    // Build base query
    const query = db
      .select({
        id: chores.id,
        title: chores.title,
        description: chores.description,
        category: chores.category,
        frequency: chores.frequency,
        customIntervalDays: chores.customIntervalDays,
        lastCompleted: chores.lastCompleted,
        nextDue: chores.nextDue,
        pointValue: chores.pointValue,
        requiresApproval: chores.requiresApproval,
        enabled: chores.enabled,
        createdAt: chores.createdAt,
        assignedToId: chores.assignedTo,
        assignedToName: users.name,
        assignedToColor: users.color,
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

    // Only show chores that are due (nextDue is null or today/earlier)
    // This hides chores that were completed today until their next due date
    const today = format(new Date(), 'yyyy-MM-dd');
    conditions.push(
      or(
        isNull(chores.nextDue),
        lte(chores.nextDue, today)
      )
    );

    const results = await query.where(and(...conditions));

    // Fetch ALL pending completions (completed but not yet approved) for all chores
    // No date filter - show all pending regardless of when they were completed
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

    // Create a map of chore ID to pending completion info
    const pendingMap = new Map<string, {
      completionId: string;
      completedAt: Date;
      completedBy: {
        id: string;
        name: string;
        color: string;
      };
    }>();

    for (const pc of pendingCompletions) {
      pendingMap.set(pc.choreId, {
        completionId: pc.completionId,
        completedAt: pc.completedAt,
        completedBy: {
          id: pc.completedById,
          name: pc.completedByName,
          color: pc.completedByColor,
        },
      });
    }

    // Format response with pending completion status
    const formattedChores = results.map(row => {
      const pendingCompletion = pendingMap.get(row.id);
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        frequency: row.frequency,
        customIntervalDays: row.customIntervalDays,
        lastCompleted: row.lastCompleted?.toISOString() || null,
        nextDue: row.nextDue || null,
        pointValue: row.pointValue,
        requiresApproval: row.requiresApproval,
        enabled: row.enabled,
        createdAt: row.createdAt.toISOString(),
        assignedTo: row.assignedToId ? {
          id: row.assignedToId,
          name: row.assignedToName,
          color: row.assignedToColor,
        } : null,
        // New fields for pending approval tracking
        pendingApproval: pendingCompletion ? {
          completionId: pendingCompletion.completionId,
          completedAt: pendingCompletion.completedAt.toISOString(),
          completedBy: pendingCompletion.completedBy,
        } : null,
      };
    });

    return NextResponse.json({ chores: formattedChores });
  } catch (error) {
    console.error('Error fetching chores:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chores' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chores
 * ============================================================================
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
 * ============================================================================
 */
export async function POST(request: NextRequest) {
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
      pointValue,
      requiresApproval,
      createdBy,
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
        pointValue: pointValue || 0,
        requiresApproval: requiresApproval || false,
        createdBy: createdBy || null,
      })
      .returning();

    if (!newChore) {
      return NextResponse.json(
        { error: 'Failed to create chore' },
        { status: 500 }
      );
    }

    return NextResponse.json(newChore, { status: 201 });
  } catch (error) {
    console.error('Error creating chore:', error);
    return NextResponse.json(
      { error: 'Failed to create chore' },
      { status: 500 }
    );
  }
}
