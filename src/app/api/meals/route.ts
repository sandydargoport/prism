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
import { db } from '@/lib/db/client';
import { meals, users } from '@/lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { createMealSchema, validateRequest } from '@/lib/validations';

/**
 * GET /api/meals
 * ============================================================================
 * Lists meals with optional filtering by week.
 * ============================================================================
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekOf = searchParams.get('weekOf');

    // Build query
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
      })
      .from(meals)
      .leftJoin(users, eq(meals.createdBy, users.id))
      .orderBy(asc(meals.weekOf), asc(meals.dayOfWeek), asc(meals.name));

    // Apply filters
    const conditions = [];
    if (weekOf) {
      conditions.push(eq(meals.weekOf, weekOf));
    }

    const results = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    // Format response
    const formattedMeals = results.map(meal => ({
      id: meal.id,
      name: meal.name,
      description: meal.description,
      recipe: meal.recipe,
      recipeUrl: meal.recipeUrl,
      prepTime: meal.prepTime,
      cookTime: meal.cookTime,
      servings: meal.servings,
      ingredients: meal.ingredients,
      dayOfWeek: meal.dayOfWeek,
      mealType: meal.mealType,
      cookedAt: meal.cookedAt?.toISOString() || null,
      cookedBy: meal.cookedById,
      weekOf: meal.weekOf,
      source: meal.source,
      sourceId: meal.sourceId,
      createdAt: meal.createdAt.toISOString(),
      createdBy: meal.createdById ? {
        id: meal.createdById,
        name: meal.createdByName,
        color: meal.createdByColor,
      } : null,
    }));

    return NextResponse.json({ meals: formattedMeals });
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
    return NextResponse.json(
      { error: 'Failed to create meal' },
      { status: 500 }
    );
  }
}
