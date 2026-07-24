import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { assertSafePathId } from '@/lib/utils/safePathId';

const RECIPE_IMAGES_DIR = path.join(process.cwd(), 'data', 'recipe-images');
const MAX_WIDTH = 1200;

async function ensureDir() {
  await fs.mkdir(RECIPE_IMAGES_DIR, { recursive: true });
}

export async function saveRecipeImage(buffer: Buffer, recipeId: string): Promise<string> {
  assertSafePathId(recipeId);
  await ensureDir();

  const filename = `${recipeId}.jpg`;
  const filePath = path.join(RECIPE_IMAGES_DIR, filename);

  await sharp(buffer)
    .rotate()
    .resize(MAX_WIDTH, undefined, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toFile(filePath);

  return filename;
}

export async function deleteRecipeImage(recipeId: string): Promise<void> {
  assertSafePathId(recipeId);
  const filePath = path.join(RECIPE_IMAGES_DIR, `${recipeId}.jpg`);
  try {
    await fs.unlink(filePath);
  } catch {
    // File may not exist
  }
}

export function getRecipeImagePath(recipeId: string): string {
  assertSafePathId(recipeId);
  return path.join(RECIPE_IMAGES_DIR, `${recipeId}.jpg`);
}
