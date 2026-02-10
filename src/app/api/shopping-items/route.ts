/**
 *
 * ENDPOINT: /api/shopping-items
 * - GET:  List shopping items (filtered by listId)
 * - POST: Create a new shopping item
 *
 * QUERY PARAMETERS (GET):
 * - listId: Filter by shopping list ID (recommended)
 * - checked: Filter by checked status ("true" or "false")
 *
 * EXAMPLE:
 * GET /api/shopping-items?listId=abc123&checked=false
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { shoppingItems, users } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { createShoppingItemSchema, validateRequest } from '@/lib/validations';
import { invalidateCache } from '@/lib/cache/redis';

/**
 * GET /api/shopping-items
 * Lists shopping items with optional filtering.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('listId');
    const checked = searchParams.get('checked');

    // Build query
    const query = db
      .select({
        id: shoppingItems.id,
        name: shoppingItems.name,
        quantity: shoppingItems.quantity,
        unit: shoppingItems.unit,
        category: shoppingItems.category,
        checked: shoppingItems.checked,
        recurring: shoppingItems.recurring,
        recurrenceInterval: shoppingItems.recurrenceInterval,
        notes: shoppingItems.notes,
        listId: shoppingItems.listId,
        createdAt: shoppingItems.createdAt,
        addedById: users.id,
        addedByName: users.name,
        addedByColor: users.color,
      })
      .from(shoppingItems)
      .leftJoin(users, eq(shoppingItems.addedBy, users.id))
      .orderBy(asc(shoppingItems.category), asc(shoppingItems.name));

    // Apply filters
    const conditions = [];
    if (listId) {
      conditions.push(eq(shoppingItems.listId, listId));
    }
    if (checked !== null) {
      conditions.push(eq(shoppingItems.checked, checked === 'true'));
    }

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    // Format response
    const formattedItems = results.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      checked: item.checked,
      recurring: item.recurring,
      recurrenceInterval: item.recurrenceInterval,
      notes: item.notes,
      listId: item.listId,
      createdAt: item.createdAt.toISOString(),
      addedBy: item.addedById ? {
        id: item.addedById,
        name: item.addedByName,
        color: item.addedByColor,
      } : null,
    }));

    return NextResponse.json({ items: formattedItems });
  } catch (error) {
    console.error('Error fetching shopping items:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping items' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shopping-items
 * Creates a new shopping item.
 *
 * REQUEST BODY:
 * {
 *   listId: string (required, shopping list UUID)
 *   name: string (required, e.g., "Milk")
 *   quantity?: number
 *   unit?: string (e.g., "gallons", "lbs")
 *   category?: string (e.g., "Dairy", "Produce")
 *   recurring?: boolean
 *   recurrenceInterval?: "weekly" | "monthly"
 *   addedBy?: string (user UUID)
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'shopping-items', 30, 60);
  if (limited) return limited;

  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(createShoppingItemSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      listId,
      name,
      quantity,
      unit,
      category,
      recurring,
      recurrenceInterval,
      addedBy,
      notes,
    } = validation.data;

    // Insert the item
    const [newItem] = await db
      .insert(shoppingItems)
      .values({
        listId,
        name,
        quantity: quantity || null,
        unit: unit || null,
        category: category || null,
        recurring: recurring || false,
        recurrenceInterval: recurrenceInterval || null,
        addedBy: addedBy || null,
        notes: notes || null,
      })
      .returning();

    if (!newItem) {
      return NextResponse.json(
        { error: 'Failed to create shopping item' },
        { status: 500 }
      );
    }

    await invalidateCache('shopping-lists:*');

    return NextResponse.json({
      id: newItem.id,
      listId: newItem.listId,
      name: newItem.name,
      quantity: newItem.quantity,
      unit: newItem.unit,
      category: newItem.category,
      checked: newItem.checked,
      recurring: newItem.recurring,
      recurrenceInterval: newItem.recurrenceInterval,
      notes: newItem.notes,
      createdAt: newItem.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shopping item:', error);
    return NextResponse.json(
      { error: 'Failed to create shopping item' },
      { status: 500 }
    );
  }
}
