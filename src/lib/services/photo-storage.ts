import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const PHOTOS_DIR = path.join(process.cwd(), 'data', 'photos');
const ORIGINALS_DIR = path.join(PHOTOS_DIR, 'originals');
const THUMBS_DIR = path.join(PHOTOS_DIR, 'thumbs');

const MAX_WIDTH = 1920;
const THUMB_WIDTH = 400;

async function ensureDirs() {
  await fs.mkdir(ORIGINALS_DIR, { recursive: true });
  await fs.mkdir(THUMBS_DIR, { recursive: true });
}

export async function savePhoto(
  buffer: Buffer,
  filename: string
): Promise<{ width: number; height: number; sizeBytes: number; thumbnailPath: string }> {
  await ensureDirs();

  // rotate() with no args auto-orients based on EXIF data
  const image = sharp(buffer).rotate();
  const metadata = await image.metadata();

  // Resize original to max dimension, preserving aspect ratio
  const resized = metadata.width && metadata.width > MAX_WIDTH
    ? image.resize(MAX_WIDTH, undefined, { withoutEnlargement: true })
    : image;

  const originalPath = path.join(ORIGINALS_DIR, filename);
  const outputInfo = await resized.toFile(originalPath);

  // Generate thumbnail with auto-rotation
  const thumbFilename = `thumb_${filename}`;
  const thumbPath = path.join(THUMBS_DIR, thumbFilename);
  await sharp(buffer)
    .rotate()
    .resize(THUMB_WIDTH, undefined, { withoutEnlargement: true })
    .toFile(thumbPath);

  return {
    width: outputInfo.width,
    height: outputInfo.height,
    sizeBytes: outputInfo.size,
    thumbnailPath: thumbFilename,
  };
}

export async function deletePhoto(filename: string, thumbFilename?: string | null) {
  const originalPath = path.join(ORIGINALS_DIR, filename);
  try {
    await fs.unlink(originalPath);
  } catch {
    // File may not exist
  }
  if (thumbFilename) {
    const thumbPath = path.join(THUMBS_DIR, thumbFilename);
    try {
      await fs.unlink(thumbPath);
    } catch {
      // File may not exist
    }
  }
}

export function getPhotoPath(filename: string, thumb = false): string {
  return thumb
    ? path.join(THUMBS_DIR, filename)
    : path.join(ORIGINALS_DIR, filename);
}
