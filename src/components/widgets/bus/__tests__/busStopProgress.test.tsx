/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BusLivePanel, stopProgress } from '../BusLiveView';
import type { LiveTrack } from '@/lib/hooks/useBusLive';
import type { StopTiming } from '@/lib/services/bus-eta';

jest.mock('next/dynamic', () => () => () => null);

const stop = (key: string, order: number, passed: boolean): StopTiming => ({
  key, name: key, order, kind: 'stop', lat: 0, lng: 0,
  plannedAt: null, arrivedAt: null, departedAt: null, projectedAt: null, passed,
});

const track = (progress: LiveTrack['progress']): LiveTrack => ({
  id: 't', routeId: 'r', routeLabel: 'Route 7', direction: 'PM', label: null, status: 'in_progress',
  vehicle: null, driverLabel: null, progress, plannedStart: null, plannedEnd: null,
  lastFixAt: null, riderStopKey: 'home', shiftMs: null, shiftMeasured: false, typicalLateMs: null,
  stops: [stop('school', 0, true), stop('home', 1, false)], fixes: [], usualPath: null,
});

describe('stopProgress', () => {
  it("counts the provider's whole route when it sends progress", () => {
    expect(stopProgress(track({ lastVisitedStop: 14, totalStops: 22 }))).toBe('14 of 22');
  });

  it("shows nothing before the provider sends a count, rather than counting the track's own two stops", () => {
    expect(stopProgress(track(null))).toBeNull();
    expect(stopProgress(track({ lastVisitedStop: 0, totalStops: 0 }))).toBeNull();
    expect(stopProgress({ progress: null, stops: [] })).toBeNull();
  });
});

describe('BusLivePanel', () => {
  it('shows how far along the bus is on the small card over the map', () => {
    render(
      <BusLivePanel track={track({ lastVisitedStop: 14, totalStops: 22 })} speedUnit="mph"
        now={Date.now()} formatTime={(iso) => iso} detail={false} />,
    );
    expect(screen.getByText('Stops')).toBeTruthy();
    expect(screen.getByText('14 of 22')).toBeTruthy();
  });

  it('shows the lateness against the schedule and against the usual', () => {
    render(
      <BusLivePanel
        track={{ ...track(null), shiftMs: 12 * 60_000, shiftMeasured: true, typicalLateMs: 8 * 60_000 }}
        speedUnit="mph" now={Date.now()} formatTime={(iso) => iso} detail={false} />,
    );
    expect(screen.getByText('12 min late · 4 min later than usual')).toBeTruthy();
  });

  it('leaves the Stops row out before the provider sends a count', () => {
    render(
      <BusLivePanel track={track(null)} speedUnit="mph" now={Date.now()} formatTime={(iso) => iso} detail={false} />,
    );
    expect(screen.queryByText('Stops')).toBeNull();
    expect(screen.queryByText('1 of 2')).toBeNull();
  });
});
