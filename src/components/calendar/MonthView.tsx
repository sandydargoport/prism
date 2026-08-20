'use client';

import * as React from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  isBefore,
  startOfDay,
  getMonth,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { hexToRgba } from '@/lib/utils/color';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { DAYS_SHORT_ARRAY } from '@/lib/constants/days';
import type { CalendarEvent } from '@/types/calendar';
import { seasonalPalettes } from '@/lib/themes/seasonalThemes';
import { CardHeightProbe, DayOverflowPopover, DroppableOverlayCell, InlineCalendarEvent, SpanningEventRows, useDayDroppable, type OverlayItemRef } from './cells';
import { useCardCapacity } from '@/lib/hooks/useCardCapacity';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay, eventSpansMultipleDisplayDays, isCalendarEventPast, toDisplayDate } from '@/lib/utils/timeFormat';

// Get the accent color for a month (1-12)
function getMonthColor(month: Date): string {
  const monthNum = getMonth(month) + 1;
  const palette = seasonalPalettes[monthNum];
  return palette ? `hsl(${palette.light.accent})` : '#3B82F6';
}

export interface MonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onDateClick: (date: Date) => void;
  bordered?: boolean;
  displayMode?: 'inline' | 'cards';
  bucketsByDate?: Map<string, DayBucket>;
  enableDnd?: boolean;
  onItemClick?: (ref: OverlayItemRef) => void;
  /** Show the in-view month band. Full-page calendar already has this title. */
  showMonthHeader?: boolean;
}

/** Fallback when ResizeObserver has not yet measured (~1 frame on mount). */
const FALLBACK_VISIBLE_CARDS = 3;

