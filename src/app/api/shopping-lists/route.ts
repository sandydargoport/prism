/**
 * ============================================================================
 * PRISM - Shopping Lists API Route
 * ============================================================================
 *
 * ENDPOINT: /api/shopping-lists
 * - GET:  List all shopping lists
 * - POST: Create a new shopping list
 *
 * EXAMPLES:
 * - "Grocery"
 * - "Hardware Store"
 * - "Costco"
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { shoppingLists, shoppingItems, users } from '@/lib/db/schema';
import { asc, eq } from 'drizzle-orm';
import { createShoppingListSchema, validateRequest } from '@/lib/validations';

/**
 * GET /api/shopping-lists
 * ============================================================================
 * Lists all shopping lists, ordered by sortOrder.
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ lists: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const includeItems = searchParams.get('includeItems') === 'true';

    const lists = await db
      .select({
        id: shoppingLists.id,
        name: shoppingLists.name,
        icon: shoppingLists.icon,
        color: shoppingLists.color,
        listType: shoppingLists.listType,
        sortOrder: shoppingLists.sortOrder,
        assignedTo: shoppingLists.assignedTo,
        createdAt: shoppingLists.createdAt,
      })
      .from(shoppingLists)
      .orderBy(asc(shoppingLists.sortOrder), asc(shoppingLists.name));

    if (!includeItems) {
      const formattedLists = lists.map(list => ({
        id: list.id,
        name: list.name,
        icon: list.icon,
        color: list.color,
        listType: list.listType,
        sortOrder: list.sortOrder,
        assignedTo: list.assignedTo,
        createdAt: list.createdAt.toISOString(),
      }));
      return NextResponse.json({ lists: formattedLists });
    }

    // Fetch all items in a single query, joined with addedBy user
    const allItems = await db
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

    // Group items by listId
    const itemsByList = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const listItems = itemsByList.get(item.listId) || [];
      listItems.push(item);
      itemsByList.set(item.listId, listItems);
    }

    const formattedLists = lists.map(list => ({
      id: list.id,
      name: list.name,
      icon: list.icon,
      color: list.color,
      listType: list.listType,
      sortOrder: list.sortOrder,
      assignedTo: list.assignedTo,
      createdAt: list.createdAt.toISOString(),
      items: (itemsByList.get(list.id) || []).map(item => ({
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
      })),
    }));

    return NextResponse.json({ lists: formattedLists });
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping lists' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/shopping-lists
 * ============================================================================
 * Creates a new shopping list.
 *
 * REQUEST BODY:
 * {
 *   name: string (required, e.g., "Grocery")
 *   icon?: string (emoji or icon name)
 *   color?: string (hex color)
 *   sortOrder?: number
 * }
 * ============================================================================
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(createShoppingListSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, icon, color, listType, sortOrder, description, assignedTo, createdBy } = validation.data;

    // Insert the list
    const [newList] = await db
      .insert(shoppingLists)
      .values({
        name,
        description: description || null,
        icon: icon || null,
        color: color || null,
        listType: listType || 'grocery',
        sortOrder: sortOrder ?? 0,
        assignedTo: assignedTo || null,
        createdBy: createdBy || null,
      })
      .returning();

    if (!newList) {
      return NextResponse.json(
        { error: 'Failed to create shopping list' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: newList.id,
      name: newList.name,
      icon: newList.icon,
      color: newList.color,
      listType: newList.listType,
      sortOrder: newList.sortOrder,
      createdAt: newList.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shopping list:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create shopping list: ${errorMessage}` },
      { status: 500 }
    );
  }
}
