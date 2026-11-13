'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { eventTintStyle } from '@/lib/design/eventStyle';
import {
  format,
  startOfWeek,
  addDays,
  isBefore,
  startOfDay,
  isSameDay,
} from 'date-fns';
import { cn } from '@/lib/utils';
import { NoteEditor } from './NoteEditor';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { hexToRgba } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import type { CalendarNote } from '@/lib/hooks/useCalendarNotes';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';
import { DroppableOverlayCell, useDayDroppable, type OverlayItemRef } from './cells';
import { useTimeFormat } from '@/components/providers';
import {
  eventOccursOnDisplayDay,
  eventStartsOnDisplayDay,
  formatDisplayTime,
  isCalendarEventPast,
  toDisplayDate,
} from '@/lib/utils/timeFormat';
import { eventsOverlappingRange } from '@/lib/utils/calendarRange';
import { useTranslations } from 'next-intl';
import { useDateLabels } from '@/lib/hooks/useDateLabels';

export interface WeekVerticalViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendarGroups?: Array<{ id: string; name: string; color: string; userId?: string | null }>;
  selectedCalendarIds?: Set<string>;
  mergedView?: boolean;
  bordered?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  showNotes?: boolean;
  notesByDate?: Map<string, CalendarNote>;
  onNoteChange?: (date: string, content: string) => void;
  displayMode?: 'inline' | 'cards';
  /** Per-day meals/chores/tasks. Provided when cards-mode + overlays are active. */
  bucketsByDate?: Map<string, DayBucket>;
  /** When true, overlay items are draggable and cells become drop targets. */
  enableDnd?: boolean;
  /** Override stripe color used for meals (Family calendar-group color). */
  mealColor?: string;
  /** Click handler for meal/chore/task overlay cards. */
  onItemClick?: (ref: OverlayItemRef) => void;
}

