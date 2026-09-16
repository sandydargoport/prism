'use client';

import { addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { contrastText } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import {
  eventOccursOnDisplayDay,
  eventStartsOnDisplayDay,
  formatDisplayTime,
  isCalendarEventPast,
} from '@/lib/utils/timeFormat';
import { STRIPE_SHAPE } from './WeekItemCard';

/**
 * How far a continuation slice reaches back over the seam between two cells.
 *
 * The seam is this cell's left padding, plus the gap between cells, plus the
 * previous cell's right padding — and it differs per view. Measured: 8px in the
 * month grid, 12.5px in the two-week view, whose cells carry a 1px border its
 * `gap-1` class does not account for. A per-view constant would have to be
 * re-derived every time a caller's chrome changed, and would fail silently as a
 * hairline when it drifted.
 *
 * One generous value works instead, because **overshooting cannot show**. A
 * slice only reaches back when the same event holds the same lane on the
 * previous day, so the overshoot lands on that event's own slice: same colour,
 * same height, and square-edged, since a slice that continues is not capped on
 * that side. Undershooting leaves a visible gap; overshooting leaves nothing.
 *
 * Sized with real headroom, not to the measured seam. 1rem was set from a
 * 12.5px measurement and then fell 2px short the moment the band's padding
 * changed, because the seam grows with the caller's padding and borders. The
 * only cost of reaching further is more overlap onto the same event's own
 * slice, which shows nothing; the cost of reaching too little is a hairline
 * that lets whatever is underneath through. Measured seams so far: 8px in the
 * month grid, 16px in the two-week view.
 */
const SEAM_REACH = '1.5rem';

export type SpanningEventRowsProps = {
  date: Date;
  rowDates: Date[];
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  compact?: boolean;
  /**
   * Whether the day cells are drawing events as cards.
   *
   * A multi-day event is not a different species from a single-day one, so in
   * cards mode it takes the same surface: card background, hairline border,
   * shadow, and the event's colour on the leading edge. It stays shorter than a
   * full card, which is what still says "this one runs across days".
   */
  cards?: boolean;
  /**
   * The horizontal padding the day's own event list uses, as a Tailwind class.
   *
   * The band has to sit in the same content box as the chips beneath it, and
   * each view pads its list differently: `px-1` in the month grid, `px-1.5` in
   * the two-week view. Hardcoding one of them here made all-day cards 1.75px
   * wider on each side than the timed cards under them, in every view but the
   * one the constant came from.
   *
   * Stated by the caller, next to the list it has to match, so the two cannot
   * drift apart unnoticed.
   */
  padX?: string;
  /**
   * Width of the colour edge, in px, matching the stripe on the cards below.
   *
   * A card's stripe width comes from its size — 3px at `sm`, 5px at `md` — and
   * the band hardcoded 3px. Where the caller uses `md` the two differed, so the
   * title in the band started two pixels left of the titles beneath it. Small,
   * and exactly the kind of thing that reads as "not aligned" without being
   * obvious why.
   */
  stripePx?: number;
  /**
   * Type for the title, matching the cards in the same cell.
   *
   * The band set its own size and weight, so an all-day title came out lighter
   * and smaller than the timed titles right below it. The caller passes what
   * its own cards use.
   */
  titleClass?: string;
  /**
   * How many of the blank lanes above this day's first bar the caller has
   * already filled with the day's own events.
   *
   * A blank lane holds a bar's position steady across the days it spans. That
   * job is done just as well by a single-day event of the same height sitting
   * there, and a cell with space to spare should be using it: nothing about a
   * multi-day event entitles it to the top of the cell.
   */
  omitLeadingBlanks?: number;
};

/**
 * Renders the slice of each multi-day event that crosses this day cell.
 * A continuing slice covers only the gap after its own cell. Adjacent slices
 * therefore meet without overlapping, which keeps translucent/muted bars from
 * producing darker seams at day boundaries.
 */

/**
 * How this row's multi-day events are packed into lanes, for one day.
 *
 * Exported because a day cell needs the same answer the bars do: how many blank
 * lanes sit above its first bar, so it can put the day's own events there
 * instead of leaving the space empty. Both callers derive it from the same
 * inputs, so they cannot disagree.
 */
export function spanningLaneInfo(
  events: CalendarEvent[],
  rowDates: Date[],
  date: Date,
  displayTimezone: string,
): { firstActiveLane: number; lastActiveLane: number } {
  const occurs = (event: CalendarEvent, target: Date) =>
    eventOccursOnDisplayDay(event.startTime, event.endTime, event.allDay, target, displayTimezone);

  const ordered = [...events].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime() || a.id.localeCompare(b.id),
  );
  const occupancy: boolean[][] = [];
  const laneOf = new Map<string, number>();
  for (const event of ordered) {
    const covers = rowDates.map((rowDate) => occurs(event, rowDate));
    let lane = 0;
    for (;; lane += 1) {
      if (!occupancy[lane]) occupancy[lane] = rowDates.map(() => false);
      if (!covers.some((covered, i) => covered && occupancy[lane]![i])) break;
    }
    covers.forEach((covered, i) => {
      if (covered) occupancy[lane]![i] = true;
    });
    laneOf.set(event.id, lane);
  }

  let firstActiveLane = -1;
  let lastActiveLane = -1;
  for (const event of ordered) {
    if (!occurs(event, date)) continue;
    const lane = laneOf.get(event.id)!;
    if (firstActiveLane < 0 || lane < firstActiveLane) firstActiveLane = lane;
    if (lane > lastActiveLane) lastActiveLane = lane;
  }
  return { firstActiveLane, lastActiveLane };
}

