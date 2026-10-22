'use client';

import { useEffect, useRef } from 'react';
import { maplibregl, MAP_LABEL_FONT } from '@/lib/map/maplibreSetup';
import { busMapStyleUrl, type BusMapCamera, type BusMapStyle } from '@/lib/map/busMapOptions';
import { CAMERA_TICK_MS, CLOSE_ZOOM, MANUAL_HOLD_MS, cameraView } from '@/lib/map/busCamera';
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
  mapStyle: BusMapStyle;
  camera: BusMapCamera;
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
 * now (see busTween). Zoom is by the + and - buttons only: on a wall display a
 * drag or pinch belongs to the dashboard.
 */
export function BusLiveMap({
  track, formatTime, darkMode, reducedMotion, clockOffsetMs, marker, month, mapStyle, camera,
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
  const offsetRef = useRef(clockOffsetMs);
  offsetRef.current = clockOffsetMs;
  const trackRef = useRef(track);
  trackRef.current = track;
  const formatRef = useRef(formatTime);
  formatRef.current = formatTime;
  const styleUrl = busMapStyleUrl(mapStyle, darkMode);
  const styleUrlRef = useRef(styleUrl);
  // Moving the camera every 10 seconds is motion a reduced-motion setting asks
  // to avoid, so alternating falls back to following.
  const cameraMode: BusMapCamera = reducedMotion && camera === 'alternate' ? 'follow' : camera;
  const cameraRef = useRef(cameraMode);
  cameraRef.current = cameraMode;
  const manualUntilRef = useRef(0);

  const setTrace = (untilTs: number) => {
    const source = mapRef.current?.getSource(TRACE) as maplibregl.GeoJSONSource | undefined;
    source?.setData(traceFeature(trackRef.current, untilTs));
  };

  /**
   * Aim the camera for the chosen mode. Bounds get room for the labels, which
   * hang below and to both sides of their dot. Skipped for a minute after a
   * tap on the zoom buttons, so a zoom by hand is not undone at once.
   */
  const aim = (animate: boolean) => {
    const map = mapRef.current;
    if (!map || !readyRef.current || Date.now() < manualUntilRef.current) return;
    const t = trackRef.current;
    const bus = anchorRef.current ? current() : null;
    const view = cameraView(cameraRef.current, Date.now(), bus, t.stops, t.riderStopKey);
    if (!view) return;
    const duration = animate && !reducedMotion ? 1000 : 0;
    if (view.kind === 'center') {
      map.easeTo({ center: view.center, zoom: CLOSE_ZOOM, duration });
      return;
    }
    const { clientWidth: w, clientHeight: h } = map.getContainer();
    // At least the bus marker's own length, so it is never half off the edge.
    const side = Math.max(48, Math.min(90, w * 0.2));
    const top = Math.max(40, Math.min(56, h * 0.1));
    const bounds = view.points.reduce(
      (b, p) => b.extend(p),
      new maplibregl.LngLatBounds(view.points[0]!, view.points[0]!),
    );
    map.fitBounds(bounds, { padding: { left: side, right: side, top, bottom: top + 16 }, maxZoom: CLOSE_ZOOM, duration });
  };

  const place = (pose: Pose) => {
    markerRef.current?.setLngLat([pose.lng, pose.lat]).setRotation(pose.heading);
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
  useEffect(() => { manualUntilRef.current = 0; aim(true); }, [cameraMode]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <div ref={containerRef} className="h-full w-full rounded-md overflow-hidden" />
  );
}
