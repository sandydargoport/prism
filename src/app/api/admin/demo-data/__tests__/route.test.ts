/**
 * Purging the init seed's demo data (#605) is parents only. What counts as
 * demo data is SQL against real tables, so it is exercised on a database
 * rather than here; this pins the gate and the response shapes.
 */
const mockRequireAuth = jest.fn();
const mockFind = jest.fn();
const mockPurge = jest.fn();

jest.mock('@/lib/auth', () => ({
  requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
  requireRole: jest.requireActual('@/lib/auth/requireAuth').requireRole,
}));
jest.mock('@/lib/services/demoData', () => ({
  findDemoData: (...a: unknown[]) => mockFind(...a),
  purgeDemoData: (...a: unknown[]) => mockPurge(...a),
}));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET, DELETE } from '../route';

beforeEach(() => {
  jest.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ userId: 'p1', role: 'parent' });
  mockFind.mockResolvedValue({ present: true, members: ['Alex'], counts: { users: 1 }, connected: { calendars: 0, events: 0 } });
  mockPurge.mockResolvedValue({ users: 1, tasks: 6 });
});

it('reports what a purge would delete', async () => {
  const res = await GET();
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ present: true, members: ['Alex'] });
});

it('purges and returns the rows deleted', async () => {
  const res = await DELETE();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ deleted: { users: 1, tasks: 6 } });
});

it.each(['child', 'guest'])('refuses a %s', async (role) => {
  mockRequireAuth.mockResolvedValue({ userId: 'k1', role });
  expect((await GET()).status).toBe(403);
  expect((await DELETE()).status).toBe(403);
  expect(mockPurge).not.toHaveBeenCalled();
});

it('answers 500 when the purge fails', async () => {
  mockPurge.mockRejectedValue(new Error('db down'));
  expect((await DELETE()).status).toBe(500);
});
