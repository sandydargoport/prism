'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { TravelPin, TravelTrip } from '../types';
import { STATUS_CONFIG, NPS_COLOR } from '../types';
import { createPinElement, getZoomTier } from './globeMarkers';
import { buildTooltipHTML } from './globeTooltip';
import { addTripLinesLayer, buildTripFeatures, buildTripContextMap } from './globeLayers';
import { useGlobeRotation } from './useGlobeRotation';

const STYLE_LIGHT = 'https://tiles.openfreemap.org/styles/liberty';

interface TravelGlobeProps {
  pins: TravelPin[];
  trips: TravelTrip[];
  selectedPinId: string | null;
  selectedTripId: string | null;
  darkMode: boolean;
  overlayOpen: boolean;
  onPinClick: (pin: TravelPin) => void;
  onTripStopClick: (pin: TravelPin, trip: TravelTrip) => void;
  onMapClick: (lat: number, lng: number) => void;
}

export function TravelGlobe({
  pins, trips, selectedPinId, selectedTripId, darkMode, overlayOpen,
  onPinClick, onTripStopClick, onMapClick,
}: TravelGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const popupRef = useRef<maplibregl.Popup | null>(null);
  const onPinClickRef = useRef(onPinClick);
  const onTripStopClickRef = useRef(onTripStopClick);
  const onMapClickRef = useRef(onMapClick);
  const pinsRef = useRef(pins);
  const tripsRef = useRef(trips);
  const updateCullingRef = useRef<(() => void) | null>(null);
  const [zoomTier, setZoomTier] = useState(0);

  const { startRotation, stopRotation, scheduleResume, cleanup, overlayOpenRef } =
    useGlobeRotation(mapRef, overlayOpen);

  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);
  useEffect(() => { onTripStopClickRef.current = onTripStopClick; }, [onTripStopClick]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { pinsRef.current = pins; }, [pins]);
  useEffect(() => { tripsRef.current = trips; }, [trips]);

  // Initialize map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_LIGHT,
      zoom: 2.8, center: [0, 20], pitchWithRotate: false, attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');

    map.on('style.load', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any).setProjection({ type: 'globe' });
      addTripLinesLayer(map);
      if (!overlayOpenRef.current) startRotation();
    });

    map.on('zoomend', () => {
      const tier = getZoomTier(map.getZoom());
      setZoomTier((prev) => (prev !== tier ? tier : prev));
    });

    // Far-side culling — hide/fade pins behind the globe
    const updateCulling = () => {
      const { lng: cLng, lat: cLat } = map.getCenter();
      const toRad = (d: number) => (d * Math.PI) / 180;
      const cx = Math.cos(toRad(cLat)) * Math.cos(toRad(cLng));
      const cy = Math.cos(toRad(cLat)) * Math.sin(toRad(cLng));
      const cz = Math.sin(toRad(cLat));
      for (const [id, marker] of markersRef.current) {
        const pin = pinsRef.current.find((p) => p.id === id);
        if (!pin) continue;
        const px = Math.cos(toRad(pin.latitude)) * Math.cos(toRad(pin.longitude));
        const py = Math.cos(toRad(pin.latitude)) * Math.sin(toRad(pin.longitude));
        const pz = Math.sin(toRad(pin.latitude));
        const dot = cx * px + cy * py + cz * pz;
        const el = marker.getElement();
        if (dot < 0.05) {
          el.classList.add('travel-pin-hidden');
          el.style.opacity = '';
          el.style.pointerEvents = 'none';
        } else {
          el.classList.remove('travel-pin-hidden');
          const base = parseFloat(el.dataset.baseOpacity ?? '1');
          const factor = dot < 0.2 ? (dot - 0.05) / 0.15 : 1;
          el.style.opacity = String(base * factor);
          el.style.pointerEvents = '';
        }
      }
    };
    updateCullingRef.current = updateCulling;
    map.on('move', updateCulling);

    const onInteraction = () => { stopRotation(); scheduleResume(); };
    map.on('mousedown', onInteraction);
    map.on('touchstart', onInteraction);
    map.on('wheel', onInteraction);

    popupRef.current = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 14, className: 'travel-pin-popup' });
    map.on('click', (e) => {
      const lng = ((e.lngLat.lng + 180) % 360 + 360) % 360 - 180;
      onMapClickRef.current(e.lngLat.lat, lng);
    });
    mapRef.current = map;

    return () => {
      cleanup();
      markersRef.current.forEach((m) => m.remove());
      markersRef.current.clear();
      popupRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers whenever pins, trips, or zoom tier change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const zoom = map.getZoom();
    const tripCtx = buildTripContextMap(pins, trips, selectedTripId);
    const currentIds = new Set(pins.map((p) => p.id));

    for (const [id, marker] of markersRef.current) {
      if (!currentIds.has(id)) { marker.remove(); markersRef.current.delete(id); }
    }

    for (const pin of pins) {
      if (pin.latitude === 0 && pin.longitude === 0) continue;
      const isSelected = pin.id === selectedPinId;
      const ctx = tripCtx.get(pin.id);
      const { el, anchor } = createPinElement(pin, isSelected, zoom, ctx);

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        popupRef.current?.remove();
        if (pin.tripId) {
          const trip = tripsRef.current.find((t) => t.id === pin.tripId);
          if (trip) { onTripStopClickRef.current(pin, trip); return; }
        }
        onPinClickRef.current(pin);
      });
      el.addEventListener('mouseenter', () => {
        if (!map) return;
        popupRef.current?.setLngLat([pin.longitude, pin.latitude]).setHTML(buildTooltipHTML(pin, ctx)).addTo(map);
      });
      el.addEventListener('mouseleave', () => { popupRef.current?.remove(); });

      const existing = markersRef.current.get(pin.id);
      if (existing) { existing.remove(); markersRef.current.delete(pin.id); }
      el.dataset.baseOpacity = el.style.opacity || '1';
      const marker = new maplibregl.Marker({ element: el, anchor })
        .setLngLat([pin.longitude, pin.latitude])
        .addTo(map);
      markersRef.current.set(pin.id, marker);
    }
    updateCullingRef.current?.();
    // selectedTripId feeds buildTripContextMap above; without it in the deps,
    // selecting/deselecting a trip (while selectedPinId is unchanged) never
    // re-highlighted the stop markers. The sibling trip-line effects already
    // list it.
  }, [pins, trips, selectedPinId, selectedTripId, zoomTier]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trip lines — all trips rendered; active gets full style, others are faded
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('trip-lines') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    const tripFeatures: GeoJSON.Feature[] = trips.flatMap((trip) => {
      const tripStops = pins.filter((p) => p.tripId === trip.id);
      const color = trip.color || STATUS_CONFIG[trip.status].color;
      return buildTripFeatures(tripStops, trip.tripStyle, color, trip.id === selectedTripId);
    });

    const spokeFeatures: GeoJSON.Feature[] = [];
    if (selectedPinId) {
      const parent = pins.find((p) => p.id === selectedPinId);
      if (parent && !parent.tripId && (parent.latitude !== 0 || parent.longitude !== 0)) {
        const children = pins.filter((p) => p.parentId === selectedPinId && (p.latitude !== 0 || p.longitude !== 0));
        children.forEach((c) => {
          spokeFeatures.push({
            type: 'Feature' as const,
            properties: { color: c.pinType === 'national_park' ? NPS_COLOR : '#8B5CF6', active: true },
            geometry: { type: 'LineString' as const, coordinates: [[parent.longitude, parent.latitude], [c.longitude, c.latitude]] },
          });
        });
      }
    }

    source.setData({ type: 'FeatureCollection', features: [...tripFeatures, ...spokeFeatures] });
  }, [pins, trips, selectedPinId, selectedTripId]);

  // Fly to selected trip (fit bounds) or selected pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (selectedTripId) {
      const tripStops = pins.filter((p) => p.tripId === selectedTripId && (p.latitude !== 0 || p.longitude !== 0));
      if (tripStops.length === 0) return;
      const firstStop = tripStops[0]!;
      if (tripStops.length === 1) {
        map.flyTo({ center: [firstStop.longitude, firstStop.latitude], zoom: Math.max(map.getZoom(), 4), duration: 800, essential: true });
        return;
      }
      const bounds = tripStops.reduce(
        (b, p) => b.extend([p.longitude, p.latitude]),
        new maplibregl.LngLatBounds([firstStop.longitude, firstStop.latitude], [firstStop.longitude, firstStop.latitude])
      );
      map.fitBounds(bounds, { padding: 80, duration: 800, essential: true, maxZoom: 10 });
      return;
    }

    if (selectedPinId) {
      const pin = pins.find((p) => p.id === selectedPinId);
      if (!pin || (pin.latitude === 0 && pin.longitude === 0)) return;
      map.flyTo({ center: [pin.longitude, pin.latitude], zoom: Math.max(map.getZoom(), 4), duration: 800, essential: true });
    }
  }, [selectedPinId, selectedTripId, pins]);

  return (
    <>
      <style>{`
        .travel-pin-popup .maplibregl-popup-content { padding: 10px 12px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.18); border: 1px solid rgba(0,0,0,0.08); }
        .travel-pin-popup .maplibregl-popup-tip { border-top-color: white; }
        .globe-dark .maplibregl-canvas-container { filter: brightness(0.72) saturate(0.55) contrast(1.08) hue-rotate(5deg); }
        .travel-pin-hidden { opacity: 0 !important; pointer-events: none !important; visibility: hidden !important; }
      `}</style>
      <div ref={containerRef} className={`flex-1 rounded-lg overflow-hidden${darkMode ? ' globe-dark' : ''}`} />
    </>
  );
}
