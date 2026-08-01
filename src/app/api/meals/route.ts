/**
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
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getDisplayAuth } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { meals, users } from '@/lib/db/schema';
import { eq, and, asc, gte, lte, aliasedTable } from 'drizzle-orm';
import { createMealSchema, validateRequest } from '@/lib/validations';
import { formatMealRow } from '@/lib/utils/formatters';
import { mealDate } from '@/lib/utils/mealDate';
import { getCached } from '@/lib/cache/redis';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { logActivity } from '@/lib/services/auditLog';
import { logError } from '@/lib/utils/logError';

const cookedByUser = aliasedTable(users, 'cookedByUser');

/**
 * GET /api/meals
 * Lists meals with optional filtering by week.
 */
export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ meals: [] });
  }

  try {
    const { searchParams } = new URL(request.url);
    const weekOf = searchParams.get('weekOf');
    // Preferred: an absolute date range [from, to] for the visible week. This
    // is stable across "week starts on" changes, unlike weekOf. weekOf is still
    // accepted for older callers.
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    const cacheKey = `meals:${from && to ? `${from}_${to}` : weekOf || 'all'}`;

    const data = await getCached(cacheKey, async () => {
      const query = db
        .select({
          id: meals.id,
          name: meals.name,
          description: meals.description,
          recipe: meals.recipe,
          recipeUrl: meals.recipeUrl,
          recipeId: meals.recipeId,
          prepTime: meals.prepTime,
          cookTime: meals.cookTime,
          servings: meals.servings,
          ingredients: meals.ingredients,
          dayOfWeek: meals.dayOfWeek,
          mealType: meals.mealType,
          mealTime: meals.mealTime,
          cookedAt: meals.cookedAt,
          cookedById: meals.cookedBy,
          weekOf: meals.weekOf,
          date: meals.date,
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
        .orderBy(asc(meals.date), asc(meals.name));

      const conditions = [];
      if (from && to) {
        conditions.push(gte(meals.date, from), lte(meals.date, to));
      } else if (weekOf) {
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
    logError('Error fetching meals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch meals' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/meals
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
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { rateLimitGuard } = await import('@/lib/cache/rateLimit');
  const limited = await rateLimitGuard(auth.userId, 'meals', 30, 60);
  if (limited) return limited;

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
      mealTime,
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
        mealTime: mealTime ?? null,
        weekOf,
        // Stable absolute date derived from (weekOf, dayOfWeek). The week views
        // query by this so a "week starts on" change re-windows instead of
        // orphaning the plan. See src/lib/utils/mealDate.ts + migration 0020.
        date: mealDate(weekOf, dayOfWeek),
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

    await invalidateEntity('meals');

    logActivity({
      userId: auth.userId,
      action: 'create',
      entityType: 'meal',
      entityId: newMeal.id,
      summary: `Added meal: ${newMeal.name} (${newMeal.dayOfWeek} ${newMeal.mealType})`,
    });

    // Note: Cannot use formatMealRow here because the insert().returning() result
    // lacks joined user fields (createdByName, createdByColor, cookedByUserName,
    // cookedByUserColor) that formatMealRow expects from the joined query in GET.
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
      mealTime: newMeal.mealTime,
      cookedAt: newMeal.cookedAt?.toISOString() || null,
      cookedBy: newMeal.cookedBy,
      weekOf: newMeal.weekOf,
      source: newMeal.source,
      sourceId: newMeal.sourceId,
      createdAt: newMeal.createdAt.toISOString(),
    }, { status: 201 });
  } catch (error) {
    logError('Error creating meal:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to create meal: ${errorMessage}` },
      { status: 500 }
    );
  }
}
