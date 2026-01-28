/**
 * ============================================================================
 * PRISM - Individual Shopping Item API Route
 * ============================================================================
 *
 * ENDPOINT: /api/shopping-items/[id]
 * - PATCH:  Update a shopping item (including toggling checked status)
 * - DELETE: Delete a shopping item
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { shoppingItems, shoppingLists, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateShoppingItemSchema, validateRequest } from '@/lib/validations';
import { cookies } from 'next/headers';
import { validateSession } from '@/lib/auth/session';

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/shopping-items/[id]
 * ============================================================================
 * Updates a shopping item (commonly used to toggle checked status).
 *
 * REQUEST BODY (all fields optional):
 * {
 *   name?: string
 *   quantity?: number
 *   unit?: string
 *   category?: string
 *   checked?: boolean  // Toggle item as checked/unchecked
 *   recurring?: boolean
 *   recurrenceInterval?: "weekly" | "monthly"
 *   notes?: string
 * }
 * ============================================================================
 */
export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;
    const body = await request.json();

    // Check if item exists and get list info
    const [existingItem] = await db
      .select({
        id: shoppingItems.id,
        listId: shoppingItems.listId,
      })
      .from(shoppingItems)
      .where(eq(shoppingItems.id, id));

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Shopping item not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const validation = validateRequest(updateShoppingItemSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    // ========================================================================
    // AUTHORIZATION CHECK - Only list owner can check off items on their list
    // ========================================================================
    if ('checked' in validation.data) {
      // Get list ownership info
      const [list] = await db
        .select({ assignedTo: shoppingLists.assignedTo })
        .from(shoppingLists)
        .where(eq(shoppingLists.id, existingItem.listId));

      // If list is assigned to someone, check authorization
      if (list?.assignedTo) {
        const cookieStore = await cookies();
        const sessionToken = cookieStore.get('prism_session')?.value;
        const userId = cookieStore.get('prism_user')?.value;

        if (!sessionToken || !userId) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          );
        }

        // Validate session token
        const sessionData = await validateSession(sessionToken);
        if (!sessionData || sessionData.userId !== userId) {
          return NextResponse.json(
            { error: 'Invalid or expired session' },
            { status: 401 }
          );
        }

        // Get user role
        const [currentUser] = await db
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, userId));

        if (!currentUser) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 401 }
          );
        }

        // Only the assigned user or parents can check items on assigned lists
        const isParent = currentUser.role === 'parent';
        const isListOwner = list.assignedTo === userId;

        if (!isParent && !isListOwner) {
          return NextResponse.json(
            { error: 'Only the list owner can check off items on their list' },
            { status: 403 }
          );
        }
      }
    }

    // Build update object (only update provided fields)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if ('name' in validation.data) updateData.name = validation.data.name;
    if ('quantity' in validation.data) updateData.quantity = validation.data.quantity || null;
    if ('unit' in validation.data) updateData.unit = validation.data.unit || null;
    if ('category' in validation.data) updateData.category = validation.data.category || null;
    if ('checked' in validation.data) updateData.checked = validation.data.checked;
    if ('recurring' in validation.data) updateData.recurring = validation.data.recurring;
    if ('recurrenceInterval' in validation.data) updateData.recurrenceInterval = validation.data.recurrenceInterval || null;
    if ('notes' in validation.data) updateData.notes = validation.data.notes || null;

    // Execute update
    await db
      .update(shoppingItems)
      .set(updateData)
      .where(eq(shoppingItems.id, id));

    // Fetch and return updated item
    const [updatedItem] = await db
      .select()
      .from(shoppingItems)
      .where(eq(shoppingItems.id, id));

    if (!updatedItem) {
      return NextResponse.json(
        { error: 'Shopping item not found after update' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updatedItem.id,
      listId: updatedItem.listId,
      name: updatedItem.name,
      quantity: updatedItem.quantity,
      unit: updatedItem.unit,
      category: updatedItem.category,
      checked: updatedItem.checked,
      recurring: updatedItem.recurring,
      recurrenceInterval: updatedItem.recurrenceInterval,
      notes: updatedItem.notes,
      createdAt: updatedItem.createdAt.toISOString(),
      updatedAt: updatedItem.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error('Error updating shopping item:', error);
    return NextResponse.json(
      { error: 'Failed to update shopping item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/shopping-items/[id]
 * ============================================================================
 * Deletes a shopping item.
 * ============================================================================
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Check if item exists
    const [existingItem] = await db
      .select({ id: shoppingItems.id, name: shoppingItems.name })
      .from(shoppingItems)
      .where(eq(shoppingItems.id, id));

    if (!existingItem) {
      return NextResponse.json(
        { error: 'Shopping item not found' },
        { status: 404 }
      );
    }

    // Delete the item
    await db
      .delete(shoppingItems)
      .where(eq(shoppingItems.id, id));

    return NextResponse.json({
      message: 'Shopping item deleted successfully',
      deletedItem: {
        id: existingItem.id,
        name: existingItem.name,
      },
    });
  } catch (error) {
    console.error('Error deleting shopping item:', error);
    return NextResponse.json(
      { error: 'Failed to delete shopping item' },
      { status: 500 }
    );
  }
}
