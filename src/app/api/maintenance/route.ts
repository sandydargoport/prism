/**
 *
 * ENDPOINT: /api/maintenance
 * - GET:  List maintenance reminders
 * - POST: Create a new maintenance reminder
 *
 * EXAMPLES:
 * - Car oil change (every 3 months)
 * - HVAC filter replacement (monthly)
 * - Lawn mower blade sharpening (annually)
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { maintenanceReminders, users } from '@/lib/db/schema';
import { eq, and, lte, asc } from 'drizzle-orm';
import { createMaintenanceSchema, validateRequest } from '@/lib/validations';

/**
 * GET /api/maintenance
 * Lists maintenance reminders with optional filtering.
 *
 * QUERY PARAMETERS:
 * - category: Filter by category (car, home, appliance, yard, other)
 * - upcoming: "true" to show only upcoming/overdue items
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const upcomingOnly = searchParams.get('upcoming') === 'true';

    // Build query
    const query = db
      .select({
        id: maintenanceReminders.id,
        title: maintenanceReminders.title,
        category: maintenanceReminders.category,
        description: maintenanceReminders.description,
        schedule: maintenanceReminders.schedule,
        customIntervalDays: maintenanceReminders.customIntervalDays,
        lastCompleted: maintenanceReminders.lastCompleted,
        nextDue: maintenanceReminders.nextDue,
        notes: maintenanceReminders.notes,
        createdAt: maintenanceReminders.createdAt,
        assignedUserId: users.id,
        assignedUserName: users.name,
        assignedUserColor: users.color,
      })
      .from(maintenanceReminders)
      .leftJoin(users, eq(maintenanceReminders.assignedTo, users.id))
      .orderBy(asc(maintenanceReminders.nextDue));

    // Apply filters
    const conditions = [];
    if (category) {
      conditions.push(eq(maintenanceReminders.category, category as any));
    }
    if (upcomingOnly) {
      // Show items due within the next 30 days
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      conditions.push(lte(maintenanceReminders.nextDue, thirtyDaysFromNow.toISOString().split('T')[0]!));
    }

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    // Format response
    const formattedReminders = results.map(reminder => ({
      id: reminder.id,
      title: reminder.title,
      category: reminder.category,
      description: reminder.description,
      schedule: reminder.schedule,
      customIntervalDays: reminder.customIntervalDays,
      lastCompleted: reminder.lastCompleted?.toISOString() || null,
      nextDue: reminder.nextDue,
      notes: reminder.notes,
      createdAt: reminder.createdAt.toISOString(),
      assignedTo: reminder.assignedUserId ? {
        id: reminder.assignedUserId,
        name: reminder.assignedUserName,
        color: reminder.assignedUserColor,
      } : null,
    }));

    return NextResponse.json({ reminders: formattedReminders });
  } catch (error) {
    console.error('Error fetching maintenance reminders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch maintenance reminders' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/maintenance
 * Creates a new maintenance reminder.
 *
 * REQUEST BODY:
 * {
 *   title: string (required, e.g., "Change oil filter")
 *   category: "car" | "home" | "appliance" | "yard" | "other"
 *   description?: string
 *   schedule: "monthly" | "quarterly" | "annually" | "custom"
 *   customIntervalDays?: number (for custom schedules)
 *   nextDue: string (required, YYYY-MM-DD format)
 *   assignedTo?: string (user UUID)
 *   notes?: string
 *   createdBy?: string (user UUID)
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(createMaintenanceSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      title,
      category,
      description,
      schedule,
      customIntervalDays,
      nextDue,
      assignedTo,
      notes,
      createdBy,
    } = validation.data;

    // Insert the reminder
    const [newReminder] = await db
      .insert(maintenanceReminders)
      .values({
        title,
        category,
        description: description || null,
        schedule,
        customIntervalDays: customIntervalDays || null,
        nextDue,
        assignedTo: assignedTo || null,
        notes: notes || null,
        createdBy: createdBy || null,
      })
      .returning();

    if (!newReminder) {
      return NextResponse.json(
        { error: 'Failed to create maintenance reminder' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: newReminder.id,
      title: newReminder.title,
      category: newReminder.category,
      description: newReminder.description,
      schedule: newReminder.schedule,
      customIntervalDays: newReminder.customIntervalDays,
      lastCompleted: newReminder.lastCompleted?.toISOString() || null,
      nextDue: newReminder.nextDue,
      notes: newReminder.notes,
      createdAt: newReminder.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating maintenance reminder:', error);
    return NextResponse.json(
      { error: 'Failed to create maintenance reminder' },
      { status: 500 }
    );
  }
}
