import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { recipes, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { requireAuth, requireRole } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache/redis';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [recipe] = await db
      .select({
        id: recipes.id,
        name: recipes.name,
        description: recipes.description,
        url: recipes.url,
        sourceType: recipes.sourceType,
        ingredients: recipes.ingredients,
        instructions: recipes.instructions,
        prepTime: recipes.prepTime,
        cookTime: recipes.cookTime,
        servings: recipes.servings,
        tags: recipes.tags,
        cuisine: recipes.cuisine,
        category: recipes.category,
        imageUrl: recipes.imageUrl,
        rating: recipes.rating,
        notes: recipes.notes,
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
      .where(eq(recipes.id, id));

    if (!recipe) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(recipe);
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recipe' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageRecipes');
  if (forbidden) return forbidden;

  try {
    const { id } = await params;
    const body = await request.json();

    const [existing] = await db
      .select()
      .from(recipes)
      .where(eq(recipes.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if ('name' in body) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: 'Name must be a non-empty string' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if ('description' in body) {
      updateData.description = body.description?.trim() || null;
    }

    if ('url' in body) {
      updateData.url = body.url?.trim() || null;
    }

    if ('ingredients' in body) {
      updateData.ingredients = body.ingredients || [];
    }

    if ('instructions' in body) {
      updateData.instructions = body.instructions?.trim() || null;
    }

    if ('prepTime' in body) {
      updateData.prepTime = body.prepTime || null;
    }

    if ('cookTime' in body) {
      updateData.cookTime = body.cookTime || null;
    }

    if ('servings' in body) {
      updateData.servings = body.servings || null;
    }

    if ('tags' in body) {
      updateData.tags = body.tags || [];
    }

    if ('cuisine' in body) {
      updateData.cuisine = body.cuisine?.trim() || null;
    }

    if ('category' in body) {
      updateData.category = body.category?.trim() || null;
    }

    if ('imageUrl' in body) {
      updateData.imageUrl = body.imageUrl?.trim() || null;
    }

    if ('rating' in body) {
      updateData.rating = body.rating || null;
    }

    if ('notes' in body) {
      updateData.notes = body.notes?.trim() || null;
    }

    if ('isFavorite' in body) {
      updateData.isFavorite = Boolean(body.isFavorite);
    }

    if ('timesMade' in body) {
      updateData.timesMade = body.timesMade || 0;
    }

    if ('lastMadeAt' in body) {
      updateData.lastMadeAt = body.lastMadeAt ? new Date(body.lastMadeAt) : null;
    }

    const [updated] = await db
      .update(recipes)
      .set(updateData)
      .where(eq(recipes.id, id))
      .returning();

    await invalidateCache('recipes:*');

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating recipe:', error);
    return NextResponse.json(
      { error: 'Failed to update recipe' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const [existing] = await db
      .select({ id: recipes.id, name: recipes.name, createdBy: recipes.createdBy })
      .from(recipes)
      .where(eq(recipes.id, id));

    if (!existing) {
      return NextResponse.json(
        { error: 'Recipe not found' },
        { status: 404 }
      );
    }

    // Only allow deletion if user created it or has parent permissions
    const isOwner = existing.createdBy === auth.userId;
    if (!isOwner) {
      const forbidden = requireRole(auth, 'canManageRecipes');
      if (forbidden && auth.role !== 'parent') {
        return NextResponse.json(
          { error: 'You can only delete recipes you created' },
          { status: 403 }
        );
      }
    }

    await db.delete(recipes).where(eq(recipes.id, id));

    await invalidateCache('recipes:*');

    return NextResponse.json({
      message: 'Recipe deleted successfully',
      deletedRecipe: { id: existing.id, name: existing.name },
    });
  } catch (error) {
    console.error('Error deleting recipe:', error);
    return NextResponse.json(
      { error: 'Failed to delete recipe' },
      { status: 500 }
    );
  }
}