export function WeekVerticalView({
  currentDate,
  events,
  calendarGroups = [],
  selectedCalendarIds,
  mergedView = false,
  bordered = true,
  onEventClick,
  showNotes = false,
  notesByDate,
  onNoteChange,
  displayMode = 'inline',
  bucketsByDate,
  enableDnd = false,
  mealColor,
  onItemClick,
}: WeekVerticalViewProps) {
  const { displayTimezone } = useTimeFormat();
  const { weekStartsOn } = useWeekStartsOn();
  const bgOverride = useWidgetBgOverride();
  const cellBg = bgOverride?.cellBackgroundColor;
  const cellBgOpacity = bgOverride?.cellBackgroundOpacity ?? 1;
  const cellBgStyle = cellBg ? { backgroundColor: hexToRgba(cellBg, cellBgOpacity) } : undefined;
  const t = useTranslations('calendar');
  const d = useDateLabels();
  const rootRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(rootRef);
  const weekStart = startOfWeek(currentDate, { weekStartsOn });
  const now = toDisplayDate(new Date(), displayTimezone);
  const today = startOfDay(now);

  // Determine display groups (same logic as DayViewSideBySide)
  const showAllInOne = calendarGroups.length === 0 || mergedView;
  const filteredGroups = selectedCalendarIds && !selectedCalendarIds.has('all')
    ? calendarGroups.filter((g) => selectedCalendarIds.has(g.id))
    : calendarGroups;
  const displayGroups = showAllInOne || filteredGroups.length === 0
    ? [{ id: 'all', name: t('allEvents'), color: '#3B82F6' }]
    : filteredGroups;

  const getEventsForGroup = (dayEvents: CalendarEvent[], gid: string) => {
    if (showAllInOne || gid === 'all') return dayEvents;
    return dayEvents.filter((e) => e.groupId === gid);
  };

  // A wide screen shows this week and next side by side (#671), when each
  // week's person columns still get a readable width. The notes column needs
  // the room, so with notes on the view stays one week. Measured on the view
  // itself, so the Calendar widget follows its own size, not the window's.
  const twoWeeks = !showNotes
    && width >= TWO_WEEK_MIN_WIDTH
    && (width / 2 - DAY_GUTTER_PX) / displayGroups.length >= MIN_GROUP_COLUMN_PX;
  const weekCount = twoWeeks ? 2 : 1;
  // Scope the wide event list to the shown weeks once; passed into each day row.
  const scopedEvents = eventsOverlappingRange(events, weekStart, addDays(weekStart, 7 * weekCount));
  const weeks = Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => addDays(weekStart, w * 7 + i)));

  // A day with nothing on it folds into one line with its empty neighbours.
  // Today never folds, and with notes on every day keeps its note editor.
  const isEmptyDay = (day: Date) => {
    if (showNotes || isSameDay(day, today)) return false;
    const bucket = bucketsByDate?.get(format(day, 'yyyy-MM-dd'));
    if (bucket && (bucket.meals.length || bucket.chores.length || bucket.tasks.length)) return false;
    return !scopedEvents.some((event) => eventOccursOnDisplayDay(
      event.startTime,
      event.endTime,
      event.allDay,
      day,
      displayTimezone,
    ));
  };

  const groupHeader = (calendarGroups.length > 0 || showNotes) && (
    <div className={cn('sticky top-0 z-10 flex', twoWeeks && 'bg-background/80 backdrop-blur-xs')}>
      <div className="w-14 shrink-0" />
      {displayGroups.map((group) => (
        <div key={group.id} className="flex-1 min-w-0 px-1 py-1">
          <div
            className="text-sm font-medium text-center py-0.5 rounded truncate"
            style={{ backgroundColor: group.color, color: '#fff' }}
          >
            {group.name}
          </div>
        </div>
      ))}
      {showNotes && (
        <div className="w-2/5 min-w-[180px] border-l border-border px-1 py-1">
          <div
            className="text-sm font-medium text-center py-0.5 rounded text-white"
            style={{ backgroundColor: '#6366f1' }}
          >
            Notes
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div ref={rootRef} className="h-full overflow-y-auto">
      <div className={cn(twoWeeks && 'grid grid-cols-2 gap-x-3 items-start')}>
        {weeks.map((week) => (
          <section key={week[0]!.toISOString()} data-list-week={format(week[0]!, 'yyyy-MM-dd')} className="min-w-0">
            {twoWeeks && (
              <h3 className="px-2 pt-1 text-sm font-semibold text-muted-foreground">
                {d.range(week[0]!, week[6]!)}
              </h3>
            )}
            {groupHeader}
            {foldEmptyDays(week, isEmptyDay).map((run) => run.empty ? (
              <FoldedDays
                key={run.days[0]!.toISOString()}
                days={run.days}
                bordered={bordered}
                enableDnd={displayMode === 'cards' && enableDnd}
                label={t('nothingPlanned')}
              />
            ) : (
              <WeekListDayRow
                key={run.days[0]!.toISOString()}
                day={run.days[0]!}
                today={today}
                events={scopedEvents}
                displayGroups={displayGroups}
                getEventsForGroup={getEventsForGroup}
                bordered={bordered}
                cellBgStyle={cellBgStyle}
                onEventClick={onEventClick}
                showNotes={showNotes}
                notesByDate={notesByDate}
                onNoteChange={onNoteChange}
                displayMode={displayMode}
                bucketsByDate={bucketsByDate}
                enableDnd={enableDnd}
                mealColor={mealColor}
                onItemClick={onItemClick}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Below this width the List view shows one week. */
const TWO_WEEK_MIN_WIDTH = 1100;
/** The day-label gutter (w-14) plus a little slack, per week column. */
const DAY_GUTTER_PX = 64;
/** Narrowest a person's column may get before two weeks fall back to one. */
const MIN_GROUP_COLUMN_PX = 120;

/**
 * Splits a week into runs: each day with something on it is its own run, and
 * consecutive empty days share one run, drawn as a single folded line.
 */
export function foldEmptyDays(days: Date[], isEmpty: (day: Date) => boolean) {
  const runs: Array<{ empty: boolean; days: Date[] }> = [];
  for (const day of days) {
    const empty = isEmpty(day);
    const last = runs[runs.length - 1];
    if (empty && last?.empty) last.days.push(day);
    else runs.push({ empty, days: [day] });
  }
  return runs;
}

/** Width of an element, kept current as it resizes; 0 until measured. */
function useElementWidth(ref: React.RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return width;
}

/**
 * A run of empty days as one line: "Tue 10 – Thu 12 · Nothing planned". With
 * drag and drop on, each day still gets its own drop zone, laid side by side
 * behind the line, so a chore dropped on the line lands on the day under it.
 */
function FoldedDays({
  days,
  bordered,
  enableDnd,
  label,
}: {
  days: Date[];
  bordered: boolean;
  enableDnd: boolean;
  label: string;
}) {
  const d = useDateLabels();
  const first = days[0]!;
  const last = days[days.length - 1]!;
  const dayLabel = (day: Date) => `${d.weekdayShort(day)} ${format(day, 'd')}`;
  return (
    <div
      data-list-folded={`${format(first, 'yyyy-MM-dd')}/${format(last, 'yyyy-MM-dd')}`}
      className={cn('relative flex items-baseline gap-2 px-2 py-1 text-muted-foreground', bordered && 'border-b border-border')}
    >
      {enableDnd && (
        <div className="absolute inset-0 flex">
          {days.map((day) => <FoldedDayDropZone key={day.toISOString()} day={day} />)}
        </div>
      )}
      <span className="relative text-xs font-medium uppercase tracking-wide whitespace-nowrap">
        {days.length > 1 ? `${dayLabel(first)} – ${dayLabel(last)}` : dayLabel(first)}
      </span>
      <span className="relative text-xs truncate">{label}</span>
    </div>
  );
}

function FoldedDayDropZone({ day }: { day: Date }) {
  const { setNodeRef, droppableId, isOver } = useDayDroppable({ date: day, enabled: true });
  return (
    <div
      ref={setNodeRef}
      data-droppable-day={droppableId}
      className={cn('flex-1', isOver && 'ring-2 ring-inset ring-seasonal-accent')}
    />
  );
}

function WeekListDayRow({
  day,
  today,
  events,
  displayGroups,
  getEventsForGroup,
  bordered,
  cellBgStyle,
  onEventClick,
  showNotes,
  notesByDate,
  onNoteChange,
  displayMode,
  bucketsByDate,
  enableDnd,
  mealColor,
  onItemClick,
}: {
  day: Date;
  today: Date;
  events: CalendarEvent[];
  displayGroups: Array<{ id: string; name: string; color: string; userId?: string | null }>;
  getEventsForGroup: (dayEvents: CalendarEvent[], gid: string) => CalendarEvent[];
  bordered: boolean;
  cellBgStyle: React.CSSProperties | undefined;
  onEventClick: (event: CalendarEvent) => void;
  showNotes: boolean;
  notesByDate: Map<string, CalendarNote> | undefined;
  onNoteChange: ((date: string, content: string) => void) | undefined;
  displayMode: 'inline' | 'cards';
  bucketsByDate: Map<string, DayBucket> | undefined;
  enableDnd: boolean;
  mealColor: string | undefined;
  onItemClick: ((ref: OverlayItemRef) => void) | undefined;
}) {
  const { displayTimezone } = useTimeFormat();
  const d = useDateLabels();
  const cards = displayMode === 'cards';
  const dayStart = startOfDay(day);
  const isCurrentDay = isSameDay(day, today);
  const isPast = isBefore(dayStart, today);

  const dayEvents = events.filter((event) => eventOccursOnDisplayDay(
    event.startTime,
    event.endTime,
    event.allDay,
    day,
    displayTimezone,
  ));

  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay).sort((a, b) => {
    const aStartsToday = eventStartsOnDisplayDay(a.startTime, false, day, displayTimezone);
    const bStartsToday = eventStartsOnDisplayDay(b.startTime, false, day, displayTimezone);
    if (aStartsToday !== bStartsToday) return aStartsToday ? 1 : -1;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const droppable = useDayDroppable({ date: day, enabled: cards && enableDnd });

  return (
    <div
      ref={cards && enableDnd ? droppable.setNodeRef : undefined}
      data-droppable-day={cards && enableDnd ? droppable.droppableId : undefined}
      data-list-day={format(day, 'yyyy-MM-dd')}
      className={cn(
        'flex',
        bordered && 'border-b border-border',
        isPast && !isCurrentDay && !cellBgStyle && 'bg-muted/15',
        cards && enableDnd && droppable.isOver && 'ring-2 ring-seasonal-accent shadow-lg',
      )}
      style={cellBgStyle}
    >
      <div
        className={cn(
          'w-14 shrink-0 px-1 py-1 flex flex-col items-center justify-start',
          bordered && 'border-r border-border',
          isPast && !isCurrentDay && 'bg-muted/15',
          isCurrentDay && 'bg-primary text-primary-foreground',
        )}
      >
        <span className={cn(
          'text-xs font-medium uppercase tracking-wide',
          isCurrentDay ? 'text-primary-foreground' : 'text-muted-foreground'
        )}>
          {d.weekdayShort(day)}
        </span>
        <span className={cn(
          'text-xl font-bold leading-none',
          isCurrentDay ? 'text-primary-foreground' : 'text-foreground'
        )}>
          {format(day, 'd')}
        </span>
        {/* The month shows where it changes; the week's heading carries it otherwise. */}
        {day.getDate() === 1 && (
          <span className={cn(
            'text-3xs',
            isCurrentDay ? 'text-primary-foreground/80' : 'text-muted-foreground'
          )}>
            {d.monthShort(day)}
          </span>
        )}
      </div>

      {displayGroups.length > 1 ? (
        <div className="flex-1 flex min-w-0">
          {displayGroups.map((group) => {
            const groupAllDay = getEventsForGroup(allDayEvents, group.id);
            const groupTimed = getEventsForGroup(timedEvents, group.id);
            // Bucket items belong to specific columns by ownership:
            //   meals -> the Family group column
            //   chores/tasks -> the assigned user's group column
            // Unassigned chores/tasks fall through to the Family column too.
            const dayBucket = bucketsByDate?.get(format(day, 'yyyy-MM-dd'));
            // 'all' is the synthetic merged-view group; it should receive every
            // bucket item just like the Family column does in split view.
            const isFamily = group.name === 'Family' || group.id === 'all';
            const groupBucket = dayBucket
              ? {
                  meals: isFamily ? dayBucket.meals : [],
                  chores: dayBucket.chores.filter((c) =>
                    c.assignedTo?.id === group.userId
                      ? true
                      : !c.assignedTo && isFamily
                  ),
                  tasks: dayBucket.tasks.filter((t) =>
                    t.assignedTo?.id === group.userId
                      ? true
                      : !t.assignedTo && isFamily
                  ),
                }
              : undefined;
            return (
              <div key={group.id} className="flex-1 min-w-0 border-l border-border px-1 py-0.5 space-y-0.5">
                <DayEventList
                  day={day}
                  allDayEvents={groupAllDay}
                  timedEvents={groupTimed}
                  onEventClick={onEventClick}
                  isPastDay={isPast && !isCurrentDay}
                  isCurrentDay={isCurrentDay}
                  cards={cards}
                />
                {groupBucket && (
                  <DroppableOverlayCell
                    date={day}
                    bucket={groupBucket}
                    size="sm"
                    layout="row"
                    enableDnd={enableDnd}
                    mealColor={mealColor}
                    onItemClick={onItemClick}
                  />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex-1 px-1 py-0.5 min-w-0 space-y-0.5">
          <DayEventList
            day={day}
            allDayEvents={allDayEvents}
            timedEvents={timedEvents}
            onEventClick={onEventClick}
            isPastDay={isPast && !isCurrentDay}
            isCurrentDay={isCurrentDay}
            cards={cards}
          />
          {bucketsByDate && (
            <DroppableOverlayCell
              date={day}
              bucket={bucketsByDate.get(format(day, 'yyyy-MM-dd'))}
              size="sm"
              layout="row"
              enableDnd={enableDnd}
              mealColor={mealColor}
              onItemClick={onItemClick}
            />
          )}
        </div>
      )}

      {showNotes && (
        <div className="w-2/5 min-w-[180px] border-l border-border">
          <NoteEditor
            dateKey={format(day, 'yyyy-MM-dd')}
            content={notesByDate?.get(format(day, 'yyyy-MM-dd'))?.content || ''}
            onNoteChange={onNoteChange}
            className="px-3 py-2 min-h-touch h-full"
          />
        </div>
      )}
    </div>
  );
}

/** Renders all-day events then timed events in chronological order */
function DayEventList({
  day,
  allDayEvents,
  timedEvents,
  onEventClick,
  isPastDay = false,
  isCurrentDay = false,
  cards = false,
}: {
  day: Date;
  allDayEvents: CalendarEvent[];
  timedEvents: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  isPastDay?: boolean;
  isCurrentDay?: boolean;
  cards?: boolean;
}) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  if (allDayEvents.length === 0 && timedEvents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-0.5">
      {allDayEvents.map((event) => (
        <button
          key={event.id}
          onClick={() => onEventClick(event)}
          className={cn(
            'w-full text-left text-xs px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity truncate block',
            cards && 'bg-card/85 backdrop-blur-xs border border-border/40 shadow-xs',
          )}
          style={
            cards
              ? { borderLeft: `3px solid ${event.color}` }
              : eventTintStyle(event.color, 'border')
          }
        >
          <span className="font-medium text-foreground">{event.title}</span>
        </button>
      ))}
      {timedEvents.map((event) => {
        const startsToday = eventStartsOnDisplayDay(
          event.startTime,
          false,
          day,
          displayTimezone,
        );
        const isPastEvent = isPastDay || (isCurrentDay && isCalendarEventPast(
          event.startTime,
          event.endTime,
          false,
          new Date(),
          displayTimezone,
        ));
        return (
          <button
            key={event.id}
            onClick={() => onEventClick(event)}
            className={cn(
              'w-full text-left text-xs px-1.5 py-0.5 rounded hover:opacity-90 transition-opacity truncate block',
              cards
                ? 'bg-card/85 backdrop-blur-xs border border-border/40 shadow-xs text-foreground'
                : 'text-foreground',
              isPastEvent && 'opacity-70',
            )}
            style={
              cards
                ? { borderLeft: `3px solid ${event.color}` }
                : eventTintStyle(event.color, 'border')
            }
          >
            {startsToday && (
              <span className={cn('mr-1', cards ? 'text-muted-foreground' : 'opacity-80')}>
                {formatDisplayTime(event.startTime, timeFormat, {}, displayTimezone)}
              </span>
            )}
            <span className="font-medium">{event.title}</span>
          </button>
        );
      })}
    </div>
  );
}

