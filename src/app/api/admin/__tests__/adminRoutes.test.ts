/**
 * Route-level authorization tests for the destructive admin surface.
 *
 * Covers (audit 2026-07 · M-TEST #65):
 * - POST /api/admin/database (truncate/seed)
 * - GET/POST /api/admin/backups
 * - GET/POST/DELETE /api/admin/backups/[filename]
 *
 * Asserts the `canModifySettings` gate returns 401 (unauthenticated) / 403
 * (authenticated without the permission) BEFORE any destructive operation
 * runs, and that the [filename] handlers forward the raw param straight to
 * the guarded backup util (so a traversal id is rejected as 404 / error).
 * The guard itself is unit-tested in
 * src/lib/utils/__tests__/backupTraversal.test.ts.
 */

import { NextRequest, NextResponse } from 'next/server';

// --- Auth mock ---
const mockRequireAuth = jest.fn();
const mockRequireRole = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: (...a: unknown[]) => mockRequireRole(...a),
}));

// --- Backup util mock (destructive ops stubbed; guard tested separately) ---
const mockTruncate = jest.fn();
const mockSeed = jest.fn();
const mockListBackups = jest.fn();
const mockCreateBackup = jest.fn();
const mockGetBackupPath = jest.fn();
const mockRestoreBackup = jest.fn();
const mockDeleteBackup = jest.fn();

jest.mock('@/lib/utils/backup', () => ({
  truncateAllData: (...a: unknown[]) => mockTruncate(...a),
  seedDatabase: (...a: unknown[]) => mockSeed(...a),
  listBackups: (...a: unknown[]) => mockListBackups(...a),
  createBackup: (...a: unknown[]) => mockCreateBackup(...a),
  getBackupPath: (...a: unknown[]) => mockGetBackupPath(...a),
  restoreBackup: (...a: unknown[]) => mockRestoreBackup(...a),
  deleteBackup: (...a: unknown[]) => mockDeleteBackup(...a),
}));

// --- Other mocks ---
const mockInvalidateCache = jest.fn();
const mockRateLimitGuard = jest.fn();

jest.mock('@/lib/cache/redis', () => ({
  invalidateCache: (...a: unknown[]) => mockInvalidateCache(...a),
}));
jest.mock('@/lib/cache/rateLimit', () => ({
  rateLimitGuard: (...a: unknown[]) => mockRateLimitGuard(...a),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { POST as dbPOST } from '../database/route';
import { GET as backupsGET, POST as backupsPOST } from '../backups/route';
import {
  GET as fileGET,
  POST as filePOST,
  DELETE as fileDELETE,
} from '../backups/[filename]/route';

const parentAuth = { userId: 'parent-1', role: 'parent' };

/** requireAuth's "not authenticated" return: a 401 NextResponse. */
function unauthResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
/** requireRole's "forbidden" return: a 403 NextResponse. */
function forbiddenResponse() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

function dbRequest(body: object) {
  return new NextRequest('http://localhost:3000/api/admin/database', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

/** [filename] handlers receive params as a Promise. */
function fileCtx(filename: string) {
  return { params: Promise.resolve({ filename }) };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: authenticated parent with canModifySettings.
  mockRequireAuth.mockResolvedValue(parentAuth);
  mockRequireRole.mockReturnValue(null);
  mockInvalidateCache.mockResolvedValue(undefined);
  mockRateLimitGuard.mockResolvedValue(null);
});

describe('POST /api/admin/database — canModifySettings gate', () => {
  it('returns 401 and never touches the database when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(unauthResponse());
    const res = await dbPOST(dbRequest({ action: 'truncate' }));
    expect(res.status).toBe(401);
    expect(mockTruncate).not.toHaveBeenCalled();
    expect(mockSeed).not.toHaveBeenCalled();
  });

  it('returns 403 and never touches the database without canModifySettings', async () => {
    mockRequireRole.mockReturnValue(forbiddenResponse());
    const res = await dbPOST(dbRequest({ action: 'truncate' }));
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith(parentAuth, 'canModifySettings');
    expect(mockTruncate).not.toHaveBeenCalled();
    expect(mockSeed).not.toHaveBeenCalled();
  });

  it('truncates for an authorized parent and invalidates cache', async () => {
    mockTruncate.mockResolvedValue({ success: true });
    const res = await dbPOST(dbRequest({ action: 'truncate' }));
    expect(res.status).toBe(200);
    expect(mockTruncate).toHaveBeenCalledTimes(1);
    expect(mockInvalidateCache).toHaveBeenCalledWith('*');
  });

  it('seeds for an authorized parent', async () => {
    mockSeed.mockResolvedValue({ success: true });
    const res = await dbPOST(dbRequest({ action: 'seed' }));
    expect(res.status).toBe(200);
    expect(mockSeed).toHaveBeenCalledTimes(1);
  });

  it('returns 400 for an unknown action', async () => {
    const res = await dbPOST(dbRequest({ action: 'drop-everything' }));
    expect(res.status).toBe(400);
    expect(mockTruncate).not.toHaveBeenCalled();
    expect(mockSeed).not.toHaveBeenCalled();
  });
});

describe('GET/POST /api/admin/backups — canModifySettings gate', () => {
  it('GET returns 401 when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(unauthResponse());
    const res = await backupsGET();
    expect(res.status).toBe(401);
    expect(mockListBackups).not.toHaveBeenCalled();
  });

  it('GET returns 403 without canModifySettings', async () => {
    mockRequireRole.mockReturnValue(forbiddenResponse());
    const res = await backupsGET();
    expect(res.status).toBe(403);
    expect(mockListBackups).not.toHaveBeenCalled();
  });

  it('GET lists backups for an authorized parent', async () => {
    mockListBackups.mockResolvedValue([{ filename: 'prism_2026.sql.gz' }]);
    const res = await backupsGET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.backups).toHaveLength(1);
  });

  it('POST returns 401 and never creates a backup when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(unauthResponse());
    const res = await backupsPOST();
    expect(res.status).toBe(401);
    expect(mockCreateBackup).not.toHaveBeenCalled();
  });

  it('POST returns 403 and never creates a backup without canModifySettings', async () => {
    mockRequireRole.mockReturnValue(forbiddenResponse());
    const res = await backupsPOST();
    expect(res.status).toBe(403);
    expect(mockCreateBackup).not.toHaveBeenCalled();
  });

  it('POST creates a backup for an authorized parent', async () => {
    mockCreateBackup.mockResolvedValue({ success: true, filename: 'prism_new.sql.gz' });
    const res = await backupsPOST();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filename).toBe('prism_new.sql.gz');
  });
});