export function SpanningEventRows({
  date,
  rowDates,
  events,
  onEventClick,
  compact = false,
  cards = false,
  padX = 'px-1',
  stripePx = 3,
  titleClass,
  omitLeadingBlanks = 0,
}: SpanningEventRowsProps) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const column = rowDates.findIndex((candidate) => isSameDay(candidate, date));
  if (column < 0 || events.length === 0) return null;

  const occurs = (event: CalendarEvent, target: Date) =>
    eventOccursOnDisplayDay(event.startTime, event.endTime, event.allDay, target, displayTimezone);

  // Which lane each span sits in, packed rather than taken from its position
  // in the row's list.
  //
  // A span has to keep one lane for every day it covers, so its slices line up
  // across the week. But a span may reuse a lane that an earlier span has
  // already finished with. Using list position instead means a span starting
  // on Monday sits in lane 3 all week merely because three others began before
  // it and ended before it started, leaving three blank rows above it on every
  // day it covers.
  //
  // Greedy over spans in start order, lowest free lane each time, which is the
  // standard packing for intervals and is optimal in lane count. Every cell in
  // the row computes the same assignment from the same inputs, so the lanes
  // agree across days without the cells having to share state.
  const ordered = [...events].sort(
    (a, b) => a.startTime.getTime() - b.startTime.getTime() || a.id.localeCompare(b.id),
  );
  const occupancy: boolean[][] = [];
  const laneOf = new Map<string, number>();
  for (const event of ordered) {
    const covers = rowDates.map((rowDate) => occurs(event, rowDate));
    let lane = 0;
    for (;; lane += 1) {
      if (!occupancy[lane]) occupancy[lane] = rowDates.map(() => false);
      if (!covers.some((covered, i) => covered && occupancy[lane]![i])) break;
    }
    covers.forEach((covered, i) => {
      if (covered) occupancy[lane]![i] = true;
    });
    laneOf.set(event.id, lane);
  }

  // What this day draws, by lane. A blank lane still holds a bar's position
  // steady, but only when a bar is drawn BELOW it here, so trailing blanks go
  // and a day the row's spans all miss renders nothing at all.
  const byLane: Array<CalendarEvent | null> = Array.from({ length: occupancy.length }, () => null);
  for (const event of ordered) {
    if (occurs(event, date)) byLane[laneOf.get(event.id)!] = event;
  }
  let lastActiveLane = -1;
  byLane.forEach((event, lane) => {
    if (event) lastActiveLane = lane;
  });
  if (lastActiveLane < 0) return null;

  // Never skip past a lane that holds a bar; only blanks the caller has filled.
  const firstActiveLane = byLane.findIndex((laneEvent) => laneEvent !== null);
  const startLane = Math.min(omitLeadingBlanks, Math.max(firstActiveLane, 0));

  // A multi-day event is a single-day all-day event that happens to run on.
  // These are the metrics its neighbours use, read from the same custom
  // properties, so a bar and a chip are the same height with their text
  // starting at the same offset under any theme.
  const barMetrics = compact
    ? 'px-0.5 py-px text-[8px]'
    : cards
      ? 'flex items-stretch gap-2 pr-1 text-[10px]'
      : 'px-(--event-padding-x,0.25rem) py-(--event-padding-y,0.125rem) text-(length:--event-font-size,0.75rem) font-(--event-font-weight)';

  return (
    <div
      data-spanning-events
      // padX matches the day's own event list, so a bar's cap lines up with the
      // left and right edge of the chips under it. A bar that continues is
      // widened past this padding below, so the slices still meet.
      className={cn(
        'relative z-20 flex shrink-0 flex-col',
        padX,
        // Same row gap as the day's own event list, and the same gap again
        // below the block, so a bar and the chip under it are spaced like two
        // chips rather than butting their borders together.
        compact ? 'gap-px mb-px' : cards ? 'gap-0.5 mb-0.5' : 'gap-(--event-gap,0.125rem) mb-(--event-gap,0.125rem)',
      )}
    >
      {byLane.slice(startLane, lastActiveLane + 1).map((laneEvent, laneOffset) => {
        const lane = startLane + laneOffset;

        // One shape for both a bar and a blank lane.
        //
        // A blank lane exists to hold a bar's vertical position steady across
        // the days it spans, which only works if it occupies exactly the box a
        // bar would. When it was a separate element restating a subset of the
        // classes, it drifted five times — missing a line box, then a border,
        // then the row's padding, then the card's type — and each drift moved
        // every bar below it and made a run look broken.
        //
        // So a blank lane IS a slice, with no event: same element, same
        // classes, `invisible` and holding a non-breaking space. There is
        // nothing left to keep in step.
        const filled = laneEvent !== null;
        const continuesFromPrevious = filled && occurs(laneEvent, addDays(date, -1));
        const continuesToNext = filled && occurs(laneEvent, addDays(date, 1));
        const continuesWithinRow = continuesToNext && column < rowDates.length - 1;
        // A run is joined by the LATER slice reaching back, not the earlier one
        // reaching forward. Day cells are positioned siblings, so a later cell
        // paints on top of an earlier one: overflowing to the right vanished
        // behind the next cell's background and left the seam showing.
        const reachesBack = continuesFromPrevious && column > 0;
        const past = filled && isCalendarEventPast(
          laneEvent.startTime, laneEvent.endTime, laneEvent.allDay, new Date(), displayTimezone,
        );
        const startsToday = filled && eventStartsOnDisplayDay(
          laneEvent.startTime, laneEvent.allDay, date, displayTimezone,
        );
        const label = !filled
          ? ''
          : !laneEvent.allDay && startsToday
            ? `${formatDisplayTime(laneEvent.startTime, timeFormat, {}, displayTimezone)} ${laneEvent.title}`
            : laneEvent.title;
        // The title prints where a run starts and again after a week wrap, not
        // on every day it covers.
        const showsLabel = filled && (!continuesFromPrevious || column === 0);

        const Tag = filled ? 'button' : 'div';

        return (
          <Tag
            key={filled ? laneEvent.id : `lane-${lane}`}
            {...(filled
              ? {
                  type: 'button' as const,
                  title: label,
                  onClick: (clickEvent: React.MouseEvent) => {
                    clickEvent.stopPropagation();
                    onEventClick(laneEvent);
                  },
                }
              : { 'aria-hidden': true })}
            className={cn(
              'relative z-20 block w-full truncate text-left font-medium leading-tight',
              cards ? 'hover:bg-card transition-colors' : 'hover:brightness-95',
              'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-seasonal-accent',
              barMetrics,
              // An edge is capped whenever it is actually visible; the only
              // ones that are not are those a neighbouring slice covers. Radius
              // comes from --radius, so a square theme squares these off too.
              !reachesBack && 'rounded-l-md',
              !continuesWithinRow && 'rounded-r-md',
              // Opaque, unlike the 85% single-day cards: a spanning pill is the
              // one card that crosses a cell boundary, so anything under the
              // seam would show through it. The Today ring did exactly that.
              cards && 'bg-card border shadow-xs text-foreground',
              // Mid-run edges carry no border, so a run reads as one object.
              cards && reachesBack && 'border-l-0',
              cards && continuesWithinRow && 'border-r-0',
              past && 'opacity-55 saturate-[0.65]',
              !filled && 'invisible',
            )}
            style={filled ? {
              backgroundColor: cards ? undefined : laneEvent.color,
              color: cards ? undefined : past ? contrastText(laneEvent.color) : '#fff',
              ...(cards
                ? {
                    // Washed toward --card rather than made translucent: a
                    // see-through border would let the seam show through, and
                    // blending against the token follows light and dark for
                    // free.
                    borderColor: `color-mix(in srgb, ${laneEvent.color} 35%, hsl(var(--card)))`,
                    ...(reachesBack ? { borderLeftWidth: 0 } : {}),
                    ...(continuesWithinRow ? { borderRightWidth: 0 } : {}),
                  }
                : {}),
              marginLeft: reachesBack ? `calc(-1 * ${SEAM_REACH})` : undefined,
              width: reachesBack ? `calc(100% + ${SEAM_REACH})` : '100%',
            } : undefined}
          >
            {cards && (
              <span
                aria-hidden
                // Full height, no radius of its own: the slice's rounded corner
                // and overflow mask it, so the curve is the card's curve at
                // whatever height this row is.
                className={cn(STRIPE_SHAPE)}
                style={{
                  width: stripePx,
                  backgroundColor: filled && !reachesBack ? laneEvent.color : 'transparent',
                }}
              />
            )}
            {/*
              The row's vertical padding lives here, not on the row. On the row
              it shrank the stripe's stretch target to the content box, so the
              stripe stopped short of the card's edges and the corner had
              nothing to mask.
            */}
            <span className={cn(cards && 'min-w-0 flex-1 truncate py-0.5', cards && titleClass)}>
              {showsLabel ? label : '\u00A0'}
            </span>
          </Tag>
        );
      })}
    </div>
  );
}
