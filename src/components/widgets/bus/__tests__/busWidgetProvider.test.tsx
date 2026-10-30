/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BusTrackingWidget } from '../../BusTrackingWidget';
import type { LiveTrack } from '@/lib/hooks/useBusLive';
import type { BusRouteStatus } from '@/lib/hooks/useBusTracking';

jest.mock('next/dynamic', () => () => () => null);
jest.mock('../BusLiveView', () => ({
  BusLiveView: ({ track }: { track: { id: string } }) => <div>live view {track.id}</div>,
}));

let busTracking: { routes: BusRouteStatus[]; allRoutes: BusRouteStatus[]; loading: boolean; error: null };
let busLive: { tracks: LiveTrack[]; provider: boolean | null };

jest.mock('@/lib/hooks/useBusTracking', () => ({ useBusTracking: () => busTracking }));
jest.mock('@/lib/hooks/useBusLive', () => ({
  ...jest.requireActual('@/lib/hooks/useBusLive'),
  useBusLive: () => ({
    ...busLive, speedUnit: 'mph', clockOffsetMs: 0, mapStyle: 'streets', camera: 'follow',
  }),
}));

const NOW = Date.parse('2026-10-30T20:40:00Z');

const route: BusRouteStatus = {
  id: 'pm-route', label: 'Afternoon bus', studentName: 'Kid', direction: 'PM', scheduledTime: '15:30',
  activeDays: [1, 2, 3, 4, 5], checkpoints: [], stopName: 'Corner stop', schoolName: 'School',
  prediction: {
    status: 'no_data', etaMinutes: null, etaRangeLow: null, etaRangeHigh: null,
    lastCheckpointIndex: -1, lastCheckpointName: null, minutesSinceLastCheckpoint: null,
  } as unknown as BusRouteStatus['prediction'],
};

const track = (over: Partial<LiveTrack>): LiveTrack => ({
  id: 'trip', routeId: 'pm-route', routeLabel: 'Afternoon bus', direction: 'PM', label: null, status: 'planned',
  vehicle: null, driverLabel: null, progress: null,
  plannedStart: '2026-10-30T20:50:00Z', plannedEnd: '2026-10-30T21:15:00Z',
  lastFixAt: null, riderStopKey: 'home', shiftMs: null, shiftMeasured: false, typicalLateMs: null,
  stops: [], fixes: [], usualPath: null, ...over,
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  busTracking = { routes: [route], allRoutes: [route], loading: false, error: null };
});
afterEach(() => jest.useRealTimers());

describe('bus widget with a live provider', () => {
  it("shows today's trip on the open route before the bus starts, not the email view", () => {
    busLive = { tracks: [track({ id: 'pm-today' })], provider: true };
    render(<BusTrackingWidget gridW={44} gridH={23} />);
    expect(screen.getByText('live view pm-today')).toBeTruthy();
    expect(screen.queryByText('No updates yet')).toBeNull();
  });

  it('keeps the trip on screen once it is done or the feed goes quiet', () => {
    busLive = { tracks: [track({ id: 'done', status: 'completed', lastFixAt: '2026-10-30T20:20:00Z' })], provider: true };
    render(<BusTrackingWidget gridW={44} gridH={23} />);
    expect(screen.getByText('live view done')).toBeTruthy();
  });

  it('picks the trip of the route whose window is open, not another route', () => {
    busLive = {
      tracks: [track({ id: 'am-today', routeId: 'am-route', plannedStart: '2026-10-30T12:25:00Z' }), track({ id: 'pm-today' })],
      provider: true,
    };
    render(<BusTrackingWidget gridW={44} gridH={23} />);
    expect(screen.getByText('live view pm-today')).toBeTruthy();
  });

  it('says there is no bus today when the provider sent no trip for the route', () => {
    busLive = { tracks: [], provider: true };
    render(<BusTrackingWidget gridW={44} gridH={23} />);
    expect(screen.getByText('No bus today')).toBeTruthy();
    expect(screen.queryByText('No updates yet')).toBeNull();
  });

  it('shows neither view until the live load says whether there is a provider', () => {
    busLive = { tracks: [], provider: null };
    render(<BusTrackingWidget gridW={44} gridH={23} />);
    expect(screen.queryByText('No updates yet')).toBeNull();
    expect(screen.queryByText('No bus today')).toBeNull();
  });
});

describe('bus widget without a live provider', () => {
  it('keeps the email view for email-fed routes', () => {
    busLive = { tracks: [], provider: false };
    render(<BusTrackingWidget gridW={44} gridH={23} />);
    expect(screen.getByText('No updates yet')).toBeTruthy();
  });
});
