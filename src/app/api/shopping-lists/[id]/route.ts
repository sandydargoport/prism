/**
 *
 * ENDPOINT: /api/shopping-lists/[id]
 * - GET:    Get a specific shopping list by ID
 * - PATCH:  Update a specific shopping list
 * - DELETE: Delete a specific shopping list
 *
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { shoppingLists } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createShoppingListSchema, validateRequest } from '@/lib/validations';

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/shopping-lists/[id]
 * Retrieves a single shopping list by its ID.
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [list] = await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.id, id));

    if (!list) {
      return NextResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: list.id,
      name: list.name,
      icon: list.icon,
      color: list.color,
      listType: list.listType,
      sortOrder: list.sortOrder,
      assignedTo: list.assignedTo,
      createdAt: list.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shopping list' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/shopping-lists/[id]
 * Updates a specific shopping list.
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await request.json();

    // Check if list exists
    const [existingList] = await db
      .select({ id: shoppingLists.id })
      .from(shoppingLists)
      .where(eq(shoppingLists.id, id));

    if (!existingList) {
      return NextResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    // Validate with partial schema
    const validation = validateRequest(createShoppingListSchema.partial(), body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {};
    if ('name' in validation.data) updateData.name = validation.data.name;
    if ('description' in validation.data) updateData.description = validation.data.description || null;
    if ('icon' in validation.data) updateData.icon = validation.data.icon || null;
    if ('color' in validation.data) updateData.color = validation.data.color || null;
    if ('listType' in validation.data) updateData.listType = validation.data.listType || 'grocery';
    if ('sortOrder' in validation.data) updateData.sortOrder = validation.data.sortOrder || null;
    if ('assignedTo' in validation.data) updateData.assignedTo = validation.data.assignedTo || null;

    // Execute update
    await db
      .update(shoppingLists)
      .set(updateData)
      .where(eq(shoppingLists.id, id));

    // Fetch and return updated list
    const [updatedList] = await db
      .select()
      .from(shoppingLists)
      .where(eq(shoppingLists.id, id));

    if (!updatedList) {
      return NextResponse.json(
        { error: 'Shopping list not found after update' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updatedList.id,
      name: updatedList.name,
      icon: updatedList.icon,
      color: updatedList.color,
      listType: updatedList.listType,
      sortOrder: updatedList.sortOrder,
      assignedTo: updatedList.assignedTo,
      createdAt: updatedList.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating shopping list:', error);
    return NextResponse.json(
      { error: 'Failed to update shopping list' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shopping-lists/[id]
 * Deletes a specific shopping list and all its items (CASCADE).
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    // Check if list exists
    const [existingList] = await db
      .select({ id: shoppingLists.id, name: shoppingLists.name })
      .from(shoppingLists)
      .where(eq(shoppingLists.id, id));

    if (!existingList) {
      return NextResponse.json(
        { error: 'Shopping list not found' },
        { status: 404 }
      );
    }

    // Delete the list (CASCADE will delete related items)
    await db
      .delete(shoppingLists)
      .where(eq(shoppingLists.id, id));

    return NextResponse.json({
      message: 'Shopping list deleted successfully',
      deletedList: {
        id: existingList.id,
        name: existingList.name,
      },
    });
  } catch (error) {
    console.error('Error deleting shopping list:', error);
    return NextResponse.json(
      { error: 'Failed to delete shopping list' },
      { status: 500 }
    );
  }
}
