'use client';

import * as React from 'react';
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isToday,
  isTomorrow,
  isBefore,
  startOfDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { hexToRgba } from '@/lib/utils/color';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { seasonalPalettes } from '@/lib/themes/seasonalThemes';
import type { CalendarEvent } from '@/types/calendar';
import { CardHeightProbe, DayOverflowPopover, DroppableOverlayCell, WeekItemCard, useDayDroppable, weatherIcon, type OverlayItemRef } from './cells';

/** HSL color for the seasonal accent of the cell's month. */
function getMonthAccentColor(date: Date): string {
  const palette = seasonalPalettes[date.getMonth() + 1];
  return palette ? `hsl(${palette.light.accent})` : 'hsl(var(--seasonal-accent))';
}
import { useCardCapacity } from '@/lib/hooks/useCardCapacity';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';

export interface MultiWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  weekCount?: 1 | 2 | 3 | 4;
  bordered?: boolean;
  displayMode?: 'inline' | 'cards';
  bucketsByDate?: Map<string, DayBucket>;
  enableDnd?: boolean;
  /** When true, weekends collapse so the grid only shows Mon-Fri (5 cols). */
  hideWeekends?: boolean;
  /** Color used for meal stripes (Family calendar-group color). */
  mealColor?: string;
  /** Click handler for meal/chore/task cards. */
  onItemClick?: (ref: OverlayItemRef) => void;
}

/** Fallback while the ResizeObserver hasn't measured yet (~1 frame on mount). */
const FALLBACK_VISIBLE_CARDS_COMPACT = 2;
const FALLBACK_VISIBLE_CARDS = 4;

