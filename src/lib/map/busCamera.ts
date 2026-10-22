/**
 * Where the live bus map looks. Pure, so the choice can be tested without a
 * map; BusLiveMap applies the result every few seconds.
 */

import type { BusMapCamera } from './busMapOptions';

type LngLat = [number, number];

interface CameraStop {
  key: string;
  lat: number;
  lng: number;
  passed: boolean;
}

/** How often the camera is re-aimed. */
export const CAMERA_TICK_MS = 5_000;
/** After a tap on the zoom buttons, the camera leaves the map alone this long. */
export const MANUAL_HOLD_MS = 60_000;
/** Closest the camera zooms: a few blocks around the bus. */
export const CLOSE_ZOOM = 16;

/** The points the map should frame. */
export function cameraView(
  mode: BusMapCamera,
  bus: { lat: number; lng: number } | null,
  stops: CameraStop[],
  riderStopKey: string | null,
): LngLat[] | null {
  const all: LngLat[] = stops.map((s) => [s.lng, s.lat]);
  if (bus) all.push([bus.lng, bus.lat]);
  if (all.length === 0) return null;
  if (!bus || mode === 'route') return all;

  // Follow: the bus and the stop that matters next, which is ours until the
  // bus has been there, then simply the next one.
  const rider = stops.find((s) => s.key === riderStopKey && !s.passed);
  const target = rider ?? stops.find((s) => !s.passed);
  if (!target) return all;
  return [[bus.lng, bus.lat], [target.lng, target.lat]];
}

/** Zoom in only once the frame could close in by this much (one level is twice as close). */
export const ZOOM_IN_STEP = 1;
/** A reframe glides this long, slow enough not to jolt. */
export const REFRAME_MS = 2_000;

/**
 * Whether the camera should move. Re-fitting on every tick zooms in a little
 * each time as the bus closes on the stop, which looks restless. So it waits
 * until something it frames reaches the edge `box` (screen px), or the fit
 * would be at least ZOOM_IN_STEP closer, and then moves once.
 */
export function needsReframe(
  screenPoints: [number, number][],
  box: { left: number; top: number; right: number; bottom: number },
  zoom: number,
  fitZoom: number,
): boolean {
  const outside = screenPoints.some(([x, y]) => x < box.left || x > box.right || y < box.top || y > box.bottom);
  return outside || fitZoom - zoom >= ZOOM_IN_STEP;
}
