import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';

const AVATARS_DIR = path.join(process.cwd(), 'data', 'avatars');
const AVATAR_SIZE = 256;

async function ensureDir() {
  await fs.mkdir(AVATARS_DIR, { recursive: true });
}

export async function saveAvatar(buffer: Buffer, userId: string): Promise<string> {
  await ensureDir();

  const filename = `${userId}.jpg`;
  const filePath = path.join(AVATARS_DIR, filename);

  await sharp(buffer)
    .rotate()
    .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover' })
    .jpeg({ quality: 85 })
    .toFile(filePath);

  return filename;
}

export async function deleteAvatar(userId: string): Promise<void> {
  const filePath = path.join(AVATARS_DIR, `${userId}.jpg`);
  try {
    await fs.unlink(filePath);
  } catch {
    // File may not exist
  }
}

export function getAvatarPath(userId: string): string {
  return path.join(AVATARS_DIR, `${userId}.jpg`);
}
