/**
 * @jest-environment node
 */

/**
 * GET /api/integrations/status (#809): the wall and children see whether each
 * account is connected, not its email address; parents see the addresses.
 */
import { NextResponse } from 'next/server';

let parent = false;
const account = { id: 'a', accountEmail: 'someone@example.org', accessToken: 't', lastSynced: null, syncErrors: null, name: 'n' };

jest.mock('@/lib/auth', () => ({
  getDisplayAuth: async () => ({ userId: 'u', role: parent ? 'parent' : 'guest' }),
  requireRole: () => (parent ? null : NextResponse.json({ error: 'Forbidden' }, { status: 403 })),
}));
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({ from: () => ({ where: async () => [account] }) }),
    query: { apiCredentials: { findFirst: async () => ({ id: 'g', accountEmail: 'someone@example.org' }) } },
  },
}));
jest.mock('@/lib/db/schema', () => ({ calendarSources: {}, taskSources: {}, shoppingListSources: {}, photoSources: {}, apiCredentials: {} }));
jest.mock('drizzle-orm', () => ({ eq: () => ({}) }));
jest.mock('@/lib/utils/logError', () => ({ logError: jest.fn() }));

import { GET } from '../route';

const status = async () => (await GET()).json();

describe('GET /api/integrations/status read scope (#809)', () => {
  it('tells the wall what is connected, without email addresses', async () => {
    parent = false;
    const body = await status();
    expect(body.google.connected).toBe(true);
    expect(JSON.stringify(body)).not.toContain('@');
    expect(body.google.accountEmails).toEqual([]);
    expect(body.gmail.accountEmail).toBeNull();
  });

  it('tells a parent which accounts are connected', async () => {
    parent = true;
    const body = await status();
    expect(body.google.accountEmail).toBe('someone@example.org');
    expect(body.gmail.accountEmail).toBe('someone@example.org');
  });
});
