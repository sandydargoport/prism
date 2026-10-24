'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useTheme, useTimeFormat } from '@/components/providers';
import { useShouldSkipMotion } from '@/lib/hooks/useShouldSkipMotion';
import { formatDisplayTime } from '@/lib/utils/timeFormat';
import { freshness } from '@/lib/map/busTween';
import type { LiveTrack } from '@/lib/hooks/useBusLive';
import type { BusMapCamera, BusMapStyle } from '@/lib/map/busMapOptions';

const BusLiveMap = dynamic(() => import('./BusLiveMap').then((m) => m.BusLiveMap), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-md bg-muted/40" />,
});

type Layout = 'map' | 'small';

/** Below this a map is too cramped beside its card to show anything useful. */
const MIN_MAP_W = 200;
const MIN_MAP_H = 240;

/** From this size the card has room for the bus, driver and stop rows too. */
const ROOMY_W = 480;
const ROOMY_H = 360;

/** The map fills the widget with the panel as a card over it; small has no room for a map. */
export function chooseLayout(width: number, height: number): Layout {
  return width >= MIN_MAP_W && height >= MIN_MAP_H ? 'map' : 'small';
}

/**
 * The part of the map the card hides, for the camera to keep clear: the card
 * sits in the top-left corner, so it is the cheaper of a band down the left
 * or a band across the top.
 */
export function cardCover(
  card: { width: number; height: number },
  map: { width: number; height: number },
): { left: number; top: number } {
  if (map.width <= 0 || map.height <= 0) return { left: 0, top: 0 };
  return card.width / map.width < card.height / map.height
    ? { left: card.width, top: 0 }
    : { left: 0, top: card.height };
}

const MS_PER_MIN = 60_000;

export function lateness(shiftMs: number | null): string | null {
  if (shiftMs === null) return null;
  const min = Math.round(shiftMs / MS_PER_MIN);
  if (min === 0) return 'On time';
  return min > 0 ? `${min} min late` : `${-min} min early`;
}

export function formatSpeed(metresPerSecond: number, unit: 'mph' | 'km/h'): string {
  const value = unit === 'mph' ? metresPerSecond * 2.23694 : metresPerSecond * 3.6;
  return `${Math.round(value)} ${unit}`;
}

function formatAge(ms: number): string {
  if (ms < MS_PER_MIN) return `${Math.max(0, Math.round(ms / 1000))}s`;
  return `${Math.round(ms / MS_PER_MIN)} min`;
}

interface BusLiveViewProps {
  track: LiveTrack;
  speedUnit: 'mph' | 'km/h';
  clockOffsetMs: number;
  mapStyle: BusMapStyle;
  camera: BusMapCamera;
}

