import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { recipes } from '@/lib/db/schema';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';
import { parsePaprikaHtml } from '@/lib/utils/paprikaParser';

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageRecipes');
  if (forbidden) return forbidden;

  try {
    const body = await request.json();

    if (!body.html || typeof body.html !== 'string') {
      return NextResponse.json(
        { error: 'HTML content is required' },
        { status: 400 }
      );
    }

    // Parse recipes from HTML
    const parsedRecipes = parsePaprikaHtml(body.html);

    if (parsedRecipes.length === 0) {
      return NextResponse.json(
        { error: 'No recipes found in the HTML content' },
        { status: 422 }
      );
    }

    // Option to just preview without saving
    if (body.preview) {
      return NextResponse.json({
        preview: true,
        count: parsedRecipes.length,
        recipes: parsedRecipes,
      });
    }

    // Save all recipes to database
    const insertedRecipes = await db
      .insert(recipes)
      .values(
        parsedRecipes.map(recipe => ({
          name: recipe.name,
          description: recipe.description || null,
          url: recipe.sourceUrl || null,
          sourceType: 'paprika_import' as const,
          ingredients: recipe.ingredients,
          instructions: recipe.instructions || null,
          prepTime: recipe.prepTime || null,
          cookTime: recipe.cookTime || null,
          servings: recipe.servings || null,
          cuisine: null,
          category: recipe.categories?.[0] || null,
          tags: recipe.categories || [],
          imageUrl: recipe.imageUrl || null,
          rating: recipe.rating || null,
          notes: recipe.notes || null,
          createdBy: auth.userId,
        }))
      )
      .returning();

    await invalidateCache('recipes:*');

    return NextResponse.json({
      imported: insertedRecipes.length,
      recipes: insertedRecipes,
    }, { status: 201 });
  } catch (error) {
    console.error('Error importing Paprika recipes:', error);
    return NextResponse.json(
      { error: 'Failed to import Paprika recipes' },
      { status: 500 }
    );
  }
}
