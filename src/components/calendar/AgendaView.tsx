'use client';

import {
  format,
  isSameDay,
  addDays,
  startOfDay,
} from 'date-fns';
import { Calendar, UtensilsCrossed } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui';
import type { CalendarEvent } from '@/types/calendar';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';
import { useDayDroppable, getMealTime, getChoreTime, getTaskTime, parseTimeOfDay, formatTimeOfDay, type OverlayItemRef } from './cells';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, toDisplayDate, type TimeFormat } from '@/lib/utils/timeFormat';

const MEAL_FALLBACK_COLOR = '#10b981';
const CHORE_FALLBACK_COLOR = '#f59e0b';
const TASK_FALLBACK_COLOR = '#3b82f6';

export interface AgendaViewProps {
  events: CalendarEvent[];
  days?: number;
  maxEventsPerDay?: number;
  onEventClick?: (event: CalendarEvent) => void;
  emptyMessage?: string;
  displayMode?: 'inline' | 'cards';
  bucketsByDate?: Map<string, DayBucket>;
  enableDnd?: boolean;
  /** Override stripe color used for meals (Family calendar-group color). */
  mealColor?: string;
  /** Click handler for meal/chore/task overlay rows (opens edit modal). */
  onItemClick?: (ref: OverlayItemRef) => void;
}

/**
 * A unified agenda row — events, meals, chores, and tasks rendered with the
 * same height, padding, and stripe pattern. Meal/chore/task variants carry a
 * dragId so they can be dragged to other day sections; events stay read-only.
 */
type AgendaRow = {
  key: string;
  /** Sort key in minutes-since-midnight. Items without a time sort to the top. */
  sortMinutes: number;
  /** Whether this row has no time-of-day (renders "All day" / "—"). */
  floating: boolean;
  /** Optional drag id (`meal:<id>` etc.). Read-only for events. */
  dragId?: string;
  stripeColor: string;
  timeLabel: string;
  title: string;
  subtitle?: string;
  muted?: boolean;
  pendingApproval?: boolean;
  onClick?: () => void;
};

export function AgendaView({
  events,
  days = 14,
  maxEventsPerDay = 0,
  onEventClick,
  emptyMessage = 'No upcoming events',
  displayMode = 'inline',
  bucketsByDate,
  enableDnd = false,
  mealColor,
  onItemClick,
}: AgendaViewProps) {
  const { displayTimezone } = useTimeFormat();
  const cards = displayMode === 'cards';
  const startDate = startOfDay(toDisplayDate(new Date(), displayTimezone));
  const endDate = addDays(startDate, days);

  const filteredEvents = events
    .filter(e => {
      if (e.allDay) {
        return e.startTime < endDate && e.endTime > startDate;
      }
      const ed = startOfDay(toDisplayDate(e.startTime, displayTimezone));
      return ed >= startDate && ed < endDate;
    })
    .sort((a, b) => {
      const dc = startOfDay(toDisplayDate(a.startTime, displayTimezone)).getTime()
        - startOfDay(toDisplayDate(b.startTime, displayTimezone)).getTime();
      if (dc !== 0) return dc;
      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;
      return a.startTime.getTime() - b.startTime.getTime();
    });

  const eventsByDay: Array<{ date: Date; events: CalendarEvent[]; bucket?: DayBucket }> = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dayStart = startOfDay(date);
    const dayEvents = filteredEvents.filter(e =>
      e.allDay
        ? e.startTime <= dayStart && e.endTime > dayStart
        : isSameDay(toDisplayDate(e.startTime, displayTimezone), date)
    );
    const bucket = bucketsByDate?.get(format(date, 'yyyy-MM-dd'));
    const hasOverlay = bucket && (bucket.meals.length + bucket.chores.length + bucket.tasks.length > 0);
    if (dayEvents.length > 0 || hasOverlay) {
      eventsByDay.push({ date, events: dayEvents, bucket });
    }
  }

  if (eventsByDay.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
        <Calendar className="h-8 w-8" />
        <span className="text-sm">{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full -mr-2 pr-2">
      <div className="space-y-4">
        {eventsByDay.map(({ date, events: dayEvts, bucket }) => (
          <AgendaDaySection
            key={date.toISOString()}
            date={date}
            events={dayEvts}
            bucket={bucket}
            maxEvents={maxEventsPerDay}
            onEventClick={onEventClick}
            cards={cards}
            enableDnd={enableDnd}
            mealColor={mealColor}
            onItemClick={onItemClick}
          />
        ))}
      </div>
    </div>
  );
}