/** A live trip in the bus widget: the map with a card over it, or the panel alone when small. */
export function BusLiveView({ track, speedUnit, clockOffsetMs, mapStyle, camera }: BusLiveViewProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState<Layout>('small');
  const [roomy, setRoomy] = React.useState(false);
  const [cover, setCover] = React.useState({ left: 0, top: 0 });
  const { timeFormat, displayTimezone } = useTimeFormat();
  const { resolvedTheme } = useTheme();
  const reducedMotion = useShouldSkipMotion();

  // Ticks the "in N min" and "updated Ns ago" text between polls. A poll that
  // lands between ticks is up to one tick behind, and ages are floored at 0s.
  const [now, setNow] = React.useState(() => Date.now() + clockOffsetMs);
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + clockOffsetMs), 5_000);
    return () => clearInterval(id);
  }, [clockOffsetMs]);

  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      setLayout(chooseLayout(el.clientWidth, el.clientHeight));
      setRoomy(el.clientWidth >= ROOMY_W && el.clientHeight >= ROOMY_H);
      const card = cardRef.current;
      setCover(card
        ? cardCover({ width: card.offsetLeft + card.offsetWidth, height: card.offsetTop + card.offsetHeight },
          { width: el.clientWidth, height: el.clientHeight })
        : { left: 0, top: 0 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [layout]);

  const formatTime = React.useCallback(
    (iso: string) => formatDisplayTime(new Date(iso), timeFormat, {}, displayTimezone),
    [timeFormat, displayTimezone],
  );

  if (layout === 'small') {
    return (
      <div ref={rootRef} className="flex-1 w-full min-h-0 flex">
        <BusLivePanel track={track} speedUnit={speedUnit} now={now} formatTime={formatTime} className="flex-1" />
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative flex-1 w-full min-h-0">
      <div className="absolute inset-0">
        <BusLiveMap
          track={track}
          formatTime={formatTime}
          darkMode={resolvedTheme === 'dark'}
          reducedMotion={reducedMotion}
          clockOffsetMs={clockOffsetMs}
          mapStyle={mapStyle}
          camera={camera}
          cover={cover}
        />
      </div>
      {/* Clear of the zoom buttons (top right) and the map credit (bottom left). */}
      <div
        ref={cardRef}
        className={cn(
          'absolute left-2 top-2 z-10 rounded-md border border-border bg-card/90 px-3 py-2 shadow-sm backdrop-blur-sm',
          roomy ? 'w-60' : 'max-w-[calc(100%-4rem)]',
        )}
      >
        <BusLivePanel
          track={track}
          speedUnit={speedUnit}
          now={now}
          formatTime={formatTime}
          detail={roomy}
        />
      </div>
    </div>
  );
}

/** Which rows the card over the map keeps: how late, how fresh, how far along, and what the bus is doing. */
const CARD_ROWS = new Set(['Running', 'Updated', 'Stops', 'Now']);

/**
 * How far along the route the bus is: the provider's count over its whole
 * route when it sends one ("14 of 22"), else the passed stops of the track.
 */
export function stopProgress(track: Pick<LiveTrack, 'progress' | 'stops'>): string | null {
  const p = track.progress;
  if (p && p.totalStops > 0) return `${p.lastVisitedStop} of ${p.totalStops}`;
  if (track.stops.length === 0) return null;
  return `${track.stops.filter((s) => s.passed).length} of ${track.stops.length}`;
}

export function BusLivePanel({
  track, speedUnit, now, formatTime, className, detail = true,
}: {
  track: LiveTrack;
  speedUnit: 'mph' | 'km/h';
  now: number;
  formatTime: (iso: string) => string;
  className?: string;
  /** Every row; without it only CARD_ROWS, for a small card over the map. */
  detail?: boolean;
}) {
  const rider = track.stops.find((s) => s.key === track.riderStopKey) ?? null;
  const next = track.stops.find((s) => !s.passed) ?? null;
  const latest = track.fixes[track.fixes.length - 1] ?? null;
  const lastFixMs = track.lastFixAt ? new Date(track.lastFixAt).getTime() : null;
  const age = freshness(lastFixMs, now);
  const late = lateness(track.shiftMs);
  const v = track.vehicle;

  let headline: React.ReactNode = null;
  if (rider?.passed && rider.arrivedAt) {
    headline = (
      <>
        <div className="text-xs text-muted-foreground truncate">{rider.name ?? 'Your stop'}</div>
        <div className="text-lg font-semibold leading-tight">Arrived {formatTime(rider.arrivedAt)}</div>
      </>
    );
  } else if (rider?.projectedAt) {
    const minutes = Math.max(0, Math.round((new Date(rider.projectedAt).getTime() - now) / MS_PER_MIN));
    headline = (
      <>
        <div className="text-xs text-muted-foreground truncate">{rider.name ?? 'Your stop'}</div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold leading-tight tabular-nums">{formatTime(rider.projectedAt)}</span>
          <span className="text-sm text-muted-foreground">{minutes === 0 ? 'now' : `in ${minutes} min`}</span>
        </div>
      </>
    );
  }

  const rows: [string, React.ReactNode][] = [];
  if (late) rows.push(['Running', late]);
  // High in the list, beside how late it is: how fresh the position is
  // decides how far to trust everything else, so it is never the row dropped.
  if (lastFixMs === null) {
    rows.push(['Updated', 'No position yet']);
  } else if (age === 'live') {
    rows.push(['Updated', `${formatAge(now - lastFixMs)} ago`]);
  } else {
    // Same short label as when live, so it fits the narrow layout; the colour says it is old.
    rows.push(['Updated', <span key="seen" className="text-warning">{formatAge(now - lastFixMs)} ago</span>]);
  }
  if (next && next.key !== rider?.key) {
    rows.push(['Next', `${next.name ?? 'Stop'}${next.projectedAt ? ` · ${formatTime(next.projectedAt)}` : ''}`]);
  }
  const progress = stopProgress(track);
  if (progress) rows.push(['Stops', progress]);
  const bus = [v?.number && `Bus ${v.number}`, v?.color].filter(Boolean).join(' · ');
  if (bus) rows.push(['Bus', bus]);
  if (track.driverLabel) {
    const notes = [v?.substitute && 'substitute', v?.changedMidDay && 'changed today'].filter(Boolean).join(', ');
    rows.push(['Driver', notes ? `${track.driverLabel} (${notes})` : track.driverLabel]);
  }
  if (latest && age === 'live') {
    const moving = latest.speed !== null && latest.speed > 0.5;
    const motion = moving ? formatSpeed(latest.speed!, speedUnit) : 'Stopped';
    rows.push(['Now', latest.doorOpen ? `${motion} · doors open` : motion]);
  }

  const shown = detail ? rows : rows.filter(([label]) => CARD_ROWS.has(label));

  return (
    <div className={cn('min-h-0 min-w-0 flex flex-col gap-2 overflow-hidden', className)}>
      {headline && <div className="space-y-0.5 shrink-0">{headline}</div>}
      {/* Rows run most to least useful. In one column they wrap rather than
          clip: a row that does not fit moves to a second column, out of
          sight, so a short widget drops whole rows from the end. */}
      <dl className="text-xs min-h-0 overflow-hidden gap-y-1 flex flex-col flex-wrap content-start">
        {shown.map(([label, value]) => (
          <div key={label} className="flex w-full min-w-0 gap-3">
            <dt className="shrink-0 text-muted-foreground w-14">{label}</dt>
            <dd className="min-w-0 truncate">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * One line for a live trip, for the phone card and tile: your stop's time and
 * how far off, or when it was reached.
 */
export function LiveBusSummary({ track, className }: { track: LiveTrack; className?: string }) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const rider = track.stops.find((s) => s.key === track.riderStopKey);
  const time = (iso: string) => formatDisplayTime(new Date(iso), timeFormat, {}, displayTimezone);
  let text = 'Bus is moving';
  if (rider?.passed && rider.arrivedAt) {
    text = `${rider.name ?? 'Your stop'}: arrived ${time(rider.arrivedAt)}`;
  } else if (rider?.projectedAt) {
    const minutes = Math.max(0, Math.round((new Date(rider.projectedAt).getTime() - now) / MS_PER_MIN));
    const late = lateness(track.shiftMs);
    text = [
      `${rider.name ?? 'Your stop'} ${time(rider.projectedAt)}`,
      minutes === 0 ? 'now' : `in ${minutes} min`,
      late && late !== 'On time' ? late : null,
    ].filter(Boolean).join(' · ');
  }
  return <span className={className}>{text}</span>;
}
