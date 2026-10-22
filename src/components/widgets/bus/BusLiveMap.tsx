'use client';

import { useEffect, useRef } from 'react';
import { maplibregl, MAP_LABEL_FONT, MAP_STYLE_URL } from '@/lib/map/maplibreSetup';
import {
  CATCH_UP_MS, buildPath, extrapolate, freshness, isExtrapolating, isPathDone, poseAt, speedBetween,
  type Motion, type Path, type Pose,
} from '@/lib/map/busTween';
import type { LiveTrack } from '@/lib/hooks/useBusLive';
import { SEASON_EMOJI, busMarkerDrawing, busMarkerSvg, type BusMarker } from '@/lib/map/busMarkers';
import { toCodePoint } from '@/components/ui/Emoji';

interface BusLiveMapProps {
  track: LiveTrack;
  formatTime: (iso: string) => string;
  darkMode: boolean;
  reducedMotion: boolean;
  clockOffsetMs: number;
  marker: BusMarker;
  /** 1-12, for the seasonal marker's decoration. */
  month: number;
}

/** ~30 fps is smooth for a bus and kind to a wall display's CPU. */
const FRAME_MS = 33;
const TRACE = 'bus-trace';
const STOPS = 'bus-stops';
const STOP_LABELS = 'bus-stop-labels';

/** A theme token ("222 47% 11%") as a colour MapLibre can parse. */
function themeColor(token: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(`--${token}`).trim();
  const m = raw.match(/^([\d.]+)\s+([\d.]+%)\s+([\d.]+%)$/);
  return m ? `hsl(${m[1]}, ${m[2]}, ${m[3]})` : fallback;
}

/** The marker's contents: the chosen vehicle, and for the seasonal one, its roof decoration. */
function busMarkerHtml(kind: BusMarker, month: number): string {
  const d = busMarkerDrawing(kind);
  const emoji = kind === 'seasonal' ? SEASON_EMOJI[month] : undefined;
  const roof = emoji
    ? `<img src="/twemoji/${toCodePoint(emoji)}.svg" alt="" draggable="false" style="position:absolute;left:50%;top:52%;width:14px;height:14px;transform:translate(-50%,-50%)"/>`
    : '';
  return `<div style="position:relative;width:${d.width}px;height:${d.height}px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.45))">${busMarkerSvg(kind)}${roof}</div>`;
}

function busElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', 'Bus');
  el.style.transition = 'opacity 400ms';
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
  const coordinates = track.fixes
    .filter((f) => new Date(f.ts).getTime() <= untilTs)
    .map((f) => [f.lng, f.lat]);
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

  map.addSource(TRACE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addSource(STOPS, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({
    id: TRACE, type: 'line', source: TRACE,
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': primary, 'line-width': 4, 'line-opacity': 0.6 },
  });
  map.addLayer({
    id: STOPS, type: 'circle', source: STOPS,
    paint: {
      'circle-radius': ['case', ['get', 'rider'], 7, ['get', 'school'], 6, 4.5],
      'circle-color': ['case',
        ['get', 'passed'], muted,
        ['get', 'rider'], primary,
        ['get', 'school'], school,
        background],
      'circle-stroke-color': ['case', ['get', 'passed'], muted, primary],
      'circle-stroke-width': 2,
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
 * now (see busTween). Not interactive: on a wall display a drag belongs to the
 * dashboard.
 */
export function BusLiveMap({ track, formatTime, darkMode, reducedMotion, clockOffsetMs, marker, month }: BusLiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const readyRef = useRef(false);
  const boundsRef = useRef<maplibregl.LngLatBounds | null>(null);
  const pathRef = useRef<Path | null>(null);
  const shownTsRef = useRef<number | null>(null);
  // The newest fix, as the point the marker is extrapolated from.
  const anchorRef = useRef<{ pose: Pose; motion: Motion } | null>(null);
  const frameRef = useRef<number | null>(null);
  const traceCaughtUpRef = useRef(true);
  const offsetRef = useRef(clockOffsetMs);
  offsetRef.current = clockOffsetMs;
  const trackRef = useRef(track);
  trackRef.current = track;
  const formatRef = useRef(formatTime);
  formatRef.current = formatTime;

  const setTrace = (untilTs: number) => {
    const source = mapRef.current?.getSource(TRACE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(traceFeature(trackRef.current, untilTs));
  };

  // The whole route in view. Redone when the widget resizes, since nobody can
  // pan this map and a fit made at the old size would crop the end stops.
  const fit = () => {
    const map = mapRef.current;
    if (!map || !boundsRef.current) return;
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    // Labels hang below and to both sides of their dot, so the sides and
    // bottom get more room than the top.
    const side = Math.max(40, Math.min(90, w * 0.2));
    const top = Math.max(16, Math.min(40, h * 0.08));
    map.fitBounds(boundsRef.current, {
      padding: { left: side, right: side, top, bottom: top + 16 },
      maxZoom: 15,
      duration: 0,
    });
  };

  const place = (pose: Pose) => {
    markerRef.current?.setLngLat([pose.lng, pose.lat]).setRotation(pose.heading);
  };

  // Keep the bus in view: pan only when it nears the edge, never every frame.
  const follow = (pose: Pose) => {
    const map = mapRef.current;
    if (!map) return;
    const p = map.project([pose.lng, pose.lat]);
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    const inset = Math.min(w, h) * 0.12;
    if (p.x < inset || p.y < inset || p.x > w - inset || p.y > h - inset) {
      map.easeTo({ center: [pose.lng, pose.lat], duration: reducedMotion ? 0 : 800 });
    }
  };

  // Fix times are the server's clock; the display's may drift from it.
  const serverNow = () => Date.now() + offsetRef.current;

  const nextStop = () => trackRef.current.stops.find((s) => !s.passed) ?? null;

  const guess = (): Pose | null => {
    const anchor = anchorRef.current;
    return anchor ? extrapolate(anchor.pose, anchor.motion, serverNow(), nextStop()) : null;
  };

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
          if (g) place(g);
          if (!anchorRef.current || !isExtrapolating(anchorRef.current.motion, serverNow())) {
            frameRef.current = null;
            if (g) follow(g);
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

    const latest = t.fixes[t.fixes.length - 1];
    if (!boundsRef.current && (t.stops.length > 0 || latest)) {
      const points = t.stops.map((s) => [s.lng, s.lat] as [number, number]);
      if (latest) points.push([latest.lng, latest.lat]);
      boundsRef.current = points.reduce(
        (b, p) => b.extend(p),
        new maplibregl.LngLatBounds(points[0]!, points[0]!),
      );
      fit();
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
    const end = extrapolate(anchorPose, motion, serverNow() + CATCH_UP_MS, nextStop());
    pathRef.current = {
      ...buildPath(from, [...fresh, { ts: latestTs, ...end }], shownTsRef.current, now),
      duration: reducedMotion ? 0 : CATCH_UP_MS,
    };
    // The trace stops where the marker starts, and catches up when it arrives.
    setTrace(shownTsRef.current);
    traceCaughtUpRef.current = false;
    shownTsRef.current = latestTs;
    if (reducedMotion) {
      place(guess()!);
      setTrace(latestTs);
      follow(guess()!);
    } else {
      animate();
    }
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: [0, 0],
      zoom: 1,
      interactive: false,
      attributionControl: false,
    });
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    markerRef.current = new maplibregl.Marker({
      element: busElement(),
      rotationAlignment: 'map',
      pitchAlignment: 'map',
    });
    map.on('load', () => {
      quietBasemap(map);
      addLayers(map);
      // Compact attribution starts expanded and only folds on a drag, which
      // this map never gets.
      containerRef.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
      markerRef.current!.setLngLat([0, 0]).addTo(map);
      readyRef.current = true;
      sync();
    });
    mapRef.current = map;

    // The widget resizes with the layout, not the window.
    const observer = new ResizeObserver(() => { map.resize(); fit(); });
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { sync(); }, [track]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (el) el.innerHTML = busMarkerHtml(marker, month);
  }, [marker, month]);

  // Dim the bus once its position is old enough to mislead.
  useEffect(() => {
    const el = markerRef.current?.getElement();
    if (!el) return;
    const age = freshness(track.lastFixAt ? new Date(track.lastFixAt).getTime() : null, Date.now() + clockOffsetMs);
    el.style.opacity = age === 'live' ? '1' : '0.45';
  }, [track, clockOffsetMs]);

  return (
    <>
      <style>{`
        .bus-map-dark .maplibregl-canvas-container { filter: brightness(0.72) saturate(0.55) contrast(1.08) hue-rotate(5deg); }
      `}</style>
      <div
        ref={containerRef}
        className={`h-full w-full rounded-md overflow-hidden${darkMode ? ' bus-map-dark' : ''}`}
      />
    </>
  );
}
