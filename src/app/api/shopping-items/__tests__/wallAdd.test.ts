/**
 * @jest-environment node
 */
/**
 * #1222: with the PIN off, the wall adds an item and nothing more. Who added
 * it, notes and repeats are for a signed-in person; the category, quantity
 * and unit the wall's add asks for are kept.
 */
import { NextRequest } from 'next/server';

let mockAuth: Record<string, unknown> = {};
const mockValues = jest.fn();

jest.mock('@/lib/auth', () => ({ requireAuth: async () => mockAuth }));
jest.mock('@/lib/auth/everydayAuth', () => ({ requireEverydayAuth: async () => mockAuth, logWallChange: jest.fn() }));
jest.mock('@/lib/db/client', () => ({
  db: {
    insert: () => ({ values: (v: Record<string, unknown>) => { mockValues(v); return { returning: async () => [{ id: 'item-1', checked: false, createdAt: new Date(), ...v }] }; } }),
  },
}));
jest.mock('@/lib/db/schema', () => ({ shoppingItems: {}, users: {} }));
jest.mock('drizzle-orm', () => ({ eq: jest.fn(), and: jest.fn(), asc: jest.fn() }));
jest.mock('@/lib/validations', () => ({
  createShoppingItemSchema: {},
  validateRequest: (_s: unknown, data: unknown) => ({ success: true, data }),
}));
jest.mock('@/lib/cache/cacheKeys', () => ({ invalidateEntity: jest.fn() }));
jest.mock('@/lib/cache/rateLimit', () => ({ rateLimitGuard: async () => null }));
jest.mock('@/lib/services/auditLog', () => ({ logActivity: jest.fn() }));
jest.mock('@/lib/utils/formatters', () => ({ formatShoppingItemRow: (r: unknown) => r }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { POST } from '../route';

const everything = {
  listId: 'list-1', name: 'Milk', quantity: 2, unit: 'l', category: 'dairy',
  recurring: true, recurrenceInterval: 'weekly', addedBy: 'parent-1', notes: 'the good one',
};
const add = () => POST(new NextRequest('http://prism.test/api/shopping-items', {
  method: 'POST', body: JSON.stringify(everything), headers: { 'Content-Type': 'application/json' },
}));

beforeEach(() => mockValues.mockClear());

it('keeps only the item, its amount and category when the wall adds it', async () => {
  mockAuth = { userId: 'display-1', role: 'guest', wall: true };
  expect((await add()).status).toBe(201);
  expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
    name: 'Milk', quantity: 2, unit: 'l', category: 'dairy',
    recurring: false, recurrenceInterval: null, addedBy: null, notes: null,
  }));
});

it('keeps everything for a signed-in person', async () => {
  mockAuth = { userId: 'parent-1', role: 'parent' };
  expect((await add()).status).toBe(201);
  expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({
    recurring: true, recurrenceInterval: 'weekly', addedBy: 'parent-1', notes: 'the good one',
  }));
});
