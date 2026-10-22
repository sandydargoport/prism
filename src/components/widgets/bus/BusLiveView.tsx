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

type Layout = 'wide' | 'tall' | 'small';

const TWO_COLUMN_PX = 380;

/** Below this a map is a strip that shows nothing useful. */
const MIN_MAP_PX = 160;

/** Wide puts the panel beside the map, tall under it; small has no room for a map. */
export function chooseLayout(width: number, height: number): Layout {
  if (height < MIN_MAP_PX) return 'small';
  if (width >= 440 && width >= height * 1.15) return 'wide';
  if (height >= 300 && width >= 180) return 'tall';
  return 'small';
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

/** A live trip in the bus widget: map and panel, laid out to fit the widget. */
export function BusLiveView({ track, speedUnit, clockOffsetMs, mapStyle, camera }: BusLiveViewProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState<Layout>('small');
  // Two columns of rows under a tall map, only when each still fits its value.
  const [twoColumn, setTwoColumn] = React.useState(false);
  const { timeFormat, displayTimezone } = useTimeFormat();
  const { resolvedTheme } = useTheme();
  const reducedMotion = useShouldSkipMotion();

  // Ticks the "in N min" and "updated Ns ago" text between polls.
  const [now, setNow] = React.useState(() => Date.now() + clockOffsetMs);
  React.useEffect(() => {
    setNow(Date.now() + clockOffsetMs);
    const id = setInterval(() => setNow(Date.now() + clockOffsetMs), 5_000);
    return () => clearInterval(id);
  }, [clockOffsetMs, track]);

  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      setLayout(chooseLayout(el.clientWidth, el.clientHeight));
      setTwoColumn(el.clientWidth >= TWO_COLUMN_PX);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const formatTime = React.useCallback(
    (iso: string) => formatDisplayTime(new Date(iso), timeFormat, {}, displayTimezone),
    [timeFormat, displayTimezone],
  );

  return (
    <div
      ref={rootRef}
      className={cn('flex-1 w-full min-h-0 flex gap-3', layout === 'tall' ? 'flex-col' : 'flex-row')}
    >
      {layout !== 'small' && (
        <div className={cn('min-h-0 min-w-0', layout === 'wide' ? 'flex-[3]' : 'flex-1')}>
          <BusLiveMap
            track={track}
            formatTime={formatTime}
            darkMode={resolvedTheme === 'dark'}
            reducedMotion={reducedMotion}
            clockOffsetMs={clockOffsetMs}
            mapStyle={mapStyle}
            camera={camera}
          />
        </div>
      )}
      <BusLivePanel
        track={track}
        speedUnit={speedUnit}
        now={now}
        formatTime={formatTime}
        className={layout === 'wide' ? 'flex-[2] min-w-[170px]' : 'shrink-0'}
        twoColumn={layout === 'tall' && twoColumn}
        roomy={layout === 'wide'}
      />
    </div>
  );
}

function BusLivePanel({
  track, speedUnit, now, formatTime, className, twoColumn, roomy,
}: {
  track: LiveTrack;
  speedUnit: 'mph' | 'km/h';
  now: number;
  formatTime: (iso: string) => string;
  className?: string;
  twoColumn: boolean;
  /** Wide enough for the longer row labels. */
  roomy: boolean;
}) {
  const rider = track.stops.find((s) => s.key === track.riderStopKey) ?? null;
  const next = track.stops.find((s) => !s.passed) ?? null;
  const passedCount = track.stops.filter((s) => s.passed).length;
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
  if (track.stops.length > 0) rows.push(['Stops', `${passedCount} of ${track.stops.length}`]);
  const bus = [v?.number && `Bus ${v.number}`, v?.color].filter(Boolean).join(' · ');
  if (bus) rows.push(['Bus', bus]);
  if (track.driverLabel) {
    const notes = [v?.substitute && 'substitute', v?.changedMidDay && 'changed today'].filter(Boolean).join(', ');
    rows.push([roomy ? 'Today\'s driver' : 'Driver', notes ? `${track.driverLabel} (${notes})` : track.driverLabel]);
  }
  if (latest && age === 'live') {
    const moving = latest.speed !== null && latest.speed > 0.5;
    const motion = moving ? formatSpeed(latest.speed!, speedUnit) : 'Stopped';
    rows.push(['Now', latest.doorOpen ? `${motion} · doors open` : motion]);
  }

  return (
    <div className={cn('min-h-0 min-w-0 flex flex-col gap-2 overflow-hidden', className)}>
      {headline && <div className="space-y-0.5 shrink-0">{headline}</div>}
      {/* Rows run most to least useful. In one column they wrap rather than
          clip: a row that does not fit moves to a second column, out of
          sight, so a short widget drops whole rows from the end. */}
      <dl className={cn(
        'text-xs min-h-0 overflow-hidden gap-y-1',
        twoColumn ? 'grid grid-cols-2 gap-x-4' : 'flex flex-col flex-wrap content-start',
      )}>
        {rows.map(([label, value]) => (
          <div key={label} className="flex w-full min-w-0 gap-3">
            <dt className={cn('shrink-0 text-muted-foreground', roomy ? 'w-24' : 'w-12')}>{label}</dt>
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
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, [track]);

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