export function MultiWeekView({
  currentDate,
  events,
  onEventClick,
  weekCount = 2,
  bordered = false,
  displayMode = 'inline',
  bucketsByDate,
  enableDnd = false,
  hideWeekends = false,
  mealColor,
  onItemClick,
}: MultiWeekViewProps) {
  const { weekStartsOn } = useWeekStartsOn();
  const [cardHeight, setCardHeight] = React.useState<number | undefined>(undefined);
  const cards = displayMode === 'cards';
  const bgOverride = useWidgetBgOverride();
  const cellBg = bgOverride?.cellBackgroundColor;
  const cellBgOpacity = bgOverride?.cellBackgroundOpacity ?? 1;
  const cellBgStyle = cellBg ? { backgroundColor: hexToRgba(cellBg, cellBgOpacity) } : undefined;
  const weekStart = startOfWeek(currentDate, { weekStartsOn });

  const totalDays = weekCount * 7;
  const days: Date[] = [];
  for (let i = 0; i < totalDays; i++) {
    days.push(addDays(weekStart, i));
  }

  const compact = weekCount > 2;

  // Group days into week rows; drop Sat/Sun when hideWeekends is on.
  const weeks: Date[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const row = days.slice(w * 7, (w + 1) * 7);
    weeks.push(hideWeekends ? row.filter((d) => d.getDay() !== 0 && d.getDay() !== 6) : row);
  }
  const colCount = hideWeekends ? 5 : 7;

  // In inline mode, rows size to content (events list scrolls). In cards mode
  // with multiple weeks, rows are equal-height (`1fr`) so dynamic capacity has
  // a meaningful target height to measure. For 1W in cards mode the row sizes
  // to content so the grid hugs the day's events instead of stretching to fill
  // the screen — matches the auto-height feel of the old /week page.
  const singleWeek = weekCount === 1;
  const rowSizing = cards && !singleWeek ? '1fr' : 'auto';

  return (
    <div className={cn('flex flex-col overflow-auto p-0.5', singleWeek ? 'min-h-0' : 'h-full')}>
      {cards && !singleWeek && <CardHeightProbe size={compact ? 'sm' : 'md'} onMeasure={setCardHeight} />}

      {/* Week rows — each cell labels its own day, so no top day-name strip.
          Outer p-0.5 keeps the seasonal-accent ring on row 1 / col 1 / col 7
          from being clipped by the parent's overflow-auto. */}
      <div
        className={cn('grid gap-1 min-h-0', !singleWeek && 'flex-1')}
        style={{ gridTemplateRows: `repeat(${weekCount}, ${rowSizing})` }}
      >
        {weeks.map((week, wIdx) => (
          <div
            key={wIdx}
            className={cn('grid gap-1', cards && !singleWeek && 'min-h-0 h-full')}
            style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}
          >
            {week.map((date, dIdx) => (
              <DayCell
                key={dIdx}
                date={date}
                events={events}
                onEventClick={onEventClick}
                compact={compact}
                bordered={bordered}
                cellBgStyle={cellBgStyle}
                displayMode={displayMode}
                bucket={bucketsByDate?.get(format(date, 'yyyy-MM-dd'))}
                enableDnd={enableDnd}
                cardHeight={cardHeight}
                mealColor={mealColor}
                onItemClick={onItemClick}
                showAll={singleWeek}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayCell({
  date,
  events,
  onEventClick,
  compact,
  bordered,
  cellBgStyle,
  displayMode,
  bucket,
  enableDnd,
  cardHeight,
  mealColor,
  onItemClick,
  showAll = false,
}: {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  compact: boolean;
  bordered: boolean;
  cellBgStyle?: React.CSSProperties;
  displayMode: 'inline' | 'cards';
  bucket?: DayBucket;
  enableDnd: boolean;
  cardHeight: number | undefined;
  mealColor?: string;
  onItemClick?: (ref: OverlayItemRef) => void;
  /** When true, bypass capacity-based clipping and render every event card.
      Used in 1W mode where vertical space is generous and the user expects
      the row to grow to accommodate the day with the most events. */
  showAll?: boolean;
}) {
  const cards = displayMode === 'cards';
  const fallback = compact ? FALLBACK_VISIBLE_CARDS_COMPACT : FALLBACK_VISIBLE_CARDS;
  const dayStart = startOfDay(date);
  const dayEvents = events.filter((event) =>
    event.allDay
      ? event.startTime <= dayStart && event.endTime > dayStart
      : isSameDay(event.startTime, date)
  );
  const sorted = [...dayEvents].sort((a, b) => {
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;
    return a.startTime.getTime() - b.startTime.getTime();
  });
  const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);

  // Overlay items render in the same flex container as events (meals at top,
  // chores+tasks at bottom). They are ALWAYS rendered when present, so the
  // space they consume must be subtracted from BOTH capacity branches —
  // otherwise the no-overflow branch picks a count that fits events alone and
  // overflow:hidden silently clips the chores/tasks rows below.
  const overlayItemCount = bucket ? bucket.meals.length + bucket.chores.length + bucket.tasks.length : 0;
  const overlayRowHeight = cardHeight ?? 56;
  const cellGap = 4; // matches `gap-1` between cards in the events container
  const overlayRowsHeight = overlayItemCount * (overlayRowHeight + cellGap);
  const popoverTriggerHeight = 22; // only present when events actually overflow
  const { cellRef, fitWithOverflow, fitWithoutOverflow } = useCardCapacity({
    cardHeight,
    headerHeight: overlayRowsHeight,
    popoverHeight: popoverTriggerHeight,
    gap: cellGap,
    // When overlays already consume the cell, allow 0 visible events so the
    // popover trigger absorbs all of them — prevents events from spilling
    // past the popover and getting half-clipped.
    minVisible: 0,
  });

  let visibleCount: number;
  if (!cards || showAll) {
    visibleCount = sorted.length;
  } else {
    const noOverflowFit = fitWithoutOverflow ?? fallback;
    const overflowFit = fitWithOverflow ?? fallback;
    // If every event fits without a popover, show all. Otherwise reserve the
    // last visible slot for the popover trigger so overflow is always
    // explicit, never clipped.
    if (sorted.length <= noOverflowFit) visibleCount = sorted.length;
    else visibleCount = overflowFit;
  }

  const droppable = useDayDroppable({ date, enabled: cards && enableDnd });

  const visibleEvents = cards ? sorted.slice(0, Math.max(0, visibleCount)) : sorted;
  const hiddenEvents = cards ? sorted.slice(visibleEvents.length) : [];

  const today = isToday(date);
  const tomorrow = isTomorrow(date);
  const dayLabel = today
    ? 'Today'
    : tomorrow
      ? 'Tomorrow'
      : compact
        ? format(date, 'EEE')
        : format(date, 'EEEE');
  const dayWeather = bucket?.weather;
  const cardSize = compact ? 'sm' : 'md';
  const monthAccent = getMonthAccentColor(date);

  return (
    <div
      ref={cards && enableDnd ? droppable.setNodeRef : undefined}
      data-droppable-day={cards && enableDnd ? droppable.droppableId : undefined}
      className={cn(
        'flex flex-col rounded-md',
        // In 1W mode (showAll=true) the column sizes to its content. In
        // 2/3/4W modes the cell stretches to fill the equal-height row so
        // the capacity probe has a real target height.
        cards && (showAll ? 'min-h-0' : 'min-h-0 h-full'),
        isPast && !cellBgStyle && 'opacity-50',
        // Cards mode: every cell gets a subtle border, today gets the month's
        // seasonal-accent ring (lavender in April, etc.).
        cards && !cellBgStyle && 'border border-border bg-card/85 backdrop-blur-sm',
        cards && cellBgStyle && 'border border-border',
        cards && (today || (enableDnd && droppable.isOver)) && 'border-transparent',
        cards && enableDnd && droppable.isOver && 'shadow-lg',
        // Inline mode keeps the legacy bordered look.
        !cards && bordered && !cellBgStyle && 'border border-border bg-card/85',
        !cards && bordered && cellBgStyle && 'border border-border',
        !cards && bordered && isPast && !cellBgStyle && 'bg-muted/65',
      )}
      style={{
        ...cellBgStyle,
        ...(cards && (today || (enableDnd && droppable.isOver))
          ? { boxShadow: `0 0 0 2px ${monthAccent}` }
          : {}),
      }}
    >
      {/* Date header — large bold day number, relative day label, weather upper-right. */}
      <div
        className={cn(
          'shrink-0 flex items-start justify-between gap-1',
          compact ? 'px-1.5 py-1' : 'px-2 py-1.5',
        )}
      >
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className={cn('font-bold leading-none', compact ? 'text-base' : 'text-xl')}>
            {format(date, 'd')}
          </span>
          <span
            className={cn(
              'font-medium leading-none truncate',
              compact ? 'text-[11px]' : 'text-xs',
              !today && 'text-muted-foreground',
            )}
            style={today ? { color: monthAccent } : undefined}
          >
            {dayLabel}
          </span>
        </div>
        {dayWeather && (
          <div className={cn(
            'flex shrink-0 items-center gap-1 text-muted-foreground tabular-nums',
            compact ? 'text-[10px]' : 'text-[11px]',
          )}>
            {weatherIcon(dayWeather.condition)}
            <span>{Math.round(dayWeather.high)}°/{Math.round(dayWeather.low)}°</span>
          </div>
        )}
      </div>

      {/* Cards / events. In cards mode, meals render at the top of the day's
          stack (like all-day events); chores + tasks fall to the bottom. */}
      <div
        ref={cards ? cellRef : undefined}
        className={cn(
          cards ? 'flex flex-col gap-1 flex-1 min-h-0 overflow-hidden' : 'space-y-0.5',
          compact ? 'px-1 pb-1' : 'px-1.5 pb-1.5',
        )}
      >
        {cards
          ? visibleEvents.map((event) => {
              // Only locally-managed events are safe to drag; external (Google,
              // iCal feed, etc.) events would either round-trip or be reverted
              // on next sync. `calendarId === 'local'` marks internal events.
              const draggable = enableDnd && event.calendarId === 'local';
              return (
                <WeekItemCard
                  key={event.id}
                  variant="event"
                  size={cardSize}
                  layout="column"
                  stripeColor={event.color}
                  title={event.title}
                  timeLabel={event.allDay ? 'All day' : format(event.startTime, 'h:mm a')}
                  subtitle={event.location || event.calendarName}
                  onClick={() => onEventClick(event)}
                  dragId={draggable ? `event:${event.id}` : undefined}
                />
              );
            })
          : visibleEvents.map((event) => (
              <button
                key={event.id}
                onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                className={cn(
                  'w-full text-left rounded truncate hover:opacity-80 hover:ring-1 hover:ring-seasonal-accent/50 transition-all',
                  compact ? 'text-xs px-0.5 py-px' : 'text-xs px-1 py-0.5',
                )}
                style={event.allDay
                  ? { backgroundColor: event.color, color: '#fff', borderLeft: `2px solid ${event.color}` }
                  : { color: event.color }
                }
              >
                {event.allDay ? event.title : `${format(event.startTime, 'h:mm')} ${event.title}`}
              </button>
            ))}
        {cards && hiddenEvents.length > 0 && (
          <DayOverflowPopover
            date={date}
            hiddenEvents={hiddenEvents}
            onEventClick={onEventClick}
          />
        )}
        {/* Skylight-style: events lead; the day's planning group (chores, tasks,
            then meals) floats to the bottom of the cell (mt-auto) inside a faint
            theme-aware band that delineates it from the events. */}
        {cards && bucket && (bucket.meals.length + bucket.chores.length + bucket.tasks.length) > 0 && (
          <div className="mt-auto flex flex-col gap-1 rounded-md bg-muted/60 p-1.5 ring-1 ring-border/50">
            {(bucket.chores.length > 0 || bucket.tasks.length > 0) && (
              <DroppableOverlayCell
                date={date}
                bucket={bucket}
                size={cardSize}
                layout="column"
                enableDnd={enableDnd}
                include={{ meals: false, chores: true, tasks: true }}
                onItemClick={onItemClick}
              />
            )}
            {bucket.meals.length > 0 && (
              <DroppableOverlayCell
                date={date}
                bucket={bucket}
                size={cardSize}
                layout="column"
                enableDnd={enableDnd}
                include={{ meals: true, chores: false, tasks: false }}
                mealColor={mealColor}
                onItemClick={onItemClick}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
