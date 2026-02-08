/**
 * ============================================================================
 * PRISM - Meals API Route
 * ============================================================================
 *
 * ENDPOINT: /api/meals
 * - GET:  List meals (filtered by week)
 * - POST: Create a new meal
 *
 * QUERY PARAMETERS (GET):
 * - weekOf: Filter by week start date (YYYY-MM-DD format)
 *
 * EXAMPLE:
 * GET /api/meals?weekOf=2024-01-28
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { meals, users } from '@/lib/db/schema';
import { eq, and, asc, aliasedTable } from 'drizzle-orm';
import { createMealSchema, validateRequest } from '@/lib/validations';
import { formatMealRow } from '@/lib/utils/formatters';
import { getCached, invalidateCache } from '@/lib/cache/redis';

const cookedByUser = aliasedTable(users, 'cookedByUser');

/**
 * GET /api/meals
 * ============================================================================
 * Lists meals with optional filtering by week.
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ meals: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const weekOf = searchParams.get('weekOf');

    const cacheKey = `meals:${weekOf || 'all'}`;

    const data = await getCached(cacheKey, async () => {
      const query = db
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
          cookedById: meals.cookedBy,
          weekOf: meals.weekOf,
          source: meals.source,
          sourceId: meals.sourceId,
          createdAt: meals.createdAt,
          createdById: users.id,
          createdByName: users.name,
          createdByColor: users.color,
          cookedByUserId: cookedByUser.id,
          cookedByUserName: cookedByUser.name,
          cookedByUserColor: cookedByUser.color,
        })
        .from(meals)
        .leftJoin(users, eq(meals.createdBy, users.id))
        .leftJoin(cookedByUser, eq(meals.cookedBy, cookedByUser.id))
        .orderBy(asc(meals.weekOf), asc(meals.dayOfWeek), asc(meals.name));

      const conditions = [];
      if (weekOf) {
        conditions.push(eq(meals.weekOf, weekOf));
      }

      const results = conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

      const formattedMeals = results.map(meal => formatMealRow(meal));
      return { meals: formattedMeals };
    }, 300);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching meals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meals
 * ============================================================================
 * Creates a new meal.
 *
 * REQUEST BODY:
 * {
 *   name: string (required, e.g., "Spaghetti Bolognese")
 *   dayOfWeek?: number (0-6, 0=Sunday, optional)
 *   recipeUrl?: string
 *   notes?: string
 *   weekOf: string (required, YYYY-MM-DD format)
 *   createdBy?: string (user UUID)
 * }
 * ============================================================================
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(createMealSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const {
      name,
      description,
      recipe,
      recipeUrl,
      recipeId,
      prepTime,
      cookTime,
      servings,
      ingredients,
      dayOfWeek,
      mealType,
      weekOf,
      source,
      sourceId,
      createdBy,
    } = validation.data;

    // Insert the meal
    const [newMeal] = await db
      .insert(meals)
      .values({
        name,
        description: description || null,
        recipe: recipe || null,
        recipeUrl: recipeUrl || null,
        recipeId: recipeId || null,
        prepTime: prepTime || null,
        cookTime: cookTime || null,
        servings: servings || null,
        ingredients: ingredients || null,
        dayOfWeek,
        mealType,
        weekOf,
        source: source || 'internal',
        sourceId: sourceId || null,
        createdBy: createdBy || null,
      })
      .returning();

    if (!newMeal) {
      return NextResponse.json(
        { error: 'Failed to create meal' },
        { status: 500 }
      );
    }

    await invalidateCache('meals:*');

    return NextResponse.json({
      id: newMeal.id,
      name: newMeal.name,
      description: newMeal.description,
      recipe: newMeal.recipe,
      recipeUrl: newMeal.recipeUrl,
      prepTime: newMeal.prepTime,
      cookTime: newMeal.cookTime,
      servings: newMeal.servings,
      ingredients: newMeal.ingredients,
      dayOfWeek: newMeal.dayOfWeek,
      mealType: newMeal.mealType,
      cookedAt: newMeal.cookedAt?.toISOString() || null,
      cookedBy: newMeal.cookedBy,
      weekOf: newMeal.weekOf,
      source: newMeal.source,
      sourceId: newMeal.sourceId,
      createdAt: newMeal.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating meal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create meal: ${errorMessage}` },
      { status: 500 }
    );
  }
}
