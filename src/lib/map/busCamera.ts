/**
 * Where the live bus map looks. Pure, so the choice can be tested without a
 * map; BusLiveMap applies the result every few seconds.
 */

import type { BusMapCamera } from './busMapOptions';

type LngLat = [number, number];

export type CameraView =
  | { kind: 'bounds'; points: LngLat[] }
  | { kind: 'center'; center: LngLat; zoom: number };

interface CameraStop {
  key: string;
  lat: number;
  lng: number;
  passed: boolean;
}

/** How often the camera is re-aimed. */
export const CAMERA_TICK_MS = 5_000;
/** Each half of the alternating view. */
export const ALTERNATE_MS = 10_000;
/** After a tap on the zoom buttons, the camera leaves the map alone this long. */
export const MANUAL_HOLD_MS = 60_000;
/** Close-up zoom: a few blocks around the bus. */
export const CLOSE_ZOOM = 16;

export function alternatePhase(now: number): 'close' | 'overview' {
  return Math.floor(now / ALTERNATE_MS) % 2 === 0 ? 'close' : 'overview';
}

export function cameraView(
  mode: BusMapCamera,
  now: number,
  bus: { lat: number; lng: number } | null,
  stops: CameraStop[],
  riderStopKey: string | null,
): CameraView | null {
  const all: LngLat[] = stops.map((s) => [s.lng, s.lat]);
  if (bus) all.push([bus.lng, bus.lat]);
  if (all.length === 0) return null;
  const route: CameraView = { kind: 'bounds', points: all };
  if (!bus || mode === 'route') return route;

  if (mode === 'alternate') {
    return alternatePhase(now) === 'close'
      ? { kind: 'center', center: [bus.lng, bus.lat], zoom: CLOSE_ZOOM }
      : route;
  }

  // Follow: the bus and the stop that matters next, which is ours until the
  // bus has been there, then simply the next one.
  const rider = stops.find((s) => s.key === riderStopKey && !s.passed);
  const target = rider ?? stops.find((s) => !s.passed);
  if (!target) return route;
  return { kind: 'bounds', points: [[bus.lng, bus.lat], [target.lng, target.lat]] };
}
