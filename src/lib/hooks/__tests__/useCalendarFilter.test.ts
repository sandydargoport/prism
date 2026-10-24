/**
 * @jest-environment jsdom
 */

/**
 * Tests for useCalendarFilter hook using renderHook.
 *
 * Tests toggle logic (all/individual), filterEvents matching,
 * and calendar group derivation from sources.
 */

import * as React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

// --- Mock calendar sources ---
const mockCalendarSources = [
  {
    id: 'src-1', provider: 'google', dashboardCalendarName: 'Alice Cal',
    displayName: null, color: '#FF0000', enabled: true, showInEventModal: true,
    isFamily: false, groupId: 'group-1', groupName: 'Alice', groupColor: '#FF0000',
    lastSynced: null, user: { id: 'user-1', name: 'Alice', color: '#FF0000' },
  },
  {
    id: 'src-2', provider: 'google', dashboardCalendarName: 'Bob Cal',
    displayName: null, color: '#0000FF', enabled: true, showInEventModal: true,
    isFamily: false, groupId: 'group-2', groupName: 'Bob', groupColor: '#0000FF',
    lastSynced: null, user: { id: 'user-2', name: 'Bob', color: '#0000FF' },
  },
  {
    id: 'src-family', provider: 'google', dashboardCalendarName: 'Family',
    displayName: null, color: '#F59E0B', enabled: true, showInEventModal: true,
    isFamily: true, groupId: 'FAMILY', groupName: 'Family', groupColor: '#F59E0B',
    lastSynced: null, user: null,
  },
];

jest.mock('../useCalendarEvents', () => ({
  useCalendarSources: () => ({
    calendars: mockCalendarSources,
    loading: false,
    error: null,
    refresh: jest.fn(),
  }),
}));

import { useCalendarFilter } from '../useCalendarFilter';

