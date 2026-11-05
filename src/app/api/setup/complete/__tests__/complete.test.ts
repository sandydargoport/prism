/**
 * @jest-environment node
 */
import { POST } from '../route';
import { NEW_INSTALL_HIDDEN_PAGES, TODAY_TEMPLATE } from '@/lib/constants/layoutTemplates';

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
let updatedValues: Record<string, unknown> = {};

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
      set: (row: { value: unknown }) => ({
        where: async (cond: { value: string }) => {
          updated.push(cond.value);
          updatedValues[cond.value] = row.value;
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
  updatedValues = {};
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
    it('starts on Today as the default, with the Calendar layout beside it, created by the primary parent (#808)', async () => {
      await POST();
      const layouts = insertedLayouts();
      expect(layouts).toHaveLength(2);
      expect(layouts[0]).toMatchObject({ name: 'Today', view: 'today', slug: 'home', isDefault: true, createdBy: 'parent-1' });
      expect(layouts[1]).toMatchObject({ name: 'Calendar', view: 'calendar', isDefault: false, createdBy: 'parent-1' });
      expect((layouts[0]!.widgets as Array<{ i: string }>).map((w) => w.i)).toEqual(TODAY_TEMPLATE.widgets.map((w) => w.i));
    });

    it('hides Wishes, Travel and Weekend', async () => {
      await POST();
      expect(insertedSetting('hiddenPages')?.value).toEqual([...NEW_INSTALL_HIDDEN_PAGES]);
      expect(NEW_INSTALL_HIDDEN_PAGES).toEqual(['/wishes', '/travel', '/weekend']);
    });

    it('turns on the bundled scenery, and never overrides a choice already made', async () => {
      await POST();
      expect(insertedSetting('wallpaperScenery')?.value).toBe(true);
      inserted = [];
      state.settings = { wallpaperScenery: false };
      await POST();
      expect(insertedSetting('wallpaperScenery')).toBeUndefined();
    });

    // #835: a new install does everyday jobs without a PIN; an existing one
    // never runs this, so it keeps the PIN for everything.
    it('turns "Require the PIN for every change" off, keeping other security settings', async () => {
      await POST();
      expect(insertedSetting('security')?.value).toEqual({ requirePinForEveryChange: false });
      inserted = [];
      state.settings = { security: { sessionTimeout: 30 } };
      await POST();
      expect(updatedValues.security).toEqual({ sessionTimeout: 30, requirePinForEveryChange: false });
    });

    it('never overrides a PIN choice already made', async () => {
      state.settings = { security: { requirePinForEveryChange: true } };
      await POST();
      expect(insertedSetting('security')).toBeUndefined();
      expect(updatedValues.security).toBeUndefined();
    });

    it('leaves an install that already finished setup exactly as it is', async () => {
      state.settings.setupComplete = { completedAt: '2026-01-01T00:00:00Z' };
      await POST();
      expect(insertedLayouts()).toEqual([]);
      expect(insertedSetting('hiddenPages')).toBeUndefined();
      expect(insertedSetting('wallpaperScenery')).toBeUndefined();
      expect(insertedSetting('security')).toBeUndefined();
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

  describe('the look picked in the wizard (#808)', () => {
    // The first screen is Today (#808), drawn as a scene with no cards, so a
    // look sets the scenery, palette and mode, not a card fill.
    it("with no pick, starts on Photo: scenery, the Paper palette, each device's own mode", async () => {
      await POST();
      expect(insertedSetting('wallpaperScenery')?.value).toBe(true);
      expect(insertedSetting('theme')?.value).toEqual({ paletteId: 'paper' });
      expect(insertedSetting('defaultThemeMode')).toBeUndefined();
    });

    it('Night is Photo, dark on every display that never chose', async () => {
      state.settings.firstLook = 'night';
      await POST();
      expect(insertedSetting('wallpaperScenery')?.value).toBe(true);
      expect(insertedSetting('defaultThemeMode')?.value).toBe('dark');
    });

    it('Paper has no scenery', async () => {
      state.settings.firstLook = 'paper';
      await POST();
      expect(insertedSetting('wallpaperScenery')?.value).toBe(false);
      expect(insertedSetting('theme')?.value).toEqual({ paletteId: 'paper' });
      expect(insertedSetting('defaultThemeMode')).toBeUndefined();
    });

    it("never replaces a palette already picked, and keeps an old row's other fields", async () => {
      state.settings.theme = { paletteId: 'clay' };
      await POST();
      expect(insertedSetting('theme')).toBeUndefined();
      expect(updatedValues.theme).toBeUndefined();

      inserted = [];
      state.settings.theme = { mode: 'system' };
      await POST();
      expect(updatedValues.theme).toEqual({ mode: 'system', paletteId: 'paper' });
    });

    it('ignores a stored look it does not know', async () => {
      state.settings.firstLook = 'neon';
      await POST();
      expect(insertedSetting('wallpaperScenery')?.value).toBe(true);
    });
  });
});