export function MonthView({
  currentDate,
  events,
  onEventClick,
  onDateClick,
  bordered = true,
  displayMode = 'inline',
  bucketsByDate,
  enableDnd = false,
  onItemClick,
  showMonthHeader = true,
}: MonthViewProps) {
  const { displayTimezone } = useTimeFormat();
  const displayNow = toDisplayDate(new Date(), displayTimezone);
  const cards = displayMode === 'cards';
  const { weekStartsOn } = useWeekStartsOn();
  const [cardHeight, setCardHeight] = React.useState<number | undefined>(undefined);
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;
  const cellBg = bgOverride?.cellBackgroundColor;
  const cellBgOpacity = bgOverride?.cellBackgroundOpacity ?? 1;
  const cellBgStyle = cellBg ? { backgroundColor: hexToRgba(cellBg, cellBgOpacity) } : undefined;
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });
  const monthColor = getMonthColor(currentDate);

  const days: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const numWeeks = Math.ceil(days.length / 7);
  const dayNames = [...DAYS_SHORT_ARRAY.slice(weekStartsOn), ...DAYS_SHORT_ARRAY.slice(0, weekStartsOn)];
  const spanningEvents = events
    .filter((event) => eventSpansMultipleDisplayDays(
      event.startTime,
      event.endTime,
      event.allDay,
      displayTimezone,
    ))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime() || a.title.localeCompare(b.title));
  const spanningEventSet = new Set(spanningEvents);

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden">
      {cards && <CardHeightProbe size="xs" onMeasure={setCardHeight} />}
      {showMonthHeader && (
        <div
          className="shrink-0 text-center py-1 font-semibold text-sm text-white rounded-t-md shadow-sm"
          style={{ backgroundColor: monthColor }}
        >
          {format(currentDate, 'MMMM yyyy')}
        </div>
      )}
      <div className="shrink-0 grid grid-cols-7 border-b border-border/70">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-center text-xs font-medium text-muted-foreground py-1.5"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Auto-scaling calendar grid */}
      <div
        className={cn(
          'flex-1 min-h-0 grid grid-cols-7 gap-px overflow-hidden bg-border/45',
          bordered && 'bg-border/80',
        )}
        style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))` }}
      >
        {days.map((date, index) => {
          const weekStartIndex = Math.floor(index / 7) * 7;
          const rowDates = days.slice(weekStartIndex, weekStartIndex + 7);
          const rowSpanningEvents = spanningEvents.filter((event) => rowDates.some((rowDate) =>
            eventOccursOnDisplayDay(
              event.startTime,
              event.endTime,
              event.allDay,
              rowDate,
              displayTimezone,
            )));
          const dayEvents = events
            .filter((event) => !spanningEventSet.has(event))
            .filter((event) => eventOccursOnDisplayDay(
              event.startTime,
              event.endTime,
              event.allDay,
              date,
              displayTimezone,
            ))
            .sort((a, b) => {
              if (a.allDay && !b.allDay) return -1;
              if (!a.allDay && b.allDay) return 1;
              return a.startTime.getTime() - b.startTime.getTime();
            });

          const isPast = isBefore(date, startOfDay(displayNow)) && !isSameDay(date, displayNow);

          return (
            <MonthDayCell
              key={index}
              date={date}
              dayEvents={dayEvents}
              rowDates={rowDates}
              spanningEvents={rowSpanningEvents}
              bucket={bucketsByDate?.get(format(date, 'yyyy-MM-dd'))}
              cards={cards}
              enableDnd={enableDnd}
              cardHeight={cardHeight}
              currentDate={currentDate}
              isPast={isPast}
              transparentMode={transparentMode}
              cellBgStyle={cellBgStyle}
              onDateClick={onDateClick}
              onEventClick={onEventClick}
              onItemClick={onItemClick}
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * One day cell in the month grid. Lifted out of the parent map so it can
 * register a useDayDroppable target and show the purple drop-hover ring on
 * its outer wrapper (matching /week's DayColumn).
 */
function MonthDayCell({
  date,
  dayEvents,
  rowDates,
  spanningEvents,
  bucket,
  cards,
  enableDnd,
  cardHeight,
  currentDate,
  isPast,
  transparentMode,
  cellBgStyle,
  onDateClick,
  onEventClick,
  onItemClick,
}: {
  date: Date;
  dayEvents: CalendarEvent[];
  rowDates: Date[];
  spanningEvents: CalendarEvent[];
  bucket: DayBucket | undefined;
  cards: boolean;
  enableDnd: boolean;
  cardHeight: number | undefined;
  currentDate: Date;
  isPast: boolean;
  transparentMode: boolean;
  cellBgStyle: React.CSSProperties | undefined;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onItemClick?: (ref: OverlayItemRef) => void;
}) {
  const { displayTimezone } = useTimeFormat();
  const today = isSameDay(date, toDisplayDate(new Date(), displayTimezone));
  const droppable = useDayDroppable({ date, enabled: cards && enableDnd });

  return (
    <div
      ref={cards && enableDnd ? droppable.setNodeRef : undefined}
      data-droppable-day={cards && enableDnd ? droppable.droppableId : undefined}
      onClick={() => onDateClick(date)}
      className={cn(
        'relative cursor-pointer overflow-visible',
        !transparentMode && !cellBgStyle && 'bg-card/85 backdrop-blur-sm',
        'flex flex-col min-h-0',
        cards && enableDnd && droppable.isOver && 'ring-2 ring-seasonal-accent shadow-lg',
      )}
      style={cellBgStyle}
    >
      <div className="flex h-7 shrink-0 items-center justify-center">
        <span className={cn(
          'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-medium',
          today && 'bg-primary font-bold text-primary-foreground',
          !today && isPast && 'text-muted-foreground',
          !today && !isSameMonth(date, currentDate) && 'text-muted-foreground/55',
        )}>
          {format(date, 'd')}
        </span>
      </div>

      <SpanningEventRows
        date={date}
        rowDates={rowDates}
        events={spanningEvents}
        onEventClick={onEventClick}
      />

      {cards ? (
        <DayCardsCell
          date={date}
          events={dayEvents}
          bucket={bucket}
          enableDnd={enableDnd}
          cardHeight={cardHeight}
          onEventClick={onEventClick}
          onItemClick={onItemClick}
        />
      ) : (
        <ul className="flex-1 overflow-y-auto space-y-0.5 list-none m-0 px-1 pb-1 pt-0">
          {dayEvents.map((event) => (
            <li key={event.id}>
              <InlineCalendarEvent event={event} onClick={onEventClick} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Renders the events portion of a month-view cell in cards mode. Uses
 * useCardCapacity to fit as many cards as the available cell height allows,
 * falling back to {@link FALLBACK_VISIBLE_CARDS} for the first frame before
 * the ResizeObserver fires.
 */
function DayCardsCell({
  date,
  events,
  bucket,
  enableDnd,
  cardHeight,
  onEventClick,
  onItemClick,
}: {
  date: Date;
  events: CalendarEvent[];
  bucket: DayBucket | undefined;
  enableDnd: boolean;
  cardHeight: number | undefined;
  onEventClick: (event: CalendarEvent) => void;
  onItemClick?: (ref: OverlayItemRef) => void;
}) {
  const { displayTimezone } = useTimeFormat();
  const overlayItemCount = bucket ? bucket.meals.length + bucket.chores.length + bucket.tasks.length : 0;
  // Reserve ~22px for the popover trigger; each overlay row is ~24px (sm card)
  // plus the cell's 4px gap-1 separator. 20px under-reserved enough that event
  // rows pushed overlay items into clipped territory on dense days.
  const popoverHeight = 28 + overlayItemCount * 26;

  const { cellRef, fitWithOverflow, fitWithoutOverflow } = useCardCapacity({
    cardHeight,
    popoverHeight,
  });

  const fallback = FALLBACK_VISIBLE_CARDS;
  const noOverflowFit = fitWithoutOverflow ?? fallback;
  const overflowFit = fitWithOverflow ?? fallback;

  // If every event fits without a popover, show all. Otherwise reserve the
  // last visible slot for the popover trigger so overflow is always explicit
  // and never clipped by the cell's overflow:hidden.
  let visibleCount: number;
  if (events.length <= noOverflowFit) {
    visibleCount = events.length;
  } else {
    visibleCount = overflowFit;
  }

  const visible = events.slice(0, Math.max(0, visibleCount));
  const hidden = events.slice(visible.length);

  return (
    <div
      ref={cellRef}
      className="flex-1 min-h-0 flex flex-col gap-0.5 px-1 pb-1"
    >
      {visible.map((event) => (
        <button
          key={event.id}
          onClick={(e) => {
            e.stopPropagation();
            onEventClick(event);
          }}
          className={cn(
            'w-full text-left text-[10px] px-1 py-0.5 rounded bg-card/85 backdrop-blur-sm border border-border/40 shadow-sm truncate hover:bg-card transition-colors leading-tight',
            isCalendarEventPast(
              event.startTime,
              event.endTime,
              event.allDay,
              new Date(),
              displayTimezone,
            ) && 'opacity-55 saturate-[0.65]',
          )}
          style={{ borderLeft: `3px solid ${event.color}` }}
        >
          <span className="font-medium text-foreground">{event.title}</span>
        </button>
      ))}
      {hidden.length > 0 && (
        <div onClick={(e) => e.stopPropagation()}>
          <DayOverflowPopover date={date} hiddenEvents={hidden} onEventClick={onEventClick} />
        </div>
      )}
      {/* Meals/chores/tasks overlay floats to the bottom of the cell, inside a
          faint theme-aware band (when populated) that delineates it from events. */}
      {bucket && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'mt-auto',
            overlayItemCount > 0 && 'rounded-md bg-muted/60 px-1.5 py-1 ring-1 ring-border/50',
          )}
        >
          <DroppableOverlayCell
            date={date}
            bucket={bucket}
            size="xs"
            layout="row"
            enableDnd={enableDnd}
            onItemClick={onItemClick}
          />
        </div>
      )}
    </div>
  );
}
