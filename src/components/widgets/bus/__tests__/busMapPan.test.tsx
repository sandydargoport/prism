/**
 * @jest-environment jsdom
 *
 * The bus map pans by drag beside its zoom buttons, and a drag holds the
 * camera for a while, like a zoom by hand, so it does not pull the map back
 * mid-look. Every other gesture stays off. And the solid line of the road
 * driven so far follows the usual path rather than the raw fixes.
 */
import React from 'react';
import { act, render } from '@testing-library/react';
import { MANUAL_HOLD_MS, CAMERA_TICK_MS } from '@/lib/map/busCamera';
import type { LiveTrack } from '@/lib/hooks/useBusLive';

type Handler = (...a: unknown[]) => void;

/** The one map the widget makes: its options, its event handlers and its camera moves. */
const made: {
  options?: Record<string, unknown>; handlers: Record<string, Handler[]>; easeTo: jest.Mock;
  data: Record<string, unknown>;
} = {
  handlers: {},
  easeTo: jest.fn(),
  data: {},
};

jest.mock('@/lib/map/maplibreSetup', () => {
  class FakeMap {
    private center = { lng: 0, lat: 0 };
    constructor(options: Record<string, unknown>) {
      made.options = options;
      made.handlers = {};
    }
    on(event: string, handler: Handler) { (made.handlers[event] ??= []).push(handler); return this; }
    addControl() { return this; }
    getContainer() { return { clientWidth: 800, clientHeight: 600 }; }
    getStyle() { return { layers: [] }; }
    getSource(id: string) { return { setData: (d: unknown) => { made.data[id] = d; } }; }
    addSource() {}
    addLayer() {}
    setLayoutProperty() {}
    getZoom() { return 14; }
    // Whatever the bounds, the fit is somewhere else, so every unheld aim moves the camera.
    cameraForBounds() { return { center: { lng: this.center.lng + 1, lat: 0 }, zoom: 14 }; }
    project() { return { x: -1000, y: -1000 }; }
    easeTo(...a: unknown[]) { made.easeTo(...a); }
    resize() {}
    remove() {}
    setStyle() {}
  }
  class FakeMarker {
    private el = document.createElement('div');
    setLngLat() { return this; }
    setRotation() { return this; }
    addTo() { return this; }
    getElement() { return this.el; }
    remove() {}
  }
  class FakeBounds { extend() { return this; } }
  return {
    maplibregl: {
      Map: FakeMap, Marker: FakeMarker, LngLatBounds: FakeBounds,
      AttributionControl: class {}, NavigationControl: class {},
    },
    MAP_LABEL_FONT: ['Noto Sans Regular'],
  };
});

class FakeResizeObserver { observe() {} disconnect() {} }
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = FakeResizeObserver;

import { BusLiveMap } from '../BusLiveMap';

const track: LiveTrack = {
  id: 't', routeId: 'r', routeLabel: 'Route 7', direction: 'PM', label: null, status: 'planned',
  vehicle: null, driverLabel: null, progress: null, plannedStart: null, plannedEnd: null,
  lastFixAt: null, riderStopKey: 'home', shiftMs: null, shiftMeasured: false, typicalLateMs: null,
  stops: [{
    key: 'home', name: 'Corner stop', order: 1, kind: 'stop', lat: 1, lng: 1,
    plannedAt: null, arrivedAt: null, departedAt: null, projectedAt: null, passed: false,
  }],
  fixes: [], usualPath: null,
};

function mount(shown: LiveTrack = track) {
  render(
    <BusLiveMap track={shown} formatTime={(iso) => iso} darkMode={false} reducedMotion
      clockOffsetMs={0} mapStyle="simple" camera="follow" />,
  );
  act(() => { for (const h of made.handlers['style.load'] ?? []) h(); });
}

const fire = (event: string) => act(() => { for (const h of made.handlers[event] ?? []) h(); });

beforeEach(() => {
  jest.useFakeTimers();
  made.easeTo.mockClear();
});
afterEach(() => jest.useRealTimers());

describe('bus map: pan by hand', () => {
  it('pans by drag and keeps wheel, pinch, rotate and keyboard off', () => {
    mount();
    expect(made.options?.interactive).not.toBe(false);
    expect(made.options?.dragPan).toBe(true);
    for (const off of ['scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch']) {
      expect(made.options?.[off]).toBe(false);
    }
  });

  it('holds the camera after a drag, then frames the trip again', () => {
    mount();
    fire('dragstart');
    fire('dragend');
    made.easeTo.mockClear();
    act(() => { jest.advanceTimersByTime(MANUAL_HOLD_MS - CAMERA_TICK_MS); });
    expect(made.easeTo).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(2 * CAMERA_TICK_MS); });
    expect(made.easeTo).toHaveBeenCalled();
  });
});

describe('bus map: the solid line', () => {
  const M = 1 / 111_320;
  const lngLat = (x: number, y: number): [number, number] => [x * M, y * M];
  // The usual path: a road east along the equator, a point every 10 m.
  const road = Array.from({ length: 41 }, (_, i) => lngLat(i * 10, 0));
  // Today's fixes every 40 m, wandering 15 m either side of the road.
  const fixes = Array.from({ length: 9 }, (_, i) => ({
    id: `f${i}`, ts: new Date(Date.UTC(2026, 10, 2, 13, 0, i * 10)).toISOString(),
    lat: (i % 2 === 0 ? 15 : -15) * M, lng: (i * 40 + 10) * M,
    heading: 90, speed: 4, moving: true, doorOpen: false,
  }));

  it('follows the usual path, not the wobble in the fixes, and ends at the newest one', () => {
    mount({ ...track, status: 'active', lastFixAt: fixes.at(-1)!.ts, fixes, usualPath: road });
    const line = (made.data['bus-trace'] as GeoJSON.Feature<GeoJSON.LineString>).geometry.coordinates;
    expect(line.length).toBeGreaterThan(2);
    // Metres off the road (the equator) for every point but the bus's own.
    for (const [, lat] of line.slice(0, -1)) expect(Math.abs(lat! / M)).toBeLessThan(0.5);
    expect(line.at(-1)).toEqual([fixes.at(-1)!.lng, fixes.at(-1)!.lat]);
  });
});
