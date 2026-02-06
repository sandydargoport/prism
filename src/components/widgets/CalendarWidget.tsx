'use client';

import * as React from 'react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  format,
  isToday,
  isTomorrow,
  isSameDay,
  addDays,
  addWeeks,
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  startOfDay,
  startOfWeek,
} from 'date-fns';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import {
  ScrollArea,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { useCalendarEvents, useCalendarFilter } from '@/lib/hooks';
import { MonthView, WeekView, TwoWeekView, DayViewSideBySide, CalendarFilterPopover } from '@/components/calendar';
import type { CalendarEvent } from '@/types/calendar';
export type { CalendarEvent };


type WidgetViewType = 'list' | 'day' | 'week' | 'twoWeek' | 'month';

const VIEW_OPTIONS: { value: WidgetViewType; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'twoWeek', label: '2 Wk' },
  { value: 'month', label: 'Month' },
];

/** Determine which views are available at a given grid size (12-col grid) */
function getAvailableViews(gridW: number, gridH: number): WidgetViewType[] {
  if (gridW >= 9 && gridH >= 6) return ['list', 'day', 'week', 'twoWeek', 'month'];
  if (gridW >= 6 && gridH >= 9) return ['list', 'day', 'week', 'twoWeek', 'month'];
  if (gridW >= 6 && gridH >= 6) return ['list', 'week', 'twoWeek', 'month'];
  if (gridW >= 4 && gridH >= 4) return ['list', 'week', 'twoWeek'];
  return ['list'];
}


export interface CalendarWidgetProps {
  events?: CalendarEvent[];
  loading?: boolean;
  error?: string | null;
  onEventClick?: (event: CalendarEvent) => void;
  titleHref?: string;
  className?: string;
  gridW?: number;
  gridH?: number;
}


export function CalendarWidget({
  events: externalEvents,
  loading: externalLoading,
  error: externalError,
  onEventClick,
  titleHref,
  className,
  gridW = 2,
  gridH = 2,
}: CalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<WidgetViewType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('prism-calendar-view');
      if (saved && ['list', 'day', 'week', 'twoWeek', 'month'].includes(saved)) {
        return saved as WidgetViewType;
      }
    }
    return 'list';
  });

  // Persist view type to localStorage
  useEffect(() => {
    localStorage.setItem('prism-calendar-view', viewType);
  }, [viewType]);

  // Fetch own events if none provided
  const { events: apiEvents, loading: apiLoading, error: apiError } = useCalendarEvents({ daysToShow: 60 });
  const { selectedCalendarIds, toggleCalendar, filterEvents, calendarGroups } = useCalendarFilter();

  const loading = externalLoading ?? apiLoading;
  const error = externalError ?? apiError;
  const rawEvents = externalEvents ?? apiEvents;
  const events = useMemo(() => filterEvents(rawEvents), [filterEvents, rawEvents]);

  // Size awareness
  const availableViews = useMemo(() => getAvailableViews(gridW, gridH), [gridW, gridH]);
  const effectiveView = availableViews.includes(viewType) ? viewType : 'list';
  const viewUnavailable = viewType !== effectiveView;

  // Navigation
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goToPrevious = useCallback(() => {
    setCurrentDate(d => {
      switch (effectiveView) {
        case 'day': return subDays(d, 1);
        case 'week': return subWeeks(d, 1);
        case 'twoWeek': return subWeeks(d, 2);
        case 'month': return subMonths(d, 1);
        default: return subDays(d, 3);
      }
    });
  }, [effectiveView]);
  const goToNext = useCallback(() => {
    setCurrentDate(d => {
      switch (effectiveView) {
        case 'day': return addDays(d, 1);
        case 'week': return addWeeks(d, 1);
        case 'twoWeek': return addWeeks(d, 2);
        case 'month': return addMonths(d, 1);
        default: return addDays(d, 3);
      }
    });
  }, [effectiveView]);

  // List view data
  const listDays = 14;
  const listStartDate = startOfDay(new Date());
  const listEvents = useMemo(() => {
    const endDate = addDays(listStartDate, listDays);
    return events
      .filter(e => {
        const ed = startOfDay(e.startTime);
        return ed >= listStartDate && ed < endDate;
      })
      .sort((a, b) => {
        const dc = startOfDay(a.startTime).getTime() - startOfDay(b.startTime).getTime();
        if (dc !== 0) return dc;
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return a.startTime.getTime() - b.startTime.getTime();
      });
  }, [events, listStartDate]);

  const eventsByDay = useMemo(() => {
    const result: Array<{ date: Date; events: CalendarEvent[] }> = [];
    for (let i = 0; i < listDays; i++) {
      const date = addDays(listStartDate, i);
      const dayEvents = listEvents.filter(e => isSameDay(e.startTime, date));
      if (dayEvents.length > 0) result.push({ date, events: dayEvents });
    }
    return result;
  }, [listEvents, listStartDate]);

  const handleEventClick = useCallback((event: CalendarEvent) => {
    onEventClick?.(event);
  }, [onEventClick]);

  // Header actions
  const headerActions = (
    <div className="flex items-center gap-1">
      {/* Navigation (hidden in list-only mode) */}
      {availableViews.length > 1 && (
        <>
          <button onClick={goToPrevious} className="p-0.5 rounded hover:bg-accent" aria-label="Previous">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button onClick={goToToday} className="px-1.5 py-0.5 rounded text-[10px] font-medium hover:bg-accent">
            Today
          </button>
          <button onClick={goToNext} className="p-0.5 rounded hover:bg-accent" aria-label="Next">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </>
      )}

      {/* View selector */}
      {availableViews.length > 1 && (
        <Select value={viewType} onValueChange={(v) => setViewType(v as WidgetViewType)}>
          <SelectTrigger className="h-6 w-[70px] text-[10px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {VIEW_OPTIONS.map((opt) => (
              <SelectItem
                key={opt.value}
                value={opt.value}
                className="text-xs"
                disabled={!availableViews.includes(opt.value)}
              >
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Filter */}
      <CalendarFilterPopover
        calendarGroups={calendarGroups}
        selectedCalendarIds={selectedCalendarIds}
        onToggle={toggleCalendar}
      />
    </div>
  );

  return (
    <WidgetContainer
      title="Calendar"
      titleHref={titleHref}
      icon={<Calendar className="h-4 w-4" />}
      size="large"
      loading={loading}
      error={error}
      actions={headerActions}
      className={className}
    >
      {viewUnavailable && (
        <div className="text-[10px] text-muted-foreground text-center py-1 bg-muted/50 rounded mb-1">
          Resize widget for {VIEW_OPTIONS.find(v => v.value === viewType)?.label} view
        </div>
      )}

      {effectiveView === 'list' && (
        listEvents.length === 0 ? (
          <WidgetEmpty
            icon={<Calendar className="h-8 w-8" />}
            message="No upcoming events"
          />
        ) : (
          <ScrollArea className="h-full -mr-2 pr-2">
            <div className="space-y-4">
              {eventsByDay.map(({ date, events: dayEvts }) => (
                <DaySection
                  key={date.toISOString()}
                  date={date}
                  events={dayEvts}
                  maxEvents={5}
                  onEventClick={handleEventClick}
                />
              ))}
            </div>
          </ScrollArea>
        )
      )}

      {effectiveView === 'month' && (
        <MonthView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
          onDateClick={(date) => {
            setCurrentDate(date);
            setViewType('day');
          }}
        />
      )}

      {effectiveView === 'week' && (
        <WeekView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
        />
      )}

      {effectiveView === 'twoWeek' && (
        <TwoWeekView
          currentDate={currentDate}
          events={events}
          onEventClick={handleEventClick}
        />
      )}

      {effectiveView === 'day' && (
        <>
          <div className="text-center text-sm font-medium text-foreground mb-2">
            {formatDayHeader(currentDate)}
          </div>
          <DayViewSideBySide
            currentDate={currentDate}
            events={events}
            calendarGroups={calendarGroups}
            selectedCalendarIds={selectedCalendarIds}
            onEventClick={handleEventClick}
          />
        </>
      )}
    </WidgetContainer>
  );
}


