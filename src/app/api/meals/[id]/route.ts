/**
 * ============================================================================
 * PRISM - Individual Meal API Route
 * ============================================================================
 *
 * ENDPOINT: /api/meals/[id]
 * - GET:    Get a specific meal by ID
 * - PATCH:  Update a specific meal (including marking as cooked)
 * - DELETE: Delete a specific meal
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { meals, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { updateMealSchema, validateRequest } from '@/lib/validations';

/**
 * Route params type
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/meals/[id]
 * ============================================================================
 * Retrieves a single meal by its ID.
 * ============================================================================
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    const [mealWithUser] = await db
      .select({
        id: meals.id,
        name: meals.name,
        description: meals.description,
        recipe: meals.recipe,
        recipeUrl: meals.recipeUrl,
        prepTime: meals.prepTime,
        cookTime: meals.cookTime,
        servings: meals.servings,
        ingredients: meals.ingredients,
        dayOfWeek: meals.dayOfWeek,
        mealType: meals.mealType,
        cookedAt: meals.cookedAt,
        cookedBy: meals.cookedBy,
        weekOf: meals.weekOf,
        source: meals.source,
        sourceId: meals.sourceId,
        createdAt: meals.createdAt,
        updatedAt: meals.updatedAt,
        createdById: users.id,
        createdByName: users.name,
        createdByColor: users.color,
      })
      .from(meals)
      .leftJoin(users, eq(meals.createdBy, users.id))
      .where(eq(meals.id, id));

    if (!mealWithUser) {
      return NextResponse.json(
        { error: 'Meal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: mealWithUser.id,
      name: mealWithUser.name,
      description: mealWithUser.description,
      recipe: mealWithUser.recipe,
      recipeUrl: mealWithUser.recipeUrl,
      prepTime: mealWithUser.prepTime,
      cookTime: mealWithUser.cookTime,
      servings: mealWithUser.servings,
      ingredients: mealWithUser.ingredients,
      dayOfWeek: mealWithUser.dayOfWeek,
      mealType: mealWithUser.mealType,
      cookedAt: mealWithUser.cookedAt?.toISOString() || null,
      cookedBy: mealWithUser.cookedBy,
      weekOf: mealWithUser.weekOf,
      source: mealWithUser.source,
      sourceId: mealWithUser.sourceId,
      createdAt: mealWithUser.createdAt.toISOString(),
      updatedAt: mealWithUser.updatedAt.toISOString(),
      createdBy: mealWithUser.createdById ? {
        id: mealWithUser.createdById,
        name: mealWithUser.createdByName,
        color: mealWithUser.createdByColor,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching meal:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meal' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/meals/[id]
 * ============================================================================
 * Updates a specific meal.
 *
 * REQUEST BODY (all fields optional):
 * {
 *   name?: string
 *   dayOfWeek?: number | null (0-6, null to unassign)
 *   recipeUrl?: string | null
 *   notes?: string | null
 *   cooked?: boolean  // Mark as cooked/uncooked
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

    // Check if meal exists
    const [existingMeal] = await db
      .select({ id: meals.id })
      .from(meals)
      .where(eq(meals.id, id));

    if (!existingMeal) {
      return NextResponse.json(
        { error: 'Meal not found' },
        { status: 404 }
      );
    }

    // Validate request body
    const validation = validateRequest(updateMealSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if ('name' in validation.data) updateData.name = validation.data.name;
    if ('description' in validation.data) updateData.description = validation.data.description || null;
    if ('recipe' in validation.data) updateData.recipe = validation.data.recipe || null;
    if ('recipeUrl' in validation.data) updateData.recipeUrl = validation.data.recipeUrl || null;
    if ('prepTime' in validation.data) updateData.prepTime = validation.data.prepTime || null;
    if ('cookTime' in validation.data) updateData.cookTime = validation.data.cookTime || null;
    if ('servings' in validation.data) updateData.servings = validation.data.servings || null;
    if ('ingredients' in validation.data) updateData.ingredients = validation.data.ingredients || null;
    if ('dayOfWeek' in validation.data) updateData.dayOfWeek = validation.data.dayOfWeek;
    if ('mealType' in validation.data) updateData.mealType = validation.data.mealType;
    if ('weekOf' in validation.data) updateData.weekOf = validation.data.weekOf;
    if ('source' in validation.data) updateData.source = validation.data.source;
    if ('sourceId' in validation.data) updateData.sourceId = validation.data.sourceId || null;

    // Handle cookedBy status - when set, automatically set cookedAt
    if ('cookedBy' in validation.data) {
      updateData.cookedBy = validation.data.cookedBy || null;
      updateData.cookedAt = validation.data.cookedBy ? new Date() : null;
    }

    // Execute update
    await db
      .update(meals)
      .set(updateData)
      .where(eq(meals.id, id));

    // Fetch and return updated meal
    const [updatedMealWithUser] = await db
      .select({
        id: meals.id,
        name: meals.name,
        description: meals.description,
        recipe: meals.recipe,
        recipeUrl: meals.recipeUrl,
        prepTime: meals.prepTime,
        cookTime: meals.cookTime,
        servings: meals.servings,
        ingredients: meals.ingredients,
        dayOfWeek: meals.dayOfWeek,
        mealType: meals.mealType,
        cookedAt: meals.cookedAt,
        cookedBy: meals.cookedBy,
        weekOf: meals.weekOf,
        source: meals.source,
        sourceId: meals.sourceId,
        createdAt: meals.createdAt,
        updatedAt: meals.updatedAt,
        createdById: users.id,
        createdByName: users.name,
        createdByColor: users.color,
      })
      .from(meals)
      .leftJoin(users, eq(meals.createdBy, users.id))
      .where(eq(meals.id, id));

    if (!updatedMealWithUser) {
      return NextResponse.json(
        { error: 'Meal not found after update' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: updatedMealWithUser.id,
      name: updatedMealWithUser.name,
      description: updatedMealWithUser.description,
      recipe: updatedMealWithUser.recipe,
      recipeUrl: updatedMealWithUser.recipeUrl,
      prepTime: updatedMealWithUser.prepTime,
      cookTime: updatedMealWithUser.cookTime,
      servings: updatedMealWithUser.servings,
      ingredients: updatedMealWithUser.ingredients,
      dayOfWeek: updatedMealWithUser.dayOfWeek,
      mealType: updatedMealWithUser.mealType,
      cookedAt: updatedMealWithUser.cookedAt?.toISOString() || null,
      cookedBy: updatedMealWithUser.cookedBy,
      weekOf: updatedMealWithUser.weekOf,
      source: updatedMealWithUser.source,
      sourceId: updatedMealWithUser.sourceId,
      createdAt: updatedMealWithUser.createdAt.toISOString(),
      updatedAt: updatedMealWithUser.updatedAt.toISOString(),
      createdBy: updatedMealWithUser.createdById ? {
        id: updatedMealWithUser.createdById,
        name: updatedMealWithUser.createdByName,
        color: updatedMealWithUser.createdByColor,
      } : null,
    });
  } catch (error) {
    console.error('Error updating meal:', error);
    return NextResponse.json(
      { error: 'Failed to update meal' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/meals/[id]
 * ============================================================================
 * Deletes a specific meal.
 * ============================================================================
 */
export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = await params;

    // Check if meal exists
    const [existingMeal] = await db
      .select({ id: meals.id, name: meals.name })
      .from(meals)
      .where(eq(meals.id, id));

    if (!existingMeal) {
      return NextResponse.json(
        { error: 'Meal not found' },
        { status: 404 }
      );
    }

    // Delete the meal
    await db
      .delete(meals)
      .where(eq(meals.id, id));

    return NextResponse.json({
      message: 'Meal deleted successfully',
      deletedMeal: {
        id: existingMeal.id,
        name: existingMeal.name,
      },
    });
  } catch (error) {
    console.error('Error deleting meal:', error);
    return NextResponse.json(
      { error: 'Failed to delete meal' },
      { status: 500 }
    );
  }
}
