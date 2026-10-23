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
  lastFixAt: null, riderStopKey: 'home', shiftMs: null,
  stops: [stop('school', 0, true), stop('home', 1, false)], fixes: [], usualPath: null,
});

describe('stopProgress', () => {
  it("counts the provider's whole route when it sends progress", () => {
    expect(stopProgress(track({ lastVisitedStop: 14, totalStops: 22 }))).toBe('14 of 22');
  });

  it("falls back to the track's own stops", () => {
    expect(stopProgress(track(null))).toBe('1 of 2');
    expect(stopProgress(track({ lastVisitedStop: 0, totalStops: 0 }))).toBe('1 of 2');
  });

  it('is empty with nothing to count', () => {
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
});