// ---- List view sub-components (kept from original) ----

function DaySection({
  date,
  events,
  maxEvents,
  onEventClick,
}: {
  date: Date;
  events: CalendarEvent[];
  maxEvents: number;
  onEventClick?: (event: CalendarEvent) => void;
}) {
  const displayEvents = events.slice(0, maxEvents);
  const remainingCount = events.length - maxEvents;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'text-sm font-semibold',
            isToday(date) && 'text-seasonal-accent'
          )}
        >
          {formatDayHeader(date)}
        </span>
        {isToday(date) && (
          <Badge className="text-[10px] px-1.5 py-0 bg-seasonal-highlight text-seasonal-accent-foreground">
            Today
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 pl-2 border-l-2 border-border">
        {displayEvents.map((event) => (
          <EventRow
            key={event.id}
            event={event}
            onClick={() => onEventClick?.(event)}
          />
        ))}
        {remainingCount > 0 && (
          <div className="text-xs text-muted-foreground pl-2">
            +{remainingCount} more events
          </div>
        )}
      </div>
    </div>
  );
}

function EventRow({
  event,
  onClick,
}: {
  event: CalendarEvent;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left flex items-start gap-2 p-1.5 rounded',
        'hover:bg-accent/50 transition-colors',
        'touch-action-manipulation'
      )}
    >
      <div
        className="w-1 h-full min-h-[24px] rounded-full flex-shrink-0"
        style={{ backgroundColor: event.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-muted-foreground">
          {event.allDay ? 'All day' : format(event.startTime, 'h:mm a')}
        </div>
        <div className="text-sm font-medium truncate">
          {event.title}
        </div>
        {event.location && (
          <div className="text-xs text-muted-foreground truncate">
            {event.location}
          </div>
        )}
      </div>
    </button>
  );
}

function formatDayHeader(date: Date): string {
  const dayName = format(date, 'EEEE, MMMM d, yyyy');
  if (isToday(date)) return `Today — ${dayName}`;
  if (isTomorrow(date)) return `Tomorrow — ${dayName}`;
  return dayName;
}
