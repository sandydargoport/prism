/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import type { LiveTrack } from '@/lib/hooks/useBusLive';
import type { BusRouteStatus } from '@/lib/hooks/useBusTracking';

jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', displayTimezone: 'UTC' }),
}));
jest.mock('../useMobileCardOrder', () => ({
  useMobileCardOrder: () => ({ order: ['busTracking'], setOrder: jest.fn() }),
  useHiddenCards: () => [[]],
}));
jest.mock('@/lib/hooks/usePullToRefresh', () => ({ usePullToRefresh: () => ({ pullDistance: 0, refreshing: false }) }));
jest.mock('@/lib/hooks/useMobileLayout', () => ({ useMobileLayout: () => ({ layout: 'rows' }) }));

let busTracking: { routes: BusRouteStatus[]; allRoutes: BusRouteStatus[] };
let busLive: { tracks: LiveTrack[]; provider: boolean | null };
jest.mock('@/lib/hooks/useBusTracking', () => ({ useBusTracking: () => busTracking }));
jest.mock('@/lib/hooks/useBusLive', () => ({
  ...jest.requireActual('@/lib/hooks/useBusLive'),
  useBusLive: () => ({ ...busLive, clockOffsetMs: 0 }),
}));

import { MobileDashboard } from '../MobileDashboard';

const NOW = Date.parse('2026-10-30T20:40:00Z');

const route = {
  id: 'pm-route', label: 'Afternoon bus', studentName: 'Kid', direction: 'PM', scheduledTime: '15:30',
  activeDays: [1, 2, 3, 4, 5], checkpoints: [], stopName: 'Corner stop', schoolName: 'School',
  prediction: { status: 'cold_start', lastCheckpointIndex: -1 },
} as unknown as BusRouteStatus;

const waiting: LiveTrack = {
  id: 'pm-today', routeId: 'pm-route', routeLabel: 'Afternoon bus', direction: 'PM', label: null, status: 'planned',
  vehicle: null, driverLabel: null, progress: null,
  plannedStart: '2026-10-30T20:50:00Z', plannedEnd: '2026-10-30T21:15:00Z',
  lastFixAt: null, riderStopKey: 'home', shiftMs: null, shiftMeasured: false, typicalLateMs: null,
  stops: [{
    key: 'home', name: 'Corner stop', order: 1, kind: 'stop', lat: 0, lng: 0,
    plannedAt: '2026-10-30T21:05:00Z', arrivedAt: null, departedAt: null, projectedAt: '2026-10-30T21:05:00Z', passed: false,
  }],
  fixes: [], usualPath: null,
};

// Every other card's data reads as empty; only the bus card is in the order.
const data = new Proxy({}, { get: () => ({}) }) as React.ComponentProps<typeof MobileDashboard>['data'];

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  busTracking = { routes: [route], allRoutes: [route] };
});
afterEach(() => jest.useRealTimers());

describe('phone dashboard bus card', () => {
  it("shows today's trip before it starts when a live provider feeds the route", () => {
    busLive = { tracks: [waiting], provider: true };
    render(<MobileDashboard data={data} />);
    expect(screen.getByText(/Corner stop 21:05 · in 25 min/)).toBeTruthy();
    expect(screen.queryByText('En route from school')).toBeNull();
  });

  it('keeps the email status without a live provider', () => {
    busLive = { tracks: [waiting], provider: false };
    render(<MobileDashboard data={data} />);
    expect(screen.getByText('En route from school')).toBeTruthy();
  });
});
