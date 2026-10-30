/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BusTrackingCard } from '../MobileCards';
import { BusTrackingTile } from '../TileCards';
import { pickShownTrack, type LiveTrack } from '@/lib/hooks/useBusLive';
import type { BusRouteStatus } from '@/lib/hooks/useBusTracking';

jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/components/providers/TimeFormatProvider', () => ({
  useTimeFormat: () => ({ timeFormat: '24h', displayTimezone: 'UTC' }),
}));

const NOW = Date.parse('2026-10-30T20:40:00Z');

const route: BusRouteStatus = {
  id: 'pm-route', label: 'Afternoon bus', studentName: 'Kid', direction: 'PM', scheduledTime: '15:30',
  activeDays: [1, 2, 3, 4, 5], checkpoints: [], stopName: 'Corner stop', schoolName: 'School',
  prediction: {
    status: 'cold_start', etaMinutes: null, etaRangeLow: null, etaRangeHigh: null,
    lastCheckpointIndex: -1, lastCheckpointName: null, minutesSinceLastCheckpoint: null,
  } as unknown as BusRouteStatus['prediction'],
};

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

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe('phone bus card and tile with a live provider', () => {
  it("show today's trip on the open route before it starts, not the email status", () => {
    const shown = pickShownTrack([waiting], [route.id], true, NOW);
    render(<>
      <BusTrackingCard routes={[route]} live={shown} provider />
      <BusTrackingTile routes={[route]} live={shown} provider />
    </>);
    expect(screen.getAllByText(/Corner stop 21:05 · in 25 min/)).toHaveLength(2);
    expect(screen.queryByText('En route from school')).toBeNull();
  });

  it('say there is no bus today when the provider sent no trip for the route', () => {
    const shown = pickShownTrack([], [route.id], true, NOW);
    render(<>
      <BusTrackingCard routes={[route]} live={shown} provider />
      <BusTrackingTile routes={[route]} live={shown} provider />
    </>);
    expect(screen.getAllByText('No bus today')).toHaveLength(2);
  });

  it('do not call a trip that has not started moving', () => {
    const shown = pickShownTrack([{ ...waiting, stops: [{ ...waiting.stops[0]!, projectedAt: null }] }], [route.id], true, NOW);
    render(<BusTrackingTile routes={[route]} live={shown} provider />);
    expect(screen.getByText('Waiting for the bus')).toBeTruthy();
  });
});

describe('phone bus card without a live provider', () => {
  it('keeps the email status', () => {
    render(<BusTrackingCard routes={[route]} live={pickShownTrack([waiting], [route.id], false, NOW)} provider={false} />);
    expect(screen.getByText('En route from school')).toBeTruthy();
  });
});
