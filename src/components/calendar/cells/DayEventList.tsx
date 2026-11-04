'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';
import { useCardCapacity } from '@/lib/hooks/useCardCapacity';
import { splitDay, useDayPageTick, useDayPagingEnabled } from '@/lib/hooks/useDayPaging';
import { InlineCalendarEvent } from './InlineCalendarEvent';
import { DayOverflowPopover } from './DayOverflowPopover';

/** Height of one event row and the gap between two, as rendered. */
export type ChipMetrics = { height: number; gap: number };

const PROBE_EVENT: CalendarEvent = {
  id: '__day-event-probe',
  title: 'Probe',
  startTime: new Date(2000, 0, 1, 9),
  endTime: new Date(2000, 0, 1, 10),
  allDay: false,
  color: '#888888',
} as CalendarEvent;

/** Chip metrics shared by every day of a view, set by its {@link ChipProbe}. */
export function useChipMetrics(): [ChipMetrics | undefined, (m: ChipMetrics) => void] {
  const [chip, setChip] = useState<ChipMetrics | undefined>(undefined);
  const onMeasure = useCallback((m: ChipMetrics) => {
    setChip((prev) => (prev && prev.height === m.height && prev.gap === m.gap ? prev : m));
  }, []);
  return [chip, onMeasure];
}

/**
 * Two invisible rows, stacked the way a day's list stacks them, so a day knows
 * how tall a row is at the current text floor, zoom and theme spacing. A fixed
 * number here went stale every time one of those changed.
 */
export function ChipProbe({
  onMeasure,
  compact = false,
  showTime = true,
}: {
  onMeasure: (m: ChipMetrics) => void;
  compact?: boolean;
  showTime?: boolean;
}) {
  const ref = useRef<HTMLUListElement | null>(null);
  const measure = useCallback(() => {
    const items = ref.current?.children;
    if (!items || items.length < 2) return;
    const a = items[0]!.getBoundingClientRect();
    const b = items[1]!.getBoundingClientRect();
    if (a.height > 0) onMeasure({ height: a.height, gap: Math.max(0, b.top - a.bottom) });
  }, [onMeasure]);
  useEffect(() => {
    measure();
    const node = ref.current;
    if (!node) return;
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [measure]);
  return (
    <ul
      ref={ref}
      aria-hidden
      className="pointer-events-none invisible absolute left-0 top-0 w-16 list-none m-0 p-0 flex flex-col gap-(--event-gap)"
    >
      <li><InlineCalendarEvent event={PROBE_EVENT} onClick={() => {}} compact={compact} showTime={showTime} /></li>
      <li><InlineCalendarEvent event={PROBE_EVENT} onClick={() => {}} compact={compact} showTime={showTime} /></li>
    </ul>
  );
}

/**
 * A day's own events, as many as fit at the text floor. The rest fold into a
 * "+N more" trigger, or on a wall page through (#801), rather than shrinking
 * or scrolling inside a cell nobody can scroll.
 */
export function DayEventList({
  date,
  events,
  chip,
  onEventClick,
  compact = false,
  showTime = true,
  short = false,
  triggerClassName,
  className,
}: {
  date: Date;
  events: CalendarEvent[];
  chip: ChipMetrics | undefined;
  onEventClick: (event: CalendarEvent) => void;
  compact?: boolean;
  showTime?: boolean;
  short?: boolean;
  triggerClassName?: string;
  className?: string;
}) {
  const { cellRef, fitWithOverflow, fitWithoutOverflow } = useCardCapacity({
    cardHeight: chip?.height,
    popoverHeight: chip?.height,
    gap: chip?.gap ?? 0,
    minVisible: 0,
  });
  const paging = useDayPagingEnabled();
  const measured = fitWithoutOverflow !== null && fitWithOverflow !== null;
  const tick = useDayPageTick(paging && measured);
  // Until the first measurement, show nothing rather than a guess that spills.
  const { shown, rest, page } = measured
    ? splitDay(events, fitWithoutOverflow, fitWithOverflow, paging, tick)
    : { shown: [] as CalendarEvent[], rest: [] as CalendarEvent[], page: null };

  return (
    <div ref={cellRef} className={cn('flex min-h-0 flex-1 flex-col gap-(--event-gap) overflow-hidden', className)}>
      {shown.length > 0 && (
        <ul className="list-none m-0 p-0 flex flex-col gap-(--event-gap)">
          {shown.map((event) => (
            <li
              // Keyed by page too, so a turned page fades in rather than swapping.
              key={page ? `${event.id}:${page.index}` : event.id}
              className={page ? 'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500' : undefined}
            >
              <InlineCalendarEvent event={event} onClick={onEventClick} compact={compact} showTime={showTime} />
            </li>
          ))}
        </ul>
      )}
      {chip && rest.length > 0 && (
        <div onClick={(e) => e.stopPropagation()}>
          <DayOverflowPopover
            date={date}
            hiddenEvents={rest}
            onEventClick={onEventClick}
            short={short}
            page={page}
            triggerClassName={triggerClassName}
          />
        </div>
      )}
    </div>
  );
}
