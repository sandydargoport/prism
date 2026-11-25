/**
 * @jest-environment jsdom
 */

/**
 * Manage calendars is reachable on a phone (#1314). A phone hides the view
 * options menu, where Manage calendars lives on the wall and desktop, so it
 * was reachable only from the Sync paused badge or the empty state. On a
 * phone it is in the page header's menu; elsewhere it stays in View options.
 */
import React from 'react';
import { act, render, fireEvent, screen } from '@testing-library/react';

let mockIsMobile = true;

jest.mock('@/lib/hooks/useStoredValue', () => ({ useHydrated: () => true }));
jest.mock('@/lib/hooks', () => ({
  useIsMobile: () => mockIsMobile,
  useSwipeNavigation: () => undefined,
  useCalendarSources: () => ({ calendars: [{ id: 'c1' }], loading: false }),
}));
jest.mock('next/navigation', () => ({ useSearchParams: () => null }));
jest.mock('@/components/providers', () => ({
  useAuth: () => ({ activeUser: null, requireAuth: jest.fn() }),
  useFamily: () => ({ members: [] }),
  useTimeFormat: () => ({ use24Hour: false }),
}));
jest.mock('../useCalendarViewData', () => ({
  useCalendarViewData: () => ({
    currentDate: new Date(2026, 0, 14), setCurrentDate: jest.fn(),
    viewType: 'agenda', setViewType: jest.fn(),
    weeksBordered: false, setWeeksBordered: jest.fn(),
    displayMode: 'inline', setDisplayMode: jest.fn(),
    hideWeekends: false, setHideWeekends: jest.fn(),
    overlays: { events: true, meals: true, chores: true, tasks: true }, setOverlays: jest.fn(),
    selectedEvent: null, setSelectedEvent: jest.fn(),
    showAddEvent: false, setShowAddEvent: jest.fn(),
    editingEvent: null, setEditingEvent: jest.fn(),
    selectedCalendarIds: new Set(['all']),
    calendarGroups: [],
    toggleCalendar: jest.fn(),
    mergedView: false, setMergedView: jest.fn(),
    events: [], loading: false, error: null, refreshEvents: jest.fn(),
    goToToday: jest.fn(), goToPrevious: jest.fn(), goToNext: jest.fn(),
    getDateRangeTitle: () => 'January 2026',
  }),
}));
jest.mock('@/lib/hooks/useCalendarNotes', () => ({ useCalendarNotes: () => ({ notesByDate: {}, upsertNote: jest.fn() }) }));
jest.mock('@/lib/hooks/useDayBucketsForRange', () => ({ useDayBucketsForRange: () => ({ bucketsByDate: new Map(), refresh: jest.fn() }) }));
jest.mock('@/lib/hooks/useWeekMutations', () => ({
  useWeekMutations: () => ({ moveChore: jest.fn(), moveTask: jest.fn(), moveMeal: jest.fn(), moveEvent: jest.fn() }),
}));
jest.mock('@/lib/hooks/useWeekStartsOn', () => ({ useWeekStartsOn: () => ({ weekStartsOn: 0 }) }));
jest.mock('@/lib/hooks/useChores', () => ({ useChores: () => ({ chores: [], refresh: jest.fn() }) }));
jest.mock('@/lib/hooks/useTasks', () => ({ useTasks: () => ({ tasks: [], refresh: jest.fn() }) }));
jest.mock('@/lib/hooks/useMeals', () => ({ useMeals: () => ({ meals: [], refresh: jest.fn() }) }));
jest.mock('@/lib/hooks/useRecipes', () => ({ useRecipes: () => ({ recipes: [] }) }));
jest.mock('@/lib/hooks/useTaskLists', () => ({ useTaskLists: () => ({ lists: [] }) }));
jest.mock('@/lib/hooks/usePendingDeletions', () => ({
  usePendingDeletions: () => ({ pending: [], count: 0, apply: jest.fn(), refresh: jest.fn() }),
}));
jest.mock('@/lib/hooks/useCalendarSyncHealth', () => ({ useCalendarSyncHealth: () => ({ needsReauth: 0, provider: null }) }));
jest.mock('@/lib/hooks/usePageAdd', () => ({ usePageAdd: () => {} }));
jest.mock('@/app/chores/useChoreModals', () => ({ useChoreModals: () => ({ saveEditedChore: jest.fn() }) }));
jest.mock('@/app/chores/ChoreModal', () => ({ ChoreModal: () => null }));
jest.mock('@/app/tasks/TaskModal', () => ({ TaskModal: () => null }));
jest.mock('@/components/modals', () => ({ AddEventModal: () => null }));
jest.mock('@/components/calendar/EventSheet', () => ({ EventSheet: () => null }));
jest.mock('@/components/calendar/AgendaView', () => ({ AgendaView: () => null }));
jest.mock('../PendingDeletionsModal', () => ({ PendingDeletionsModal: () => null }));
jest.mock('../ViewMenu', () => ({ ViewMenu: () => null }));
jest.mock('../ManageCalendarsModal', () => ({ ManageCalendarsModal: () => <div data-testid="manage-calendars-modal" /> }));
// View options renders its footer, where Manage calendars sits off a phone.
jest.mock('../ViewOptionsMenu', () => ({
  ViewOptionsMenu: ({ footer }: { footer?: React.ReactNode }) => <div data-testid="view-options">{footer}</div>,
}));
jest.mock('@/components/layout', () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  FilterBar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SubpageHeader: ({ actions, overflow }: { actions?: React.ReactNode; overflow?: Array<{ label: string; onClick: () => void }> }) => (
    <header>
      {actions}
      {overflow && (
        <nav data-testid="header-menu">
          {overflow.map((o) => <button key={o.label} type="button" onClick={o.onClick}>{o.label}</button>)}
        </nav>
      )}
    </header>
  ),
}));

import { CalendarView } from '../CalendarView';

beforeEach(() => { mockIsMobile = true; });

// The views are lazy; let them settle so the render is the one a person sees.
const renderCalendar = () => act(async () => { render(<CalendarView />); });

describe('Manage calendars on a phone (#1314)', () => {
  it('is in the header menu and opens the Manage calendars panel', async () => {
    await renderCalendar();
    expect(screen.queryByTestId('manage-calendars-modal')).toBeNull();
    const menu = screen.getByTestId('header-menu');
    fireEvent.click(screen.getByRole('button', { name: 'Manage calendars' }));
    expect(menu.textContent).toContain('Manage calendars');
    expect(screen.getByTestId('manage-calendars-modal')).toBeTruthy();
  });

  it('stays in View options off a phone, with no header menu', async () => {
    mockIsMobile = false;
    await renderCalendar();
    expect(screen.queryByTestId('header-menu')).toBeNull();
    const viewOptions = screen.getByTestId('view-options');
    expect(viewOptions.textContent).toContain('Manage calendars');
    fireEvent.click(screen.getByRole('button', { name: 'Manage calendars' }));
    expect(screen.getByTestId('manage-calendars-modal')).toBeTruthy();
  });
});
