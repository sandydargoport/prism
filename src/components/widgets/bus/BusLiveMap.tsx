'use client';

import { useEffect, useRef } from 'react';
import { useLatestRef } from '@/lib/hooks/useLatestRef';
import { maplibregl, MAP_LABEL_FONT } from '@/lib/map/maplibreSetup';
import { busMapStyleUrl, type BusMapCamera, type BusMapStyle } from '@/lib/map/busMapOptions';
import { CAMERA_TICK_MS, CLOSE_ZOOM, MANUAL_HOLD_MS, REFRAME_MS, cameraView, needsReframe } from '@/lib/map/busCamera';
import {
  CATCH_UP_MS, buildPath, extrapolate, freshness, headingDelta, isExtrapolating, isPathDone, metresAhead,
  metresBetween, poseAt, shouldHold, speedBetween, type Motion, type Path, type Pose,
} from '@/lib/map/busTween';
import type { LiveTrack } from '@/lib/hooks/useBusLive';
import { pointAlong, routeAhead, type LngLat } from '@/lib/map/routeAhead';
import { traceCoordinates } from '@/lib/map/busTrace';

interface BusLiveMapProps {
  track: LiveTrack;
  formatTime: (iso: string) => string;
  darkMode: boolean;
  reducedMotion: boolean;
  clockOffsetMs: number;
  mapStyle: BusMapStyle;
  camera: BusMapCamera;
  /** Pixels hidden by something drawn over the map's left or top edge, kept clear by the camera. */
  cover?: { left: number; top: number };
}

const NO_COVER = { left: 0, top: 0 };

/** ~30 fps is smooth for a bus and kind to a wall display's CPU. */
const FRAME_MS = 33;
const TRACE = 'bus-trace';
const AHEAD = 'bus-ahead';
const STOPS = 'bus-stops';
const STOP_LABELS = 'bus-stop-labels';
/** Going back to where the bus really is, after waiting for it, takes this long. */
const GLIDE_BACK_MS = 3_000;


/** A theme token ("222 47% 11%") as a colour MapLibre can parse. */
function themeColor(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  const m = raw.match(/^([\d.]+)\s+([\d.]+%)\s+([\d.]+%)$/);
  return m ? `hsl(${m[1]}, ${m[2]}, ${m[3]})` : fallback;
}

/**
 * The bus as a beacon: a dot in the theme colour, a soft cone showing which
 * way it is heading, and a slow pulse while it is live. The whole marker
 * turns with the heading, so the cone is drawn pointing up.
 */
function beaconHtml(color: string): string {
  const cone = `bus-cone-${Math.random().toString(36).slice(2, 8)}`;
  const dot = 'position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;box-sizing:border-box';
  return `
    <div data-pulse style="${dot};background:${color};opacity:0"></div>
    <svg viewBox="0 0 56 56" width="56" height="56" style="position:absolute;inset:0">
      <defs><linearGradient id="${cone}" x1="0" y1="1" x2="0" y2="0">
        <stop offset="0" stop-color="${color}" stop-opacity="0.5"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="M28 28 L17 4 A26 26 0 0 1 39 4 Z" fill="url(#${cone})"/>
    </svg>
    <div style="${dot};background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`;
}

function busElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', 'Bus');
  el.style.cssText = 'position:relative;width:56px;height:56px;pointer-events:none;transition:opacity 400ms';
  return el;
}

function stopFeatures(track: LiveTrack, formatTime: (iso: string) => string): GeoJSON.FeatureCollection {
  const nextKey = track.stops.find((s) => !s.passed)?.key;
  return {
    type: 'FeatureCollection',
    features: track.stops.map((s) => {
      const time = s.passed ? s.arrivedAt : s.projectedAt;
      const rider = s.key === track.riderStopKey;
      return {
        type: 'Feature',
        properties: {
          label: [s.name, time ? formatTime(time) : null].filter(Boolean).join(' · '),
          passed: s.passed,
          rider,
          school: s.kind === 'school',
          // Labels that collide are dropped in this order: ours, then the next stop.
          sort: rider ? 0 : s.key === nextKey ? 1 : 2,
        },
        geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
      };
    }),
  };
}

function traceFeature(track: LiveTrack, untilTs: number): GeoJSON.Feature {
  const coordinates = traceCoordinates(track.fixes, track.stops, untilTs);
  return { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } };
}

