/**
 * @jest-environment jsdom
 *
 * A wall display is loaded once and left running. The bus widget must show a
 * route when its window opens, and pick up a route configured after the page
 * loaded, without a reload (#596).
 */

import { act, renderHook } from '@testing-library/react';
import { IDLE_POLL_MS, getPollingInterval, useBusTracking, type BusRouteStatus } from '../useBusTracking';

jest.mock('@/components/providers', () => ({
  useTimeFormat: () => ({ householdTimezone: 'America/Chicago' }),
}));

const route = {
  id: 'r1', label: 'Route 7', studentName: 'Sam', direction: 'AM', scheduledTime: '07:30',
  activeDays: [1, 2, 3, 4, 5], checkpoints: [], stopName: null, schoolName: null,
  prediction: {
    status: 'no_data', etaMinutes: null, etaRangeLow: null, etaRangeHigh: null, lastCheckpointName: null,
    lastCheckpointTime: null, lastCheckpointIndex: 0, totalCheckpoints: 0, minutesSinceLastCheckpoint: null,
  },
} as BusRouteStatus;

let served: BusRouteStatus[] = [];
const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ routes: served, connected: true }) }));

async function flush() {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  jest.useFakeTimers();
  // Monday 28 Sep 2026, 06:00 in Chicago: an hour and a half before the route.
  jest.setSystemTime(new Date('2026-09-28T11:00:00Z'));
  global.fetch = fetchMock as unknown as typeof fetch;
  fetchMock.mockClear();
});

afterEach(() => jest.useRealTimers());

describe('useBusTracking on a display that is never reloaded', () => {
  it('shows a route once its window opens', async () => {
    served = [route];
    const { result } = renderHook(() => useBusTracking());
    await flush();
    expect(result.current.routes).toHaveLength(0);

    // 06:31: inside the hour before 07:30.
    await act(async () => { jest.advanceTimersByTime(31 * 60_000); });
    expect(result.current.routes.map((r) => r.id)).toEqual(['r1']);
  });

  it('picks up a route set up after the page loaded', async () => {
    jest.setSystemTime(new Date('2026-09-28T12:00:00Z')); // 07:00, inside the window
    served = [];
    const { result } = renderHook(() => useBusTracking());
    await flush();
    expect(result.current.allRoutes).toHaveLength(0);

    served = [route];
    await act(async () => { jest.advanceTimersByTime(IDLE_POLL_MS); });
    await flush();
    expect(result.current.routes.map((r) => r.id)).toEqual(['r1']);
  });
});

describe('getPollingInterval', () => {
  it('keeps polling, slowly, with no route in its window', () => {
    expect(getPollingInterval([])).toBe(IDLE_POLL_MS);
  });
});
