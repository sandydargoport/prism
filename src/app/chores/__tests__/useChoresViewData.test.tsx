/**
 * @jest-environment jsdom
 */
/**
 * The Chores page asks for future-dated chores (#1132): without
 * includeFuture the API drops them, so Tomorrow and Later can never fill.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useChoresViewData } from '../useChoresViewData';
import { choreGroups } from '../ChoresDoList';

const mockUseChores = jest.fn();

jest.mock('@/lib/hooks', () => ({
  useChores: (...args: unknown[]) => mockUseChores(...args),
}));
jest.mock('@/components/providers', () => ({
  useAuth: () => ({ requireAuth: jest.fn() }),
  useFamily: () => ({ members: [] }),
}));
jest.mock('@/components/ui/use-toast', () => ({
  toast: jest.fn(),
}));
jest.mock('@/lib/hooks/useConfirmDialog', () => ({
  useConfirmDialog: () => ({ confirm: jest.fn(), dialogProps: {} }),
}));
jest.mock('@/lib/hooks/usePersistedState', () => ({
  usePersistedState: (_key: string, initial: unknown) => [initial, jest.fn()],
  useSessionScopedState: (_key: string, initial: unknown) => [initial, jest.fn()],
  oneOf: (...values: unknown[]) => (value: unknown) => values.includes(value),
  isBoolean: (value: unknown): value is boolean => typeof value === 'boolean',
  isStringArray: (value: unknown): value is string[] => Array.isArray(value),
}));
jest.mock('@/lib/hooks/useNow', () => ({
  useNow: () => new Date('2026-11-10T12:00:00Z'),
}));
jest.mock('@/lib/hooks/useFetchOnMount', () => ({
  useFetchOnMount: () => {},
}));
jest.mock('@/lib/hooks/useLocalCopy', () => ({
  useLocalCopy: (source: unknown) => [source, jest.fn()],
}));

const dueToday = {
  id: 'c1', title: 'Take out the trash', category: 'trash', frequency: 'daily',
  pointValue: 1, requiresApproval: false, enabled: true,
  nextDue: '2026-11-10', lastCompleted: null, createdAt: '2026-11-01',
} as const;
const dueTomorrow = {
  id: 'c2', title: 'Mop the kitchen', category: 'cleaning', frequency: 'weekly',
  pointValue: 2, requiresApproval: false, enabled: true,
  nextDue: '2026-11-11', lastCompleted: null, createdAt: '2026-11-01',
} as const;

describe('useChoresViewData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChores.mockReturnValue({
      chores: [dueToday, dueTomorrow],
      loading: false,
      error: null,
      refresh: jest.fn(),
      approveChore: jest.fn(),
    });
  });

  it('fetches future-dated chores so Tomorrow and Later can fill', () => {
    const { result } = renderHook(() => useChoresViewData());
    expect(mockUseChores).toHaveBeenCalledWith({ showDisabled: true, includeFuture: true });
    expect(result.current.filteredChores.map((c) => c.id)).toEqual(['c1', 'c2']);
  });
});

// What the page receives, through the real hook: the API leaves out a chore
// not yet due unless asked for it (`includeFuture`), as /api/chores does.
describe('the Chores page with a chore due tomorrow (#1132)', () => {
  const apiChore = (c: typeof dueToday | typeof dueTomorrow) => ({
    ...c, description: null, customIntervalDays: null, nextDueTime: null,
    assignedTo: null, pendingApproval: null,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseChores.mockImplementation(jest.requireActual('@/lib/hooks/useChores').useChores);
    global.fetch = jest.fn(async (url: string) => {
      const future = new URL(url, 'http://prism.test').searchParams.get('includeFuture') === 'true';
      const chores = future ? [dueToday, dueTomorrow] : [dueToday];
      return { ok: true, json: async () => ({ chores: chores.map(apiChore) }) };
    }) as unknown as typeof fetch;
  });

  it('lists it under Tomorrow and counts it among the active chores', async () => {
    const { result } = renderHook(() => useChoresViewData());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const groups = choreGroups(result.current.filteredChores, new Date(2026, 10, 10));
    expect(groups.today.map((c) => c.title)).toEqual(['Take out the trash']);
    expect(groups.tomorrow.map((c) => c.title)).toEqual(['Mop the kitchen']);
    expect(result.current.enabledCount).toBe(2);
  });
});
