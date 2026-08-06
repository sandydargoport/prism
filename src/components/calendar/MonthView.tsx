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
  isToday,
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
import { CardHeightProbe, DayOverflowPopover, DroppableOverlayCell, useDayDroppable, type OverlayItemRef } from './cells';
import { useCardCapacity } from '@/lib/hooks/useCardCapacity';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';

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
}: MonthViewProps) {
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

  return (
    <div className="h-full flex flex-col overflow-auto">
      {cards && <CardHeightProbe size="xs" onMeasure={setCardHeight} />}
      {/* Month header — kept compact (py-1, text-sm) so it doesn't eat into
          the calendar grid. The toolbar already shows the month name; this
          band is mostly a colored anchor. */}
      <div
        className="shrink-0 text-center py-1 font-semibold text-sm text-white rounded-t-md mb-1 shadow-sm"
        style={{ backgroundColor: monthColor }}
      >
        {format(currentDate, 'MMMM yyyy')}
      </div>
      <div className="shrink-0 grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-center text-xs font-medium text-muted-foreground py-1"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Auto-scaling calendar grid */}
      <div
        className="flex-1 shrink-0 grid grid-cols-7 gap-1"
        style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(60px, 1fr))` }}
      >
        {days.map((date, index) => {
          const dayStart = startOfDay(date);
          const dayEvents = events
            .filter((event) =>
              event.allDay
                ? event.startTime <= dayStart && event.endTime > dayStart
                : isSameDay(event.startTime, date)
            )
            .sort((a, b) => {
              if (a.allDay && !b.allDay) return -1;
              if (!a.allDay && b.allDay) return 1;
              return a.startTime.getTime() - b.startTime.getTime();
            });

          const isPast = isBefore(date, startOfDay(new Date())) && !isToday(date);

          return (
            <MonthDayCell
              key={index}
              date={date}
              dayEvents={dayEvents}
              bucket={bucketsByDate?.get(format(date, 'yyyy-MM-dd'))}
              cards={cards}
              enableDnd={enableDnd}
              cardHeight={cardHeight}
              currentDate={currentDate}
              isPast={isPast}
              bordered={bordered}
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
  bucket,
  cards,
  enableDnd,
  cardHeight,
  currentDate,
  isPast,
  bordered,
  transparentMode,
  cellBgStyle,
  onDateClick,
  onEventClick,
  onItemClick,
}: {
  date: Date;
  dayEvents: CalendarEvent[];
  bucket: DayBucket | undefined;
  cards: boolean;
  enableDnd: boolean;
  cardHeight: number | undefined;
  currentDate: Date;
  isPast: boolean;
  bordered: boolean;
  transparentMode: boolean;
  cellBgStyle: React.CSSProperties | undefined;
  onDateClick: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onItemClick?: (ref: OverlayItemRef) => void;
}) {
  const droppable = useDayDroppable({ date, enabled: cards && enableDnd });

  return (
    <div
      ref={cards && enableDnd ? droppable.setNodeRef : undefined}
      data-droppable-day={cards && enableDnd ? droppable.droppableId : undefined}
      onClick={() => onDateClick(date)}
      className={cn(
        bordered && 'border border-border rounded-md',
        'cursor-pointer overflow-hidden',
        !transparentMode && !cellBgStyle && 'bg-card/85 backdrop-blur-sm',
        'flex flex-col min-h-0',
        !isSameMonth(date, currentDate) && 'opacity-50 text-muted-foreground',
        !transparentMode && !cellBgStyle && isPast && isSameMonth(date, currentDate) && 'bg-muted/65 text-muted-foreground',
        cards && enableDnd && droppable.isOver && 'ring-2 ring-seasonal-accent shadow-lg',
      )}
      style={cellBgStyle}
    >
      {/* Today gets a blue bar; other days just show the date */}
      {isToday(date) ? (
        <div className="bg-primary px-1 py-0.5 mb-0.5 rounded-t-[3px]">
          <span className="text-sm font-bold text-primary-foreground">{format(date, 'd')}</span>
        </div>
      ) : (
        <div className="text-sm font-medium px-1 pt-1 mb-0.5">
          {format(date, 'd')}
        </div>
      )}

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
            <li
              key={event.id}
              onClick={(e) => {
                e.stopPropagation();
                onEventClick(event);
              }}
              className={cn(
                'text-xs px-1 rounded truncate cursor-pointer hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all',
                event.allDay ? 'py-px' : 'py-0.5'
              )}
              style={event.allDay
                ? { backgroundColor: event.color, color: '#fff', borderLeft: `2px solid ${event.color}` }
                : { color: event.color }
              }
            >
              {event.allDay ? event.title : `• ${format(event.startTime, 'h:mm a')} ${event.title}`}
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
  const overlayItemCount = bucket ? bucket.meals.length + bucket.chores.length + bucket.tasks.length : 0;
  // Reserve ~22px for the popover trigger; each overlay row is ~24px (sm card)
  // plus the cell's 4px gap-1 separator. 20px under-reserved enough that event
  // rows pushed overlay items into clipped territory on dense days.
  const popoverHeight = 22 + overlayItemCount * 26;

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
          className="w-full text-left text-[10px] px-1 py-0.5 rounded bg-card/85 backdrop-blur-sm border border-border/40 shadow-sm truncate hover:bg-card transition-colors leading-tight"
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
