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
import { db } from '@/lib/db/client';
import { shoppingLists } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { createShoppingListSchema, validateRequest } from '@/lib/validations';

/**
 * GET /api/shopping-lists
 * ============================================================================
 * Lists all shopping lists, ordered by sortOrder.
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  try {
    const lists = await db
      .select({
        id: shoppingLists.id,
        name: shoppingLists.name,
        icon: shoppingLists.icon,
        color: shoppingLists.color,
        sortOrder: shoppingLists.sortOrder,
        assignedTo: shoppingLists.assignedTo,
        createdAt: shoppingLists.createdAt,
      })
      .from(shoppingLists)
      .orderBy(asc(shoppingLists.sortOrder), asc(shoppingLists.name));

    const formattedLists = lists.map(list => ({
      id: list.id,
      name: list.name,
      icon: list.icon,
      color: list.color,
      sortOrder: list.sortOrder,
      assignedTo: list.assignedTo,
      createdAt: list.createdAt.toISOString(),
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

    const { name, icon, color, sortOrder, description, assignedTo, createdBy } = validation.data;

    // Insert the list
    const [newList] = await db
      .insert(shoppingLists)
      .values({
        name,
        description: description || null,
        icon: icon || null,
        color: color || null,
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
      sortOrder: newList.sortOrder,
      createdAt: newList.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating shopping list:', error);
    return NextResponse.json(
      { error: 'Failed to create shopping list' },
      { status: 500 }
    );
  }
}
