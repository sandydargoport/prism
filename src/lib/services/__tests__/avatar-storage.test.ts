/**
 * Tests for avatar-storage service.
 *
 * Mocks sharp (image processing) and fs to test
 * save, delete, and path generation.
 *
 * Ids are UUIDs (users.id); the storage layer rejects anything else to keep
 * a traversal payload out of the filesystem path (audit 2026-07 · M-PATH).
 */

const mockSharpInstance = {
  rotate: jest.fn().mockReturnThis(),
  resize: jest.fn().mockReturnThis(),
  jpeg: jest.fn().mockReturnThis(),
  toFile: jest.fn().mockResolvedValue(undefined),
};

jest.mock('sharp', () => jest.fn(() => mockSharpInstance));

const mockMkdir = jest.fn().mockResolvedValue(undefined);
const mockUnlink = jest.fn().mockResolvedValue(undefined);

jest.mock('fs', () => ({
  promises: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
  },
}));

import { saveAvatar, deleteAvatar, getAvatarPath } from '../avatar-storage';
import path from 'path';

const AVATARS_DIR = path.join(process.cwd(), 'data', 'avatars');
const UID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const UID2 = '11111111-2222-3333-4444-555555555555';

describe('saveAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates avatars directory, processes image, and returns filename', async () => {
    const buffer = Buffer.from('fake-image-data');
    const result = await saveAvatar(buffer, UID);

    expect(result).toBe(`${UID}.jpg`);
    expect(mockMkdir).toHaveBeenCalledWith(AVATARS_DIR, { recursive: true });
  });

  it('applies auto-rotate, resize to 256x256 cover, and JPEG quality 85', async () => {
    const buffer = Buffer.from('fake-image');
    await saveAvatar(buffer, UID);

    expect(mockSharpInstance.rotate).toHaveBeenCalled();
    expect(mockSharpInstance.resize).toHaveBeenCalledWith(256, 256, { fit: 'cover' });
    expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
    expect(mockSharpInstance.toFile).toHaveBeenCalledWith(
      path.join(AVATARS_DIR, `${UID}.jpg`)
    );
  });

  it('writes to correct path based on userId', async () => {
    await saveAvatar(Buffer.from('data'), UID2);

    expect(mockSharpInstance.toFile).toHaveBeenCalledWith(
      path.join(AVATARS_DIR, `${UID2}.jpg`)
    );
  });

  it('rejects a traversal id without touching sharp or the filesystem', async () => {
    await expect(saveAvatar(Buffer.from('data'), '../../etc/passwd')).rejects.toThrow(/Invalid id/);
    expect(mockMkdir).not.toHaveBeenCalled();
    expect(mockSharpInstance.toFile).not.toHaveBeenCalled();
  });
});

describe('deleteAvatar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unlinks the avatar file', async () => {
    await deleteAvatar(UID);

    expect(mockUnlink).toHaveBeenCalledWith(
      path.join(AVATARS_DIR, `${UID}.jpg`)
    );
  });

  it('does not throw when file does not exist', async () => {
    mockUnlink.mockRejectedValueOnce(new Error('ENOENT: no such file'));

    await expect(deleteAvatar(UID)).resolves.toBeUndefined();
  });

  it('rejects a traversal id without unlinking', async () => {
    await expect(deleteAvatar('../secret')).rejects.toThrow(/Invalid id/);
    expect(mockUnlink).not.toHaveBeenCalled();
  });
});

describe('getAvatarPath', () => {
  it('returns correct path for userId', () => {
    const result = getAvatarPath(UID);

    expect(result).toBe(path.join(AVATARS_DIR, `${UID}.jpg`));
  });

  it('throws on a non-UUID id', () => {
    expect(() => getAvatarPath('../../etc/passwd')).toThrow(/Invalid id/);
  });
});