/** Shop, transit and other point-of-interest icons only compete with the stops. */
function quietBasemap(map: maplibregl.Map) {
  for (const layer of map.getStyle().layers ?? []) {
    if (layer.type === 'symbol' && /poi|transit/.test(layer.id)) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  }
}

function addLayers(map: maplibregl.Map) {
  const primary = themeColor('primary', '#2563eb');
  const muted = themeColor('muted-foreground', '#94a3b8');
  const school = themeColor('warning', '#d97706');
  const background = themeColor('background', '#ffffff');
  const foreground = themeColor('foreground', '#0f172a');

  map.addSource(AHEAD, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource(TRACE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  // Dashed and lighter: the road still to come, never a reported position.
  map.addLayer({
    id: AHEAD, type: 'line', source: AHEAD,
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: { 'line-color': primary, 'line-width': 3, 'line-opacity': 0.55, 'line-dasharray': [2, 1.5] },
  });
  map.addSource(STOPS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: TRACE, type: 'line', source: TRACE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': primary, 'line-width': 4, 'line-opacity': 0.6 },
  });
  map.addLayer({
    id: STOPS, type: 'circle', source: STOPS,
    paint: {
      // Our stop is a thick ring, never a filled dot: the filled dot is the bus.
      'circle-radius': ['case', ['get', 'rider'], 6, ['get', 'school'], 6, 4.5],
      'circle-color': ['case',
        ['get', 'passed'], muted,
        ['get', 'school'], school,
        background],
      'circle-stroke-color': ['case', ['get', 'passed'], muted, primary],
      'circle-stroke-width': ['case', ['get', 'rider'], 3.5, 2],
    },
  });
  map.addLayer({
    id: STOP_LABELS, type: 'symbol', source: STOPS,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': MAP_LABEL_FONT,
      'text-size': ['case', ['get', 'rider'], 12, 11],
      'text-anchor': 'top',
      'text-offset': [0, 0.9],
      'symbol-sort-key': ['get', 'sort'],
    },
    paint: {
      'text-color': ['case', ['get', 'passed'], muted, foreground],
      'text-halo-color': background,
      'text-halo-width': 1.5,
    },
  });
}

/**
 * Today's trip on a map: the trace so far, each stop labelled with its actual
 * (passed) or projected (upcoming) time, and the bus where it most likely is
 * now (see busTween). Zoom is by the + and - buttons only: on a wall display a
 * drag or pinch belongs to the dashboard.
 */