describe('useCalendarFilter', () => {
  beforeEach(() => {
    // Mock fetch for /api/calendar-groups
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ groups: [] }),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initial state', () => {
    it('starts with "all" in selectedCalendarIds', () => {
      const { result } = renderHook(() => useCalendarFilter());
      expect(result.current.selectedCalendarIds.has('all')).toBe(true);
    });

    it('returns toggleCalendar and filterEvents as functions', () => {
      const { result } = renderHook(() => useCalendarFilter());
      expect(typeof result.current.toggleCalendar).toBe('function');
      expect(typeof result.current.filterEvents).toBe('function');
    });

    it('derives calendarGroups from sources when API returns empty', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      // Wait for the API fetch effect to settle
      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      const groupIds = result.current.calendarGroups.map((g) => g.id);
      expect(groupIds).toContain('user-1');
      expect(groupIds).toContain('user-2');
      expect(groupIds).toContain('FAMILY');
    });

    it('uses API groups when available', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          groups: [
            { id: 'api-group-1', name: 'API Group', color: '#00FF00', type: 'person' },
          ],
        }),
      });

      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBe(1);
      });

      expect(result.current.calendarGroups[0]!.id).toBe('api-group-1');
      expect(result.current.calendarGroups[0]!.name).toBe('API Group');
    });
  });

  describe('"all" covers every group', () => {
    it('includes every group id from the first render that has groups', () => {
      const seen: { groups: string[]; selected: Set<string> }[] = [];
      renderHook(() => {
        const r = useCalendarFilter();
        // Committed renders only, the ones that reach the screen.
        React.useLayoutEffect(() => {
          seen.push({ groups: r.calendarGroups.map((g) => g.id), selected: r.selectedCalendarIds });
        });
        return r;
      });

      const withGroups = seen.filter((s) => s.groups.length > 0);
      expect(withGroups.length).toBeGreaterThan(0);
      for (const s of withGroups) {
        for (const id of s.groups) expect(s.selected.has(id)).toBe(true);
      }
    });

    it('a first tap on a group that loaded later hides that group', async () => {
      // Groups derived from the sources come first; the API's groups replace them.
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          groups: [
            { id: 'api-group-1', name: 'API Group', color: '#00FF00', type: 'person' },
            { id: 'api-group-2', name: 'Other Group', color: '#0000FF', type: 'person' },
          ],
        }),
      });
      const { result } = renderHook(() => useCalendarFilter());
      await waitFor(() => {
        expect(result.current.calendarGroups[0]?.id).toBe('api-group-1');
      });

      act(() => { result.current.toggleCalendar('api-group-1'); });

      expect(result.current.selectedCalendarIds.has('api-group-1')).toBe(false);
      expect(result.current.selectedCalendarIds.has('api-group-2')).toBe(true);
      expect(result.current.selectedCalendarIds.has('all')).toBe(false);
    });
  });

  describe('toggleCalendar', () => {
    it('toggling "all" when selected clears all selections', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      // Wait for groups to load so 'all' + group IDs are populated
      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      expect(result.current.selectedCalendarIds.has('all')).toBe(true);

      act(() => {
        result.current.toggleCalendar('all');
      });

      expect(result.current.selectedCalendarIds.size).toBe(0);
    });

    it('toggling "all" when not selected selects all groups', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      // First deselect all
      act(() => {
        result.current.toggleCalendar('all');
      });
      expect(result.current.selectedCalendarIds.size).toBe(0);

      // Then select all
      act(() => {
        result.current.toggleCalendar('all');
      });

      expect(result.current.selectedCalendarIds.has('all')).toBe(true);
      // Should contain all group IDs too
      for (const g of result.current.calendarGroups) {
        expect(result.current.selectedCalendarIds.has(g.id)).toBe(true);
      }
    });

    it('toggling individual calendar adds it and removes "all"', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      // Deselect all first
      act(() => {
        result.current.toggleCalendar('all');
      });

      // Add one calendar
      act(() => {
        result.current.toggleCalendar('user-1');
      });

      expect(result.current.selectedCalendarIds.has('user-1')).toBe(true);
      expect(result.current.selectedCalendarIds.has('all')).toBe(false);
    });

    it('toggling individual calendar removes it if already selected', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      // Deselect all, then add two
      act(() => { result.current.toggleCalendar('all'); });
      act(() => { result.current.toggleCalendar('user-1'); });
      act(() => { result.current.toggleCalendar('user-2'); });

      expect(result.current.selectedCalendarIds.has('user-1')).toBe(true);

      // Toggle user-1 off
      act(() => {
        result.current.toggleCalendar('user-1');
      });

      expect(result.current.selectedCalendarIds.has('user-1')).toBe(false);
      expect(result.current.selectedCalendarIds.has('user-2')).toBe(true);
    });

    it('auto-selects "all" when all groups are individually selected', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      // Start from nothing
      act(() => { result.current.toggleCalendar('all'); });
      expect(result.current.selectedCalendarIds.has('all')).toBe(false);

      // Add each group individually
      for (const g of result.current.calendarGroups) {
        act(() => {
          result.current.toggleCalendar(g.id);
        });
      }

      // Once all groups are selected, 'all' should be auto-added
      expect(result.current.selectedCalendarIds.has('all')).toBe(true);
    });
  });

  describe('filterEvents', () => {
    const mockEvents = [
      { calendarId: 'src-1', title: 'Alice Event' },
      { calendarId: 'src-2', title: 'Bob Event' },
      { calendarId: 'src-family', title: 'Family Event' },
      { calendarId: 'src-unknown', title: 'Unknown Source Event' },
    ];

    it('shows all events when "all" is selected', () => {
      const { result } = renderHook(() => useCalendarFilter());

      const filtered = result.current.filterEvents(mockEvents as never[]);
      expect(filtered).toHaveLength(4);
    });

    it('shows no events when nothing is selected', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      act(() => {
        result.current.toggleCalendar('all');
      });

      const filtered = result.current.filterEvents(mockEvents as never[]);
      expect(filtered).toHaveLength(0);
    });

    it('filters events by groupId', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      // Deselect all, then select only group-1
      act(() => { result.current.toggleCalendar('all'); });
      act(() => { result.current.toggleCalendar('group-1'); });

      const filtered = result.current.filterEvents(mockEvents as never[]);
      expect(filtered).toHaveLength(1);
      expect((filtered[0] as typeof mockEvents[0]).title).toBe('Alice Event');
    });

    it('filters events by user id (legacy fallback)', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      // Deselect all, then select user-2
      act(() => { result.current.toggleCalendar('all'); });
      act(() => { result.current.toggleCalendar('user-2'); });

      const filtered = result.current.filterEvents(mockEvents as never[]);
      expect(filtered).toHaveLength(1);
      expect((filtered[0] as typeof mockEvents[0]).title).toBe('Bob Event');
    });

    it('excludes events with unknown calendar source', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      // Select only some groups (not all — selecting all triggers auto-"all")
      act(() => { result.current.toggleCalendar('all'); });
      act(() => { result.current.toggleCalendar('group-1'); });
      act(() => { result.current.toggleCalendar('group-2'); });

      const filtered = result.current.filterEvents(mockEvents as never[]);
      const titles = filtered.map((e: { title: string }) => e.title);
      // Unknown source is excluded even though we selected multiple groups
      expect(titles).not.toContain('Unknown Source Event');
      expect(titles).toContain('Alice Event');
      expect(titles).toContain('Bob Event');
      // Family not selected, so excluded
      expect(titles).not.toContain('Family Event');
    });

    it('selecting all groups individually auto-enables "all" (shows everything)', async () => {
      const { result } = renderHook(() => useCalendarFilter());

      await waitFor(() => {
        expect(result.current.calendarGroups.length).toBeGreaterThan(0);
      });

      // Deselect all, then re-select each group one by one
      act(() => { result.current.toggleCalendar('all'); });
      for (const g of result.current.calendarGroups) {
        act(() => { result.current.toggleCalendar(g.id); });
      }

      // Auto-"all" should be active now
      expect(result.current.selectedCalendarIds.has('all')).toBe(true);

      // And filterEvents shows everything, including unknown sources
      const filtered = result.current.filterEvents(mockEvents as never[]);
      expect(filtered).toHaveLength(4);
    });
  });
});
