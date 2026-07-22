/**
 * Path-traversal guard tests for the backup util (audit 2026-07 · M-TEST #65).
 *
 * getBackupPath / restoreBackup / deleteBackup each reject any filename
 * containing `..` or `/` before touching the filesystem or shelling out.
 * These are the guards the /api/admin/backups/[filename] routes delegate to
 * (see adminRoutes.test.ts for the route-level wiring).
 */

import fs from 'fs/promises';
import { getBackupPath, restoreBackup, deleteBackup } from '../backup';

// Spies prove the guard short-circuits before any filesystem access.
let accessSpy: jest.SpyInstance;
let readFileSpy: jest.SpyInstance;
let unlinkSpy: jest.SpyInstance;

beforeEach(() => {
  accessSpy = jest.spyOn(fs, 'access').mockResolvedValue(undefined);
  readFileSpy = jest.spyOn(fs, 'readFile').mockResolvedValue(Buffer.from(''));
  unlinkSpy = jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Inputs that must be rejected. Absolute paths and encoded-slash-looking
// payloads are covered by the literal `/` check.
const TRAVERSAL_INPUTS = [
  '../secret.sql.gz',
  '..',
  '../../etc/passwd',
  'nested/../../etc/passwd',
  'sub/dir.sql.gz',
  '/etc/passwd',
  '/app/backups/../../etc/passwd',
];

describe('getBackupPath', () => {
  it.each(TRAVERSAL_INPUTS)('returns null and touches no fs for %p', async (input) => {
    await expect(getBackupPath(input)).resolves.toBeNull();
    expect(accessSpy).not.toHaveBeenCalled();
  });
});

describe('restoreBackup', () => {
  it.each(TRAVERSAL_INPUTS)('rejects %p without shelling out', async (input) => {
    const result = await restoreBackup(input);
    expect(result).toEqual({ success: false, error: 'Invalid filename' });
    expect(accessSpy).not.toHaveBeenCalled();
    expect(readFileSpy).not.toHaveBeenCalled();
  });
});

describe('deleteBackup', () => {
  it.each(TRAVERSAL_INPUTS)('rejects %p without unlinking', async (input) => {
    const result = await deleteBackup(input);
    expect(result).toEqual({ success: false, error: 'Invalid filename' });
    expect(unlinkSpy).not.toHaveBeenCalled();
  });
});