function AgendaDaySection({
  date,
  events,
  bucket,
  maxEvents,
  onEventClick,
  cards = false,
  enableDnd = false,
  mealColor,
  onItemClick,
}: {
  date: Date;
  events: CalendarEvent[];
  bucket?: DayBucket;
  maxEvents: number;
  onEventClick?: (event: CalendarEvent) => void;
  cards?: boolean;
  enableDnd?: boolean;
  mealColor?: string;
  onItemClick?: (ref: OverlayItemRef) => void;
}) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const droppable = useDayDroppable({ date, enabled: cards && enableDnd });
  const rows = buildAgendaRows({ events, bucket, onEventClick, mealColor, onItemClick, timeFormat, displayTimezone });
  const displayRows = maxEvents > 0 ? rows.slice(0, maxEvents) : rows;
  const remainingCount = maxEvents > 0 ? rows.length - maxEvents : 0;

  return (
    <div
      ref={cards && enableDnd ? droppable.setNodeRef : undefined}
      data-droppable-day={cards && enableDnd ? droppable.droppableId : undefined}
      className={cn(
        'rounded',
        cards && enableDnd && droppable.isOver && 'ring-2 ring-seasonal-accent shadow-sm bg-card/40 p-1',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <span
          className={cn(
            'text-sm font-semibold',
            isSameDay(date, toDisplayDate(new Date(), displayTimezone)) && 'text-seasonal-accent'
          )}
        >
          {formatAgendaDayHeader(date, displayTimezone)}
        </span>
        {isSameDay(date, toDisplayDate(new Date(), displayTimezone)) && (
          <Badge className="text-[10px] px-1.5 py-0 bg-seasonal-highlight text-foreground">
            Today
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 pl-2 border-l-2 border-border">
        {displayRows.map((row) => (
          <AgendaRowItem key={row.key} row={row} cards={cards} />
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

function buildAgendaRows({
  events,
  bucket,
  onEventClick,
  mealColor,
  onItemClick,
  timeFormat,
  displayTimezone,
}: {
  events: CalendarEvent[];
  bucket?: DayBucket;
  onEventClick?: (event: CalendarEvent) => void;
  mealColor?: string;
  onItemClick?: (ref: OverlayItemRef) => void;
  timeFormat: TimeFormat;
  displayTimezone: string;
}): AgendaRow[] {
  const rows: AgendaRow[] = [];

  for (const event of events) {
    const allDay = event.allDay;
    rows.push({
      key: `event-${event.id}`,
      sortMinutes: allDay
        ? -1
        : toDisplayDate(event.startTime, displayTimezone).getHours() * 60
          + toDisplayDate(event.startTime, displayTimezone).getMinutes(),
      floating: allDay,
      stripeColor: event.color,
      timeLabel: allDay ? 'All day' : formatDisplayTime(event.startTime, timeFormat, {}, displayTimezone),
      title: event.title,
      subtitle: event.location,
      onClick: onEventClick ? () => onEventClick(event) : undefined,
    });
  }

  if (bucket) {
    for (const meal of bucket.meals) {
      const t = getMealTime(meal);
      const min = parseTimeOfDay(t);
      rows.push({
        key: `meal-${meal.id}`,
        sortMinutes: min ?? -1,
        floating: min === null,
        dragId: `meal:${meal.id}`,
        stripeColor: mealColor ?? meal.cookedBy?.color ?? meal.createdBy?.color ?? MEAL_FALLBACK_COLOR,
        timeLabel: min !== null ? formatTimeLabel(t, timeFormat) : meal.mealType,
        title: meal.name,
        subtitle: meal.cookedBy?.name ? `Cooked by ${meal.cookedBy.name}` : undefined,
        muted: Boolean(meal.cookedAt),
        onClick: onItemClick ? () => onItemClick({ kind: 'meal', id: meal.id }) : undefined,
      });
    }
    for (const chore of bucket.chores) {
      const t = getChoreTime(chore);
      const min = parseTimeOfDay(t);
      rows.push({
        key: `chore-${chore.id}`,
        sortMinutes: min ?? -1,
        floating: min === null,
        dragId: `chore:${chore.id}`,
        stripeColor: chore.assignedTo?.color || CHORE_FALLBACK_COLOR,
        timeLabel: min !== null ? formatTimeLabel(t!, timeFormat) : 'Chore',
        title: chore.title,
        subtitle: chore.assignedTo?.name,
        pendingApproval: Boolean(chore.pendingApproval),
        onClick: onItemClick ? () => onItemClick({ kind: 'chore', id: chore.id }) : undefined,
      });
    }
    for (const task of bucket.tasks) {
      const t = getTaskTime(task);
      const min = parseTimeOfDay(t);
      rows.push({
        key: `task-${task.id}`,
        sortMinutes: min ?? -1,
        floating: min === null,
        dragId: `task:${task.id}`,
        stripeColor: task.assignedTo?.color || TASK_FALLBACK_COLOR,
        timeLabel: min !== null ? formatTimeLabel(t!, timeFormat) : 'Task',
        title: task.title,
        subtitle: task.assignedTo?.name,
        muted: task.completed,
        onClick: onItemClick ? () => onItemClick({ kind: 'task', id: task.id }) : undefined,
      });
    }
  }

  // Floating items (all-day events, untimed chores/tasks) come first; timed
  // items follow in chronological order.
  rows.sort((a, b) => {
    if (a.floating && !b.floating) return -1;
    if (!a.floating && b.floating) return 1;
    return a.sortMinutes - b.sortMinutes;
  });
  return rows;
}

function formatTimeLabel(hhmm: string, timeFormat: TimeFormat): string {
  return formatTimeOfDay(hhmm, timeFormat);
}

function AgendaRowItem({ row, cards = false }: { row: AgendaRow; cards?: boolean }) {
  const draggable = useDraggable({
    id: row.dragId ?? `__static__:${row.key}`,
    disabled: !row.dragId,
    data: { dragId: row.dragId },
  });

  const transformStyle: React.CSSProperties = {
    transform: CSS.Translate.toString(draggable.transform),
    touchAction: row.dragId ? 'none' : undefined,
    zIndex: draggable.isDragging ? 50 : undefined,
    borderLeft: `3px solid ${row.stripeColor}`,
    backgroundColor: cards ? undefined : row.stripeColor,
  };

  const Tag: 'button' | 'div' = row.onClick ? 'button' : 'div';

  return (
    <Tag
      ref={row.dragId ? draggable.setNodeRef : undefined}
      onClick={row.onClick}
      type={Tag === 'button' ? 'button' : undefined}
      style={transformStyle}
      {...(row.dragId ? draggable.listeners : {})}
      {...(row.dragId ? draggable.attributes : {})}
      className={cn(
        'relative w-full text-left flex items-start gap-2 p-1.5 rounded',
        cards
          ? 'bg-card/85 backdrop-blur-sm border border-border/40 shadow-sm hover:bg-card text-foreground'
          : 'hover:opacity-90 text-white',
        'transition-colors touch-action-manipulation',
        row.dragId && 'cursor-grab active:cursor-grabbing',
        draggable.isDragging && 'opacity-60 ring-2 ring-seasonal-accent shadow-xl',
        row.muted && 'opacity-60',
      )}
    >
      {row.pendingApproval && (
        <span
          aria-hidden
          className="absolute inset-0 pointer-events-none rounded"
          style={{ background: 'repeating-linear-gradient(45deg, rgba(168,85,247,0.18) 0 6px, rgba(168,85,247,0) 6px 12px)' }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className={cn('text-xs', cards ? 'text-muted-foreground' : 'opacity-80')}>
          {row.timeLabel}
        </div>
        <div className={cn('flex items-center gap-1 text-sm font-medium', cards ? 'text-foreground' : 'text-white', row.muted && 'line-through')}>
          {row.dragId?.startsWith('meal:') && (
            <UtensilsCrossed aria-hidden className="h-3 w-3 shrink-0" style={cards ? { color: row.stripeColor } : undefined} />
          )}
          <span className="truncate">{row.title}</span>
        </div>
        {row.subtitle && (
          <div className={cn('text-xs truncate', cards ? 'text-muted-foreground' : 'opacity-80')}>
            {row.subtitle}
          </div>
        )}
      </div>
    </Tag>
  );
}

function formatAgendaDayHeader(date: Date, displayTimezone: string): string {
  const displayNow = toDisplayDate(new Date(), displayTimezone);
  const dayName = format(date, 'EEEE, MMMM d, yyyy');
  if (isSameDay(date, displayNow)) return `Today - ${dayName}`;
  if (isSameDay(date, addDays(displayNow, 1))) return `Tomorrow - ${dayName}`;
  return dayName;
}
