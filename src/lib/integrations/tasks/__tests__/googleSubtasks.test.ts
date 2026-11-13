/**
 * Google Tasks subtasks come into Prism (#1201): fetchTasks keeps them, in
 * Google's order, each carrying its parent's id. They used to be skipped.
 */
jest.mock('@/lib/integrations/credentialStore', () => ({
  getGoogleCredentials: jest.fn().mockResolvedValue({ clientId: 'c', clientSecret: 's', redirectUri: '', gmailRedirectUri: '' }),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

import googleTasksProvider from '../google-tasks';

const item = (id: string, title: string, position: string, parent?: string) => ({
  id, title, position, ...(parent ? { parent } : {}), status: 'needsAction', updated: '2026-11-12T10:00:00.000Z',
});

it('keeps subtasks under their parent, in Google order', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({
      items: [
        item('s2', 'Find the drill', '00000000000000000001', 'p1'),
        item('p2', 'Call the plumber', '00000000000000000002'),
        item('s1', 'Buy the frame', '00000000000000000000', 'p1'),
        item('p1', 'Hang the photos', '00000000000000000001'),
      ],
    }),
  });

  const tasks = await googleTasksProvider.fetchTasks({ accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(Date.now() + 3_600_000) }, 'list-1');

  expect(tasks.map((t) => [t.title, t.parentId ?? null])).toEqual([
    ['Buy the frame', 'p1'],
    ['Find the drill', 'p1'],
    ['Hang the photos', null],
    ['Call the plumber', null],
  ]);
});
