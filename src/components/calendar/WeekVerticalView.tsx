'use client';

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
import { formatDisplayTime, toDisplayDate } from '@/lib/utils/timeFormat';

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
  const weekStart = startOfWeek(currentDate, { weekStartsOn });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const now = toDisplayDate(new Date(), displayTimezone);
  const today = startOfDay(now);
  const currentHour = now.getHours();

  // Determine display groups (same logic as DayViewSideBySide)
  const showAllInOne = calendarGroups.length === 0 || mergedView;
  const filteredGroups = selectedCalendarIds && !selectedCalendarIds.has('all')
    ? calendarGroups.filter((g) => selectedCalendarIds.has(g.id))
    : calendarGroups;
  const displayGroups = showAllInOne || filteredGroups.length === 0
    ? [{ id: 'all', name: 'All Events', color: '#3B82F6' }]
    : filteredGroups;

  const getEventsForGroup = (dayEvents: CalendarEvent[], gid: string) => {
    if (showAllInOne || gid === 'all') return dayEvents;
    return dayEvents.filter((e) => e.groupId === gid);
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Group column headers (no background bar to match day view) */}
      {(calendarGroups.length > 0 || showNotes) && (
        <div className="sticky top-0 z-10 flex">
          <div className="w-16 shrink-0" />
          {displayGroups.map((group) => (
            <div key={group.id} className="flex-1 min-w-0 px-1 py-1">
              <div
                className="text-sm font-medium text-center py-1 rounded"
                style={{ backgroundColor: group.color, color: '#fff' }}
              >
                {group.name}
              </div>
            </div>
          ))}
          {showNotes && (
            <div className="w-2/5 min-w-[180px] border-l border-border px-1 py-1">
              <div
                className="text-sm font-medium text-center py-1 rounded text-white"
                style={{ backgroundColor: '#6366f1' }}
              >
                Notes
              </div>
            </div>
          )}
        </div>
      )}

      {days.map((day) => (
        <WeekListDayRow
          key={day.toISOString()}
          day={day}
          today={today}
          events={events}
          displayGroups={displayGroups}
          getEventsForGroup={getEventsForGroup}
          bordered={bordered}
          cellBgStyle={cellBgStyle}
          currentHour={currentHour}
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
    </div>
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
  currentHour,
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
  currentHour: number;
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
  const cards = displayMode === 'cards';
  const dayStart = startOfDay(day);
  const isCurrentDay = isSameDay(day, today);
  const isPast = isBefore(dayStart, today);

  const dayEvents = events.filter((event) => {
    const eventStart = toDisplayDate(event.startTime, displayTimezone);
    const eventEnd = toDisplayDate(event.endTime, displayTimezone);
    return eventStart < addDays(dayStart, 1) && eventEnd > dayStart;
  });

  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const droppable = useDayDroppable({ date: day, enabled: cards && enableDnd });

  return (
    <div
      ref={cards && enableDnd ? droppable.setNodeRef : undefined}
      data-droppable-day={cards && enableDnd ? droppable.droppableId : undefined}
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
          'w-16 shrink-0 p-2 flex flex-col items-center justify-start',
          bordered && 'border-r border-border',
          isPast && !isCurrentDay && 'bg-muted/15',
          isCurrentDay && 'bg-primary text-primary-foreground',
        )}
      >
        <span className={cn(
          'text-xs font-medium uppercase tracking-wide',
          isCurrentDay ? 'text-primary-foreground' : 'text-muted-foreground'
        )}>
          {format(day, 'EEE')}
        </span>
        <span className={cn(
          'text-2xl font-bold leading-tight',
          isCurrentDay ? 'text-primary-foreground' : 'text-foreground'
        )}>
          {format(day, 'd')}
        </span>
        <span className={cn(
          'text-[10px]',
          isCurrentDay ? 'text-primary-foreground/80' : 'text-muted-foreground'
        )}>
          {format(day, 'MMM')}
        </span>
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
              <div key={group.id} className="flex-1 min-w-0 border-l border-border p-1 space-y-0.5">
                <DayEventList
                  allDayEvents={groupAllDay}
                  timedEvents={groupTimed}
                  onEventClick={onEventClick}
                  isPastDay={isPast && !isCurrentDay}
                  isCurrentDay={isCurrentDay}
                  currentHour={currentHour}
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
        <div className="flex-1 p-1.5 min-w-0 space-y-1">
          <DayEventList
            allDayEvents={allDayEvents}
            timedEvents={timedEvents}
            onEventClick={onEventClick}
            isPastDay={isPast && !isCurrentDay}
            isCurrentDay={isCurrentDay}
            currentHour={currentHour}
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
            className="px-3 py-2 min-h-[48px] h-full"
          />
        </div>
      )}
    </div>
  );
}

/** Renders all-day events then timed events in chronological order */
function DayEventList({
  allDayEvents,
  timedEvents,
  onEventClick,
  isPastDay = false,
  isCurrentDay = false,
  currentHour = 0,
  cards = false,
}: {
  allDayEvents: CalendarEvent[];
  timedEvents: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  isPastDay?: boolean;
  isCurrentDay?: boolean;
  currentHour?: number;
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
            'w-full text-left text-xs px-1.5 py-1 rounded hover:opacity-80 transition-opacity truncate block',
            cards && 'bg-card/85 backdrop-blur-sm border border-border/40 shadow-sm',
          )}
          style={
            cards
              ? { borderLeft: `3px solid ${event.color}` }
              : { backgroundColor: event.color, borderLeft: `3px solid ${event.color}` }
          }
        >
          <span className={cn('font-medium', cards ? 'text-foreground' : 'text-white')}>{event.title}</span>
        </button>
      ))}
      {timedEvents.map((event) => {
        const isPastEvent = isPastDay || (isCurrentDay && toDisplayDate(event.startTime, displayTimezone).getHours() < currentHour);
        return (
          <button
            key={event.id}
            onClick={() => onEventClick(event)}
            className={cn(
              'w-full text-left text-xs px-1.5 py-1 rounded hover:opacity-90 transition-opacity truncate block',
              cards
                ? 'bg-card/85 backdrop-blur-sm border border-border/40 shadow-sm text-foreground'
                : 'text-white',
              isPastEvent && 'opacity-70',
            )}
            style={
              cards
                ? { borderLeft: `3px solid ${event.color}` }
                : { backgroundColor: event.color, borderLeft: `3px solid ${event.color}` }
            }
          >
            <span className={cn('mr-1', cards ? 'text-muted-foreground' : 'opacity-80')}>{formatDisplayTime(event.startTime, timeFormat, {}, displayTimezone)}</span>
            <span className="font-medium">{event.title}</span>
          </button>
        );
      })}
    </div>
  );
}

