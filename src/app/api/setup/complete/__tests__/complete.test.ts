/**
 * @jest-environment node
 */
import { POST } from '../route';
import { FIRST_SCREEN_TEMPLATE, NEW_INSTALL_HIDDEN_PAGES } from '@/lib/constants/layoutTemplates';

/**
 * A small in-memory stand-in for the three tables the route touches. Reads
 * answer from `state`; writes are recorded in `inserted` / `updated`.
 */
const state: {
  members: Array<{ id: string; role: string }>;
  settings: Record<string, unknown>;
  layouts: Array<{ id: string }>;
} = { members: [], settings: {}, layouts: [] };
let inserted: Array<{ table: string; values: Record<string, unknown> }> = [];
let updated: string[] = [];

jest.mock('@/lib/db/schema', () => ({
  settings: { __table: 'settings', key: 'key' },
  users: { __table: 'users', id: 'id', role: 'role', sortOrder: 'sortOrder', createdAt: 'createdAt' },
  layouts: { __table: 'layouts', id: 'id' },
}));

jest.mock('drizzle-orm', () => ({
  eq: (_col: unknown, value: unknown) => ({ value }),
  asc: jest.fn(),
  sql: jest.fn(() => ({})),
}));

jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: (table: { __table: string }) => ({
        orderBy: () => (table.__table === 'users' ? state.members : []),
        limit: () => (table.__table === 'layouts' ? state.layouts.slice(0, 1) : []),
        where: (cond: { value: string }) =>
          cond.value in state.settings ? [{ key: cond.value, value: state.settings[cond.value] }] : [],
      }),
    }),
    insert: (table: { __table: string }) => ({
      values: async (values: Record<string, unknown>) => {
        inserted.push({ table: table.__table, values });
      },
    }),
    update: () => ({
      set: () => ({
        where: async (cond: { value: string }) => {
          updated.push(cond.value);
        },
      }),
    }),
  },
}));

const insertedSetting = (key: string) =>
  inserted.find((i) => i.table === 'settings' && i.values.key === key)?.values;
const insertedLayouts = () => inserted.filter((i) => i.table === 'layouts').map((i) => i.values);

beforeEach(() => {
  state.members = [
    { id: 'child-1', role: 'child' },
    { id: 'parent-1', role: 'parent' },
  ];
  state.settings = {};
  state.layouts = [];
  inserted = [];
  updated = [];
});

describe('POST /api/setup/complete', () => {
  it('refuses to finish setup with zero members (400)', async () => {
    state.members = [];
    const res = await POST();
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/at least one family member/i);
    expect(inserted).toEqual([]);
    expect(updated).toEqual([]);
  });

  it('marks setup complete and defaults the display user to the primary parent', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect(insertedSetting('displayUserId')?.value).toBe('parent-1');
    expect(insertedSetting('setupComplete')).toBeDefined();
  });

  it('does not overwrite an existing display-user choice', async () => {
    state.settings.displayUserId = ''; // already chosen, even "None"
    await POST();
    expect(insertedSetting('displayUserId')).toBeUndefined();
  });

  describe('first screen of a new install (#808)', () => {
    it('writes the calendar-first layout as the default, created by the primary parent', async () => {
      await POST();
      const layouts = insertedLayouts();
      expect(layouts).toHaveLength(1);
      expect(layouts[0]).toMatchObject({
        name: FIRST_SCREEN_TEMPLATE.name,
        isDefault: true,
        widgets: FIRST_SCREEN_TEMPLATE.widgets,
        createdBy: 'parent-1',
      });
      expect(FIRST_SCREEN_TEMPLATE.widgets[0]!.i).toBe('calendar');
    });

    it('hides Wishes, Travel and Weekend', async () => {
      await POST();
      expect(insertedSetting('hiddenPages')?.value).toEqual([...NEW_INSTALL_HIDDEN_PAGES]);
      expect(NEW_INSTALL_HIDDEN_PAGES).toEqual(['/wishes', '/travel', '/weekend']);
    });

    it('leaves an install that already finished setup exactly as it is', async () => {
      state.settings.setupComplete = { completedAt: '2026-01-01T00:00:00Z' };
      await POST();
      expect(insertedLayouts()).toEqual([]);
      expect(insertedSetting('hiddenPages')).toBeUndefined();
      expect(updated).toEqual(['setupComplete']);
    });

    it('never adds a layout when one already exists', async () => {
      state.layouts = [{ id: 'existing' }];
      await POST();
      expect(insertedLayouts()).toEqual([]);
    });

    it('never replaces a page choice already made', async () => {
      state.settings.hiddenPages = [];
      await POST();
      expect(insertedSetting('hiddenPages')).toBeUndefined();
    });
  });
});