export function BusLiveMap({
  track, formatTime, darkMode, reducedMotion, clockOffsetMs, mapStyle, camera, cover = NO_COVER,
}: BusLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const readyRef = useRef(false);
  const aimedRef = useRef(false);
  const pathRef = useRef<Path | null>(null);
  const shownTsRef = useRef<number | null>(null);
  // The newest fix, as the point the marker is extrapolated from.
  const anchorRef = useRef<{ pose: Pose; motion: Motion } | null>(null);
  const frameRef = useRef<number | null>(null);
  const traceCaughtUpRef = useRef(true);
  // The latest props, for the map's own callbacks and timers.
  const offsetRef = useLatestRef(clockOffsetMs);
  const trackRef = useLatestRef(track);
  const formatRef = useLatestRef(formatTime);
  const styleUrl = busMapStyleUrl(mapStyle, darkMode);
  const styleUrlRef = useRef(styleUrl);
  const cameraRef = useLatestRef(camera);
  const coverRef = useLatestRef(cover);
  const manualUntilRef = useRef(0);
  // Where the marker is drawn, and since when it has been waiting for the bus.
  const shownRef = useRef<Pose | null>(null);
  const heldSinceRef = useRef<number | null>(null);
  const pulseRef = useRef<Animation | null>(null);

  const setTrace = (untilTs: number) => {
    const source = mapRef.current?.getSource(TRACE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(traceFeature(trackRef.current, untilTs));
  };

  /** The dashed road ahead as last drawn, which the camera also frames. */
  const aheadLineRef = useRef<LngLat[] | null>(null);

  /**
   * Aim the camera for the chosen mode. Bounds get room for the labels, which
   * hang below and to both sides of their dot. Skipped for a minute after a
   * tap on the zoom buttons, so a zoom by hand is not undone at once. Unless
   * forced, it moves only when needsReframe says so, then glides there.
   */
  const aim = (animate: boolean, force = !animate) => {
    const map = mapRef.current;
    // aim runs only from effects, timers, the resize observer and the map's
    // own callbacks, never while rendering; the compiler cannot follow those
    // calls, through sync() in particular.
    // eslint-disable-next-line react-hooks/purity
    if (!map || !readyRef.current || Date.now() < manualUntilRef.current) return;
    const t = trackRef.current;
    const bus = anchorRef.current ? current() : null;
    const points = cameraView(cameraRef.current, bus, t.stops, t.riderStopKey, aheadLineRef.current);
    if (!points) return;
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    // At least the bus marker's own length, so it is never half off the edge.
    const side = Math.max(48, Math.min(90, w * 0.2));
    const top = Math.max(40, Math.min(56, h * 0.1));
    const bounds = points.reduce(
      (b, p) => b.extend(p),
      new maplibregl.LngLatBounds(points[0]!, points[0]!),
    );
    const bottom = top + 16;
    const { left: coverLeft, top: coverTop } = coverRef.current;
    const left = side + coverLeft;
    const topPad = top + coverTop;
    const fit = map.cameraForBounds(bounds, { padding: { left, right: side, top: topPad, bottom }, maxZoom: CLOSE_ZOOM });
    if (!fit) return;
    const zoom = fit.zoom ?? map.getZoom();
    if (!force) {
      const screen = points.map((p) => { const q = map.project(p); return [q.x, q.y] as [number, number]; });
      // Half the padding: the bus may drift into the margin before the camera follows.
      // Nothing gets the margin's grace under the cover: hidden is out of view.
      const box = { left: coverLeft + side / 2, top: coverTop + top / 2, right: w - side / 2, bottom: h - bottom / 2 };
      if (!needsReframe(screen, box, map.getZoom(), zoom)) return;
    }
    map.easeTo({ center: fit.center, zoom, duration: animate && !reducedMotion ? REFRAME_MS : 0 });
  };

  /**
   * The road ahead, from the newest reported position, which is where the
   * solid line ends: the dashes fill the stretch the marker is only guessing
   * at, and the solid line eats them as positions arrive. Redrawn only when
   * that position or the stops change, never as the marker moves.
   */
  const drawAhead = () => {
    const anchor = anchorRef.current;
    const t = trackRef.current;
    const line = anchor
      ? routeAhead(t.usualPath, t.stops, t.riderStopKey, [anchor.pose.lng, anchor.pose.lat], anchor.pose.heading)
      : null;
    aheadLineRef.current = line && line.length >= 2 ? line : null;
    (mapRef.current?.getSource(AHEAD) as maplibregl.GeoJSONSource | undefined)?.setData(aheadLineRef.current
      ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: aheadLineRef.current } }
      : { type: 'FeatureCollection', features: [] });
  };

  const place = (pose: Pose) => {
    shownRef.current = pose;
    markerRef.current?.setLngLat([pose.lng, pose.lat]).setRotation(pose.heading);
  };

  /**
   * Place the marker at a guess, but never step it backwards (see
   * shouldHold): wait for the bus to come level, and if it has not by the
   * end of the wait, glide back rather than jump.
   */
  const placeForward = (target: Pose) => {
    const shown = shownRef.current;
    const now = Date.now();
    if (shown && shouldHold(shown, target, heldSinceRef.current, now)) {
      heldSinceRef.current ??= now;
      return;
    }
    const waited = heldSinceRef.current !== null;
    heldSinceRef.current = null;
    if (waited && shown && !reducedMotion && metresAhead(shown, target) < 0
      && Math.abs(headingDelta(shown.heading, target.heading)) <= 120) {
      // Still facing the way it was going, so it backs up rather than turns round.
      pathRef.current = { points: [shown, { ...target, heading: shown.heading }], at: [0, 1], start: now, duration: GLIDE_BACK_MS };
      return;
    }
    place(target);
  };

  // Fix times are the server's clock; the display's may drift from it.
  const serverNow = () => Date.now() + offsetRef.current;

  const nextStop = () => trackRef.current.stops.find((s) => !s.passed) ?? null;

  /**
   * Where the bus most likely is at `at`: as far on as `extrapolate` says,
   * but along the dashed road ahead, so it turns where the road turns.
   */
  const guessAt = (at: number): Pose | null => {
    const anchor = anchorRef.current;
    if (!anchor) return null;
    const straight = extrapolate(anchor.pose, anchor.motion, at, nextStop());
    const line = aheadLineRef.current;
    const m = metresBetween(anchor.pose, straight);
    if (!line || m < 1) return straight;
    const { point, heading } = pointAlong(line, m);
    return { lng: point[0], lat: point[1], heading };
  };
  const guess = () => guessAt(serverNow());

  /** Where the marker is drawn right now. */
  const current = (): Pose => {
    const now = Date.now();
    if (pathRef.current && !isPathDone(pathRef.current, now)) return poseAt(pathRef.current, now);
    const g = guess();
    if (g) return g;
    const lngLat = markerRef.current!.getLngLat();
    return { lat: lngLat.lat, lng: lngLat.lng, heading: markerRef.current!.getRotation() };
  };

  const animate = () => {
    if (reducedMotion) return;
    let last = 0;
    const step = (t: number) => {
      if (t - last >= FRAME_MS) {
        last = t;
        const now = Date.now();
        const path = pathRef.current;
        if (path && !isPathDone(path, now)) {
          place(poseAt(path, now));
        } else {
          if (!traceCaughtUpRef.current) {
            // The trace catches up once the marker has passed the new fixes.
            traceCaughtUpRef.current = true;
            setTrace(shownTsRef.current ?? serverNow());
          }
          const g = guess();
          if (g) placeForward(g);
          const waiting = heldSinceRef.current !== null || (pathRef.current !== null && !isPathDone(pathRef.current, Date.now()));
          if (!waiting && (!anchorRef.current || !isExtrapolating(anchorRef.current.motion, serverNow()))) {
            frameRef.current = null;
            return;
          }
        }
      }
      frameRef.current = requestAnimationFrame(step);
    };
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(step);
  };

  const sync = () => {
    const map = mapRef.current;
    const t = trackRef.current;
    if (!map || !readyRef.current) return;
    (map.getSource(STOPS) as maplibregl.GeoJSONSource | undefined)?.setData(stopFeatures(t, formatRef.current));
    drawAhead();

    const latest = t.fixes[t.fixes.length - 1];
    if (!aimedRef.current && (t.stops.length > 0 || latest)) {
      aimedRef.current = true;
      // Placed first so the first view can include the bus.
      if (latest) {
        anchorRef.current ??= { pose: { lat: latest.lat, lng: latest.lng, heading: latest.heading ?? 0 }, motion: { ts: new Date(latest.ts).getTime(), speed: null } };
      }
      aim(false);
    }
    if (!latest) return;

    const latestTs = new Date(latest.ts).getTime();
    const previous = t.fixes[t.fixes.length - 2];
    const motion: Motion = {
      ts: latestTs,
      speed: latest.speed ?? (previous
        ? speedBetween({ ts: new Date(previous.ts).getTime(), lat: previous.lat, lng: previous.lng }, { ts: latestTs, lat: latest.lat, lng: latest.lng })
        : null),
      moving: latest.moving,
      doorOpen: latest.doorOpen,
    };

    if (shownTsRef.current === null) {
      // First sight of the bus: put it where it most likely is, do not replay the day.
      anchorRef.current = { pose: { lat: latest.lat, lng: latest.lng, heading: latest.heading ?? 0 }, motion };
      shownTsRef.current = latestTs;
      setTrace(latestTs);
      drawAhead();
      place(guess()!);
      animate();
      return;
    }
    if (latestTs <= shownTsRef.current) return;

    const fresh = t.fixes
      .filter((f) => new Date(f.ts).getTime() > shownTsRef.current!)
      .map((f) => ({ ts: new Date(f.ts).getTime(), lat: f.lat, lng: f.lng, heading: f.heading }));
    const now = Date.now();
    const from = current();
    // Through every new fix, then on to where the bus will most likely be
    // when the catch-up ends, so the hand-over to extrapolating is seamless.
    const through = buildPath(from, fresh, shownTsRef.current, now);
    const anchorPose = through.points[through.points.length - 1]!;
    anchorRef.current = { pose: anchorPose, motion };
    drawAhead();
    const end = guessAt(serverNow() + CATCH_UP_MS)!;
    if (!reducedMotion && shouldHold(from, end, heldSinceRef.current, now)) {
      // The marker is already ahead of where the bus will be: wait for it there.
      heldSinceRef.current ??= now;
      pathRef.current = null;
      shownTsRef.current = latestTs;
      setTrace(latestTs);
      animate();
      return;
    }
    heldSinceRef.current = null;
    // Fixes the marker has already passed would only pull it back and forth.
    const ahead = fresh.filter((f) => metresAhead(from, f) > 0);
    pathRef.current = {
      ...buildPath(from, [...ahead, { ts: latestTs, ...end }], shownTsRef.current, now),
      duration: reducedMotion ? 0 : CATCH_UP_MS,
    };
    // The trace stops where the marker starts, and catches up when it arrives.
    setTrace(shownTsRef.current);
    traceCaughtUpRef.current = false;
    shownTsRef.current = latestTs;
    if (reducedMotion) {
      place(guess()!);
      setTrace(latestTs);
    } else {
      animate();
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [0, 0],
      zoom: 1,
      interactive: false,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // A tap on + or - is someone looking closer: hold the camera for a while.
    containerRef.current.querySelectorAll('.maplibregl-ctrl-zoom-in, .maplibregl-ctrl-zoom-out').forEach((button) => {
      button.addEventListener('click', () => { manualUntilRef.current = Date.now() + MANUAL_HOLD_MS; });
    });
    markerRef.current = new maplibregl.Marker({
      element: busElement(),
      rotationAlignment: 'map',
      pitchAlignment: 'map',
    });
    // Runs on the first style and again whenever the style is swapped (light
    // to dark, simple to detailed), which drops every layer we added.
    // Compact attribution opens on every style load and only folds on a drag,
    // which this map never gets, so fold it whenever the map settles.
    map.on('idle', () => {
      containerRef.current?.querySelector('.maplibregl-ctrl-attrib.maplibregl-compact-show')
        ?.classList.remove('maplibregl-compact-show');
    });
    map.on('style.load', () => {
      quietBasemap(map);
      addLayers(map);
      if (!markerRef.current!.getElement().isConnected) markerRef.current!.setLngLat([0, 0]).addTo(map);
      readyRef.current = true;
      sync();
      if (shownTsRef.current !== null) setTrace(shownTsRef.current);
    });
    mapRef.current = map;

    // The widget resizes with the layout, not the window.
    const observer = new ResizeObserver(() => { map.resize(); aim(false); });
    observer.observe(containerRef.current);
    const tick = setInterval(() => aim(true), CAMERA_TICK_MS);

    return () => {
      observer.disconnect();
      clearInterval(tick);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sync(); }, [track]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const map = mapRef.current;
    if (!map || styleUrl === styleUrlRef.current) return;
    styleUrlRef.current = styleUrl;
    readyRef.current = false;
    map.setStyle(styleUrl);
  }, [styleUrl]);

  // A new camera choice shows at once rather than at the next tick.
  useEffect(() => { manualUntilRef.current = 0; aim(true, true); }, [camera]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { aim(true); }, [cover.left, cover.top]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drawn again when the theme changes, so the beacon matches it.
  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (!el) return;
    el.innerHTML = beaconHtml(themeColor('primary', '#2563eb'));
    pulseRef.current?.cancel();
    pulseRef.current = reducedMotion ? null : el.querySelector('[data-pulse]')?.animate(
      [{ transform: 'scale(1)', opacity: 0.45 }, { transform: 'scale(3)', opacity: 0 }],
      { duration: 2000, iterations: Infinity, easing: 'ease-out' },
    ) ?? null;
    return () => pulseRef.current?.cancel();
  }, [darkMode, reducedMotion]);

  // Dim the bus once its position is old enough to mislead.
  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (!el) return;
    const age = freshness(track.lastFixAt ? new Date(track.lastFixAt).getTime() : null, Date.now() + clockOffsetMs);
    el.style.opacity = age === 'live' ? '1' : '0.45';
    // A pulse says "live"; an old position should not claim it.
    if (age === 'live') pulseRef.current?.play();
    else pulseRef.current?.pause();
  }, [track, clockOffsetMs]);

  return (
    <div ref={containerRef} className="h-full w-full rounded-md overflow-hidden" />
  );
}
