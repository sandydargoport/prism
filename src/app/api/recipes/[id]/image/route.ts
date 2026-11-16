import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { requireAuth, requireRole } from '@/lib/auth';
import { db } from '@/lib/db/client';
import { recipes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  saveRecipeImage,
  deleteRecipeImage,
  getRecipeImagePath,
} from '@/lib/services/recipe-image-storage';
import { invalidateEntity } from '@/lib/cache/cacheKeys';
import { validateMagicBytes } from '@/lib/utils/validateFileType';
import { rateLimitGuard } from '@/lib/cache/rateLimit';
import { logError } from '@/lib/utils/logError';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB — phone cameras shoot large
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageRecipes');
  if (forbidden) return forbidden;

  const { id } = await params;

  const limited = await rateLimitGuard(auth.userId, 'recipe-image-upload', 20, 60);
  if (limited) return limited;

  try {
    const [existing] = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(eq(recipes.id, id));
    if (!existing) {
      return NextResponse.json({ error: 'Recipe not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Use JPEG, PNG, or WebP.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 10MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const detectedType = validateMagicBytes(buffer, ALLOWED_TYPES);
    if (!detectedType) {
      return NextResponse.json(
        { error: 'File content does not match an allowed image type' },
        { status: 400 },
      );
    }

    await saveRecipeImage(buffer, id);

    // Cache-bust so the new image renders without a hard refresh.
    const imageUrl = `/api/recipes/${id}/image?v=${Date.now()}`;

    await db
      .update(recipes)
      .set({ imageUrl, updatedAt: new Date() })
      .where(eq(recipes.id, id));

    await invalidateEntity('recipes');

    return NextResponse.json({ imageUrl });
  } catch (error) {
    logError('Error uploading recipe image:', error);
    return NextResponse.json({ error: 'Failed to upload recipe image' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const filePath = getRecipeImagePath(id);

    const fileBuffer = await fs.readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=3600, must-revalidate',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Recipe image not found' }, { status: 404 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const forbidden = requireRole(auth, 'canManageRecipes');
  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    await deleteRecipeImage(id);

    await db
      .update(recipes)
      .set({ imageUrl: null, updatedAt: new Date() })
      .where(eq(recipes.id, id));

    await invalidateEntity('recipes');

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Error deleting recipe image:', error);
    return NextResponse.json({ error: 'Failed to delete recipe image' }, { status: 500 });
  }
}
