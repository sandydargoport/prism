'use client';

/**
 * Now & Next (#806): what is happening now and what is next today, with a live
 * countdown, read from across a room. Ten minutes before a start the next line
 * turns amber. With the bus tracker set up, a bus due within the hour gets its
 * own line with the predicted time at the stop.
 *
 * A route with a walk time (#900) also gets a leave-by line above its bus
 * line: the arrival minus the walk, amber in the last five minutes, "now" at
 * the moment, then it gives way to the bus line.
 */
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Bus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer } from './WidgetContainer';
import { Emoji } from '@/components/ui/Emoji';
import { useTimeFormat } from '@/components/providers';
import { useNow } from '@/lib/hooks/useNow';
import { isRouteVisible, useBusTracking, type BusRouteStatus } from '@/lib/hooks/useBusTracking';
import { busArrival, leaveBy } from '@/lib/bus/leaveBy';
import { todayKey, zonedWallTimeToUtc } from '@/lib/utils/zonedDate';
import { formatDisplayTime } from '@/lib/utils/timeFormat';
import { nowNext } from '@/lib/calendar/nowNext';
import type { CalendarEvent } from '@/types/calendar';

export type NowNextWidgetProps = {
  events?: CalendarEvent[];
  loading?: boolean;
  error?: string | null;
  titleHref?: string;
  /** Tests pass a fixed clock; the wall uses the real one, ticking. */
  now?: Date;
  /** Bus routes; omitted means "fetch them". Tests pass []. */
  busRoutes?: BusRouteStatus[];
};

/** Lines the strip draws, in order. */
function Line({
  label,
  title,
  detail,
  warn = false,
  testId,
  icon,
}: {
  label: string;
  title: string;
  detail: string;
  warn?: boolean;
  testId: string;
  icon?: React.ReactNode;
}) {
  return (
    <div
      data-now-next={testId}
      data-warn={warn || undefined}
      className={cn(
        'flex items-baseline gap-3 rounded-lg px-3 py-2',
        // A solid fill with its own foreground, never amber text: coloured text
        // over glass is decided by the photo behind it (#891).
        warn ? 'bg-warning text-warning-foreground' : 'text-foreground',
      )}
    >
      <span className={cn('w-14 shrink-0 text-xs font-semibold uppercase tracking-wide', !warn && 'text-muted-foreground')}>
        {label}
      </span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        {icon && <span className="self-center">{icon}</span>}
        <span className="truncate text-lg font-medium">{title}</span>
      </span>
      <span className={cn('shrink-0 text-sm tabular-nums', !warn && 'text-muted-foreground')}>{detail}</span>
    </div>
  );
}

function BusLines({ routes, now }: { routes: BusRouteStatus[]; now: Date }) {
  const t = useTranslations('nowNext');
  const { timeFormat, displayTimezone } = useTimeFormat();
  const countdown = useCountdown();
  const lines = routes.flatMap((route) => {
    const p = route.prediction;
    const leave = leaveLine(route, now, displayTimezone, countdown, t);
    if (p.status === 'at_stop') {
      return [<Line key={route.id} testId="bus" label={t('bus')} icon={<Bus aria-hidden className="h-4 w-4" />} title={route.label} detail={t('busHere')} warn />];
    }
    if (leave && !((p.status === 'in_transit' || p.status === 'cold_start') && p.etaMinutes !== null)) return [leave];
    if ((p.status === 'in_transit' || p.status === 'cold_start') && p.etaMinutes !== null) {
      const at = new Date(now.getTime() + p.etaMinutes * 60_000);
      const time = formatDisplayTime(at, timeFormat, {}, displayTimezone);
      return [
        ...(leave ? [leave] : []),
        <Line
          key={route.id}
          testId="bus"
          label={t('bus')}
          icon={<Bus aria-hidden className="h-4 w-4" />}
          title={route.label}
          detail={t('busAt', { time, countdown: countdown(Math.max(1, p.etaMinutes)) })}
          warn={p.etaMinutes <= 10}
        />,
      ];
    }
    return [];
  });
  return <>{lines}</>;
}

/** The leave-by line for a route with a walk time (#900), or null. */
function leaveLine(
  route: BusRouteStatus,
  now: Date,
  timeZone: string,
  countdown: (minutes: number) => string,
  t: ReturnType<typeof useTranslations<'nowNext'>>,
): React.ReactNode {
  if (!(route.walkMinutes && route.walkMinutes > 0)) return null;
  const p = route.prediction;
  const live = (p.status === 'in_transit' || p.status === 'cold_start') && p.etaMinutes !== null ? p.etaMinutes : null;
  // Without a live prediction, today's scheduled time, while the route is due.
  const scheduled = live === null && isRouteVisible(route, timeZone, now)
    ? zonedWallTimeToUtc(todayKey(timeZone, now), route.scheduledTime, timeZone)
    : null;
  const l = leaveBy({ arrival: busArrival({ etaMinutes: live, scheduled, now }), walkMinutes: route.walkMinutes, now });
  if (!l) return null;
  return (
    <Line
      key={`${route.id}-leave`}
      testId="bus-leave"
      label={t('leave')}
      icon={<Bus aria-hidden className="h-4 w-4" />}
      title={route.label}
      detail={l.state === 'now' ? t('leaveNow') : t('leaveIn', { countdown: countdown(l.minutes) })}
      warn={l.state !== 'later'}
    />
  );
}

function useCountdown() {
  const t = useTranslations('nowNext');
  return React.useCallback((minutes: number) => {
    if (minutes < 60) return t('minutes', { count: minutes });
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? t('hoursMinutes', { h, m }) : t('hours', { count: h });
  }, [t]);
}

function FetchedBusLines({ now }: { now: Date }) {
  const { routes } = useBusTracking();
  return <BusLines routes={routes} now={now} />;
}

export const NowNextWidget = React.memo(function NowNextWidget({
  events = [],
  loading = false,
  error = null,
  titleHref,
  now: fixedNow,
  busRoutes,
}: NowNextWidgetProps) {
  const t = useTranslations('nowNext');
  const { timeFormat, displayTimezone } = useTimeFormat();
  // Every 30 s so a minute countdown is never more than half a minute stale.
  const ticking = useNow(30_000);
  const now = fixedNow ?? ticking;
  const countdown = useCountdown();
  const state = React.useMemo(() => nowNext(events, now, displayTimezone), [events, now, displayTimezone]);
  const time = (d: Date) => formatDisplayTime(d, timeFormat, {}, displayTimezone);

  return (
    <WidgetContainer title={t('title')} icon={<Emoji e="⏱️" />} loading={loading} error={error} titleHref={titleHref}>
      <div className="flex h-full flex-col justify-center gap-1">
        {state.now.map((event) => (
          <Line
            key={event.id}
            testId="now"
            label={t('now')}
            title={event.title}
            detail={t('until', { time: time(event.endTime) })}
          />
        ))}
        {state.next && state.minutesToNext !== null && (
          <Line
            testId="next"
            label={t('next')}
            title={state.next.title}
            detail={state.warn
              ? t('startsIn', { countdown: countdown(state.minutesToNext) })
              : t('at', { time: time(state.next.startTime), countdown: countdown(state.minutesToNext) })}
            warn={state.warn}
          />
        )}
        {busRoutes ? <BusLines routes={busRoutes} now={now} /> : <FetchedBusLines now={now} />}
        {!state.next && state.now.length === 0 && (
          <p data-now-next="quiet" className="px-3 py-2 text-lg text-muted-foreground">
            {state.emptyDay ? t('noEvents') : t('nothingElse')}
          </p>
        )}
      </div>
    </WidgetContainer>
  );
});

