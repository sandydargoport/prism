import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { recipes, users } from '@/lib/db/schema';
import { eq, desc, ilike, or, sql } from 'drizzle-orm';
import { requireAuth, requireRole, getDisplayAuth } from '@/lib/auth';
import { invalidateCache, getCached } from '@/lib/cache/redis';

async function fetchRecipes(
  search: string | null,
  category: string | null,
  cuisine: string | null,
  favorite: string | null,
  limit: number,
  offset: number
) {
  let query = db
    .select({
      id: recipes.id,
      name: recipes.name,
      description: recipes.description,
      url: recipes.url,
      sourceType: recipes.sourceType,
      ingredients: recipes.ingredients,
      instructions: recipes.instructions,
      notes: recipes.notes,
      prepTime: recipes.prepTime,
      cookTime: recipes.cookTime,
      servings: recipes.servings,
      tags: recipes.tags,
      cuisine: recipes.cuisine,
      category: recipes.category,
      imageUrl: recipes.imageUrl,
      rating: recipes.rating,
      timesMade: recipes.timesMade,
      lastMadeAt: recipes.lastMadeAt,
      isFavorite: recipes.isFavorite,
      createdBy: recipes.createdBy,
      createdByName: users.name,
      createdAt: recipes.createdAt,
      updatedAt: recipes.updatedAt,
    })
    .from(recipes)
    .leftJoin(users, eq(recipes.createdBy, users.id))
    .orderBy(desc(recipes.updatedAt))
    .limit(limit)
    .offset(offset);

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(recipes.name, `%${search}%`),
        ilike(recipes.description, `%${search}%`)
      )
    );
  }

  if (category) {
    conditions.push(eq(recipes.category, category));
  }

  if (cuisine) {
    conditions.push(eq(recipes.cuisine, cuisine));
  }

  if (favorite === 'true') {
    conditions.push(eq(recipes.isFavorite, true));
  }

  if (conditions.length > 0) {
    for (const condition of conditions) {
      if (condition) {
        query = query.where(condition) as typeof query;
      }
    }
  }

  const recipeList = await query;

  // Get total count for pagination
  const countResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(recipes);
  const totalCount = countResult[0]?.count ?? 0;

  return {
    recipes: recipeList,
    total: totalCount,
    limit,
    offset,
  };
}

export async function GET(request: NextRequest) {
  const auth = await getDisplayAuth();
  if (!auth) {
    return NextResponse.json({ recipes: [], total: 0 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const cuisine = searchParams.get('cuisine');
    const favorite = searchParams.get('favorite');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Only cache if no search/filters
    if (!search && !category && !cuisine && !favorite) {
      const cacheKey = `recipes:default:${limit}:${offset}`;
      const result = await getCached(
        cacheKey,
        () => fetchRecipes(search, category, cuisine, favorite, limit, offset),
        300
      );
      return NextResponse.json(result);
    }

    // With filters, don't cache
    const result = await fetchRecipes(search, category, cuisine, favorite, limit, offset);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageRecipes');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Recipe name is required' },
        { status: 400 }
      );
    }

    const [newRecipe] = await db
      .insert(recipes)
      .values({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        url: body.url?.trim() || null,
        sourceType: body.sourceType || 'manual',
        ingredients: body.ingredients || [],
        instructions: body.instructions?.trim() || null,
        prepTime: body.prepTime || null,
        cookTime: body.cookTime || null,
        servings: body.servings || null,
        tags: body.tags || [],
        cuisine: body.cuisine?.trim() || null,
        category: body.category?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        rating: body.rating || null,
        notes: body.notes?.trim() || null,
        isFavorite: body.isFavorite || false,
        createdBy: auth.userId,
      })
      .returning();

    await invalidateCache('recipes:*');

    return NextResponse.json(newRecipe, { status: 201 });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return NextResponse.json(
      { error: 'Failed to create recipe' },
      { status: 500 }
    );
  }
}