describe('GET/POST/DELETE /api/admin/backups/[filename] — gate + traversal delegation', () => {
  it('GET returns 401 and never resolves a path when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(unauthResponse());
    const res = await fileGET(new NextRequest('http://localhost/x'), fileCtx('prism.sql.gz'));
    expect(res.status).toBe(401);
    expect(mockGetBackupPath).not.toHaveBeenCalled();
  });

  it('GET returns 403 and never resolves a path without canModifySettings', async () => {
    mockRequireRole.mockReturnValue(forbiddenResponse());
    const res = await fileGET(new NextRequest('http://localhost/x'), fileCtx('prism.sql.gz'));
    expect(res.status).toBe(403);
    expect(mockGetBackupPath).not.toHaveBeenCalled();
  });

  it('GET forwards a traversal filename to the guard and 404s when rejected', async () => {
    // The guard (getBackupPath) returns null for `..`/`/` — see backupTraversal.test.ts.
    mockGetBackupPath.mockResolvedValue(null);
    const res = await fileGET(
      new NextRequest('http://localhost/x'),
      fileCtx('../../etc/passwd')
    );
    expect(mockGetBackupPath).toHaveBeenCalledWith('../../etc/passwd');
    expect(res.status).toBe(404);
  });

  it('POST (restore) returns 403 and never restores without canModifySettings', async () => {
    mockRequireRole.mockReturnValue(forbiddenResponse());
    const res = await filePOST(new NextRequest('http://localhost/x'), fileCtx('prism.sql.gz'));
    expect(res.status).toBe(403);
    expect(mockRestoreBackup).not.toHaveBeenCalled();
  });

  it('POST (restore) forwards a traversal filename to the guard, which rejects it', async () => {
    mockRestoreBackup.mockResolvedValue({ success: false, error: 'Invalid filename' });
    const res = await filePOST(
      new NextRequest('http://localhost/x'),
      fileCtx('../../etc/passwd')
    );
    expect(mockRestoreBackup).toHaveBeenCalledWith('../../etc/passwd');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Invalid filename');
  });

  it('DELETE returns 401 and never deletes when unauthenticated', async () => {
    mockRequireAuth.mockResolvedValue(unauthResponse());
    const res = await fileDELETE(new NextRequest('http://localhost/x'), fileCtx('prism.sql.gz'));
    expect(res.status).toBe(401);
    expect(mockDeleteBackup).not.toHaveBeenCalled();
  });

  it('DELETE returns 403 and never deletes without canModifySettings', async () => {
    mockRequireRole.mockReturnValue(forbiddenResponse());
    const res = await fileDELETE(new NextRequest('http://localhost/x'), fileCtx('prism.sql.gz'));
    expect(res.status).toBe(403);
    expect(mockDeleteBackup).not.toHaveBeenCalled();
  });

  it('DELETE forwards a traversal filename to the guard, which rejects it', async () => {
    mockDeleteBackup.mockResolvedValue({ success: false, error: 'Invalid filename' });
    const res = await fileDELETE(
      new NextRequest('http://localhost/x'),
      fileCtx('..%2f..%2fetc')
    );
    expect(mockDeleteBackup).toHaveBeenCalledWith('..%2f..%2fetc');
    expect(res.status).toBe(500);
  });
});
