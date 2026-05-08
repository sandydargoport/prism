'use client';

import {
  format,
  isSameDay,
  isBefore,
  startOfDay,
  addDays,
} from 'date-fns';
import { Clock } from 'lucide-react';
import { NoteEditor } from './NoteEditor';
import { cn } from '@/lib/utils';
import { useWidgetBgOverride } from '@/components/widgets/WidgetContainer';
import { useHiddenHours } from '@/lib/hooks/useHiddenHours';
import { calculateEventPositions, positionToCSS } from '@/lib/utils/eventLayout';
import { hexToRgba } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';
import type { CalendarNote } from '@/lib/hooks/useCalendarNotes';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';
import { DroppableOverlayCell, useDayDroppable, getMealTime, getChoreTime, getTaskTime, formatTimeOfDay, type OverlayItemRef } from './cells';
import { WeekItemCard } from './cells/WeekItemCard';

export interface DayViewSideBySideProps {
  currentDate: Date;
  events: CalendarEvent[];
  calendarGroups: Array<{ id: string; name: string; color: string; userId?: string | null }>;
  selectedCalendarIds?: Set<string>;
  mergedView?: boolean;
  bordered?: boolean;
  onEventClick: (event: CalendarEvent) => void;
  showNotes?: boolean;
  notesByDate?: Map<string, CalendarNote>;
  onNoteChange?: (date: string, content: string) => void;
  displayMode?: 'inline' | 'cards';
  bucketsByDate?: Map<string, DayBucket>;
  enableDnd?: boolean;
  /** Override stripe color used for meals (Family calendar-group color). */
  mealColor?: string;
  /** Click handler for meal/chore/task overlay cards (opens edit modal). */
  onItemClick?: (ref: OverlayItemRef) => void;
}

export function DayViewSideBySide({
  currentDate,
  events,
  calendarGroups,
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
}: DayViewSideBySideProps) {
  const cards = displayMode === 'cards';
  const droppable = useDayDroppable({ date: currentDate, enabled: cards && enableDnd });
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;
  const cellBg = bgOverride?.cellBackgroundColor;
  const cellBgOpacity = bgOverride?.cellBackgroundOpacity ?? 1;
  const cellBgStyle = cellBg ? { backgroundColor: hexToRgba(cellBg, cellBgOpacity) } : undefined;

  // Hidden hours hook
  const { settings: hiddenSettings, toggleHidden, getVisibleHours } = useHiddenHours();

  // Time tracking
  const now = new Date();
  const isCurrentDay = isSameDay(currentDate, now);
  const isPastDay = isBefore(startOfDay(currentDate), startOfDay(now)) && !isCurrentDay;
  const currentHour = now.getHours();
  // Snap to 15-min increments: 0%, 25%, 50%, 75%
  const currentMinuteSnapped = Math.floor(now.getMinutes() / 15) * 25;

  // Get visible hours (filtered if hidden mode is enabled)
  const dayStart = startOfDay(currentDate);
  const dayEvents = events.filter((event) =>
    event.allDay
      ? event.startTime <= dayStart && event.endTime > dayStart
      : isSameDay(event.startTime, currentDate)
  );

  const allDayEvents = dayEvents.filter((e) => e.allDay);
  const timedEvents = dayEvents.filter((e) => !e.allDay);

  const hours = getVisibleHours(timedEvents, { from: dayStart, to: addDays(dayStart, 1) });

  // If there are no calendar groups configured or merged view is on, show all events in a single column
  const showAllInOne = calendarGroups.length === 0 || mergedView;

  // Filter groups to only show selected ones (hide columns when filtered out)
  const filteredGroups = selectedCalendarIds && !selectedCalendarIds.has('all')
    ? calendarGroups.filter((g) => selectedCalendarIds.has(g.id))
    : calendarGroups;

  // For single-column mode or when no groups are selected, create a synthetic group
  const displayGroups = showAllInOne || filteredGroups.length === 0
    ? [{ id: 'all', name: 'All Events', color: '#3B82F6' }]
    : filteredGroups;

  const getEventsForGroup = (gid: string) => {
    if (showAllInOne || gid === 'all') {
      return timedEvents;
    }
    return timedEvents.filter((e) => e.groupId === gid);
  };

  const getAllDayEventsForGroup = (gid: string) => {
    if (showAllInOne || gid === 'all') {
      return allDayEvents;
    }
    return allDayEvents.filter((e) => e.groupId === gid);
  };

  // Single scroll container with sticky header — same layout context keeps columns aligned.
  // min-h-full flex-col inner wrapper makes the hourly grid stretch to fill available space.
  return (
    <div
      ref={cards && enableDnd ? droppable.setNodeRef : undefined}
      data-droppable-day={cards && enableDnd ? droppable.droppableId : undefined}
      className={cn(
        'h-full rounded-md overflow-hidden',
        !transparentMode && 'bg-card/85 backdrop-blur-sm',
        cards && enableDnd && droppable.isOver && 'ring-2 ring-seasonal-accent shadow-lg',
      )}
    >
      <div className="h-full overflow-y-auto">
        <div className="h-full min-h-full flex flex-col">
          {/* Sticky all-day / group-label header */}
          <div className={cn('flex sticky top-0 z-20', !transparentMode && 'bg-card/95')}>
            {/* Time column header with toggle button */}
            <div className="w-16 flex-shrink-0 flex items-center justify-center">
              <button
                onClick={toggleHidden}
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  hiddenSettings.enabled
                    ? 'bg-blue-500 text-white'
                    : 'hover:bg-accent text-muted-foreground'
                )}
                title={hiddenSettings.enabled ? 'Show all hours' : 'Hide time block'}
              >
                <Clock className="h-4 w-4" />
              </button>
            </div>
            {displayGroups.map((group) => {
              const calAllDay = getAllDayEventsForGroup(group.id);
              const isFamily = group.name === 'Family' || group.id === 'all';
              const dayBucketForHeader = bucketsByDate?.get(format(currentDate, 'yyyy-MM-dd'));
              // Untimed chores/tasks render in the SAME column as the all-day
              // events for that group, so a profile column that has no all-day
              // event but does have an untimed chore renders it on the same
              // row as a sibling column's all-day event (instead of dropping
              // to a separate row below the header).
              const untimedBucket = dayBucketForHeader
                ? {
                    meals: [] as typeof dayBucketForHeader.meals,
                    chores: dayBucketForHeader.chores.filter((c) => {
                      if (getChoreTime(c)) return false;
                      if (group.id === 'all') return true;
                      return c.assignedTo?.id === group.userId
                        || (!c.assignedTo && isFamily);
                    }),
                    tasks: dayBucketForHeader.tasks.filter((t) => {
                      if (getTaskTime(t)) return false;
                      if (group.id === 'all') return true;
                      return t.assignedTo?.id === group.userId
                        || (!t.assignedTo && isFamily);
                    }),
                  }
                : null;
              const hasUntimed = Boolean(
                untimedBucket && (untimedBucket.chores.length + untimedBucket.tasks.length > 0)
              );
              return (
                <div key={group.id} className="flex-1 min-w-0 border-l border-border p-1">
                  <div
                    className="text-sm font-medium text-center py-1 mb-1 rounded text-white"
                    style={{ backgroundColor: group.color }}
                  >
                    {group.name}
                  </div>
                  {calAllDay.length > 0 && (
                    <div className="space-y-0.5">
                      {calAllDay.map((event) => (
                        <button
                          key={event.id}
                          onClick={() => onEventClick(event)}
                          className={cn(
                            'w-full text-left text-xs px-1 py-0.5 rounded truncate hover:opacity-80 hover:ring-2 hover:ring-seasonal-accent/50 transition-all',
                            cards && 'bg-card/85 backdrop-blur-sm border border-border/40 shadow-sm text-foreground',
                          )}
                          style={
                            cards
                              ? { borderLeft: `3px solid ${event.color}` }
                              : { backgroundColor: event.color, color: '#fff', borderLeft: `2px solid ${event.color}` }
                          }
                        >
                          {event.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {hasUntimed && untimedBucket && (
                    <div className={cn(calAllDay.length > 0 && 'mt-0.5')}>
                      <DroppableOverlayCell
                        date={currentDate}
                        bucket={untimedBucket}
                        size="sm"
                        layout="row"
                        enableDnd={enableDnd}
                        mealColor={mealColor}
                        onItemClick={onItemClick}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {showNotes && (
              <div className="w-2/5 min-w-[180px] border-l border-border p-1">
                <div
                  className="text-sm font-medium text-center py-1 mb-1 rounded text-white"
                  style={{ backgroundColor: '#6366f1' }}
                >
                  Notes
                </div>
              </div>
            )}
          </div>

          {/* Untimed overlay items (chores/tasks without a time) render
              alongside each group's all-day events in the sticky header above,
              not in a separate row, so a column with only an untimed chore
              shares the row with a sibling column's all-day event. */}

          {/* Hourly grid — flex-1 fills remaining space; 1fr rows stretch when hours are hidden */}
          <div className="flex-1 flex">
            {/* Time column */}
            <div className="w-16 flex-shrink-0 h-full grid" style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}>
              {hours.map((hour) => {
                const isPastHour = isPastDay || (isCurrentDay && hour < currentHour);
                const isNowHour = isCurrentDay && hour === currentHour;
                return (
                  <div key={hour} className={cn(
                    'pl-1 pr-2 text-right text-xs flex items-start pt-0.5 min-h-0 relative text-muted-foreground',
                    bordered && 'border-t border-border',
                    isPastHour && 'bg-muted/15',
                    isNowHour && 'bg-primary text-primary-foreground font-semibold rounded-sm'
                  )}>
                    {format(new Date().setHours(hour, 0), 'h a')}
                    {isNowHour && (
                      <div className="absolute left-0 right-0 border-t-2 border-t-primary z-20 pointer-events-none" style={{ top: `${currentMinuteSnapped}%` }} />
                    )}
                  </div>
                );
              })}
            </div>
            {/* Group columns. Each column is its own relative container so a
                per-group TimedBucketLayer can absolute-position meals (Family
                only) and chores/tasks for that group's assigned user. */}
            {displayGroups.map((group) => {
              const calEvents = getEventsForGroup(group.id);
              const groupPositions = calculateEventPositions(calEvents);
              const isFamily = group.name === 'Family' || group.id === 'all';
              const dayBucket = bucketsByDate?.get(format(currentDate, 'yyyy-MM-dd'));
              const groupTimedBucket = dayBucket
                ? {
                    meals: isFamily ? dayBucket.meals : [],
                    chores: dayBucket.chores.filter((c) => {
                      if (!getChoreTime(c)) return false;
                      if (group.id === 'all') return true;
                      return c.assignedTo?.id === group.userId
                        || (!c.assignedTo && isFamily);
                    }),
                    tasks: dayBucket.tasks.filter((t) => {
                      if (!getTaskTime(t)) return false;
                      if (group.id === 'all') return true;
                      return t.assignedTo?.id === group.userId
                        || (!t.assignedTo && isFamily);
                    }),
                  }
                : null;
              return (
                <div
                  key={group.id}
                  className="relative flex-1 min-w-0 h-full border-l border-border"
                ><div
                  className="grid h-full"
                  style={{ gridTemplateRows: `repeat(${hours.length}, 1fr)` }}
                >
                  {hours.map((hour) => {
                    const hourEvents = calEvents.filter((event) => event.startTime.getHours() === hour);
                    const isPastHour = isPastDay || (isCurrentDay && hour < currentHour);
                    const isNowHour = isCurrentDay && hour === currentHour;
                    return (
                      <div key={hour} className={cn(
                        'relative min-h-0 overflow-visible',
                        bordered && 'border-t border-border',
                        isPastHour && !cellBgStyle && 'bg-muted/15'
                      )} style={cellBgStyle}>
                        {isNowHour && (
                          <div className="absolute left-0 right-0 border-t-2 border-t-primary z-20 pointer-events-none" style={{ top: `${currentMinuteSnapped}%` }} />
                        )}
                        {hourEvents.map((event) => {
                          const pos = groupPositions.get(event.id);
                          if (!pos) return null;
                          const css = positionToCSS(pos);
                          const durationMin = ((event.endTime?.getTime() ?? (event.startTime.getTime() + 3600000)) - event.startTime.getTime()) / 60000;
                          const heightPct = Math.max((durationMin / 60) * 100, 20);
                          return (
                            <button
                              key={event.id}
                              onClick={() => onEventClick(event)}
                              className={cn(
                                'absolute p-0.5 rounded text-left text-xs z-10 overflow-hidden hover:opacity-90 hover:ring-2 hover:ring-seasonal-accent/50 transition-all flex flex-col items-start',
                                cards && 'bg-card/85 backdrop-blur-sm border border-border/40 shadow-sm',
                              )}
                              style={
                                cards
                                  ? {
                                      borderLeft: `3px solid ${event.color}`,
                                      top: `calc(${(event.startTime.getMinutes() / 60) * 100}% + 2px)`,
                                      height: `calc(${heightPct}% - 4px)`,
                                      left: css.left,
                                      width: css.width,
                                    }
                                  : {
                                      backgroundColor: event.color,
                                      color: '#fff',
                                      borderLeft: `2px solid ${event.color}`,
                                      top: `${(event.startTime.getMinutes() / 60) * 100}%`,
                                      height: `${heightPct}%`,
                                      left: css.left,
                                      width: css.width,
                                    }
                              }
                            >
                              {/* Title first; show time row only when the
                                  block is at least an hour. 45-min and shorter
                                  blocks fit only one line without clipping. */}
                              <div className={cn('font-medium truncate w-full text-[11px] leading-tight', cards && 'text-foreground')}>{event.title}</div>
                              {durationMin >= 60 && (
                                <div className={cn('text-[9px] leading-tight', cards ? 'text-muted-foreground' : 'opacity-70')}>
                                  {format(event.startTime, 'h:mm')}&ndash;{format(event.endTime ?? new Date(event.startTime.getTime() + 3600000), 'h:mm a')}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                {/* Per-group timed-overlay: meals only in Family column,
                    chores/tasks in the assignee's column. */}
                {cards && groupTimedBucket && (
                  <DayTimedBucketLayer
                    bucket={groupTimedBucket as DayBucket}
                    hours={hours}
                    mealColor={mealColor}
                    enableDnd={enableDnd}
                    onItemClick={onItemClick}
                  />
                )}
                </div>
              );
            })}
            {/* Notes column */}
            {showNotes && (
              <div className="w-2/5 min-w-[180px] h-full border-l border-border flex flex-col">
                <div className={cn('shrink-0', bordered && 'border-t border-border')} />
                <div className="flex-1 min-h-0">
                  <NoteEditor
                    dateKey={format(currentDate, 'yyyy-MM-dd')}
                    content={notesByDate?.get(format(currentDate, 'yyyy-MM-dd'))?.content || ''}
                    onNoteChange={onNoteChange}
                    className="px-3 py-2 h-full"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders a day's bucket items (meals, chores, tasks WITH a time-of-day) at
 * their time over the hour grid, spanning all calendar-group columns. Items
 * without a time render in the untimed-overlay row above the grid.
 */
function DayTimedBucketLayer({
  bucket,
  hours,
  mealColor,
  enableDnd,
  onItemClick,
}: {
  bucket: DayBucket;
  hours: number[];
  mealColor: string | undefined;
  enableDnd: boolean;
  onItemClick?: (ref: OverlayItemRef) => void;
}) {
  const slotPct = 100 / hours.length;
  const visibleSet = new Set(hours);

  type Placed = {
    key: string;
    dragId: string;
    variant: 'meal' | 'chore' | 'task';
    title: string;
    timeLabel: string;
    subtitle?: string;
    stripeColor: string;
    muted?: boolean;
    pendingApproval?: boolean;
    rowIndex: number;
    minute: number;
    durationMin: number;
  };

  const placed: Placed[] = [];

  for (const meal of bucket.meals) {
    const t = getMealTime(meal);
    const hh = Number(t.slice(0, 2));
    if (!visibleSet.has(hh)) continue;
    const mm = Number(t.slice(3, 5));
    placed.push({
      key: `meal-${meal.id}`,
      dragId: `meal:${meal.id}`,
      variant: 'meal',
      title: meal.name,
      timeLabel: formatTimeOfDay(t),
      subtitle: meal.cookedBy?.name ? `Cooked by ${meal.cookedBy.name}` : undefined,
      stripeColor: mealColor ?? '#10b981',
      muted: Boolean(meal.cookedAt),
      rowIndex: hours.indexOf(hh),
      minute: mm,
      durationMin: meal.mealType === 'dinner' ? 60 : 30,
    });
  }
  for (const chore of bucket.chores) {
    const t = getChoreTime(chore);
    if (!t) continue;
    const hh = Number(t.slice(0, 2));
    if (!visibleSet.has(hh)) continue;
    const mm = Number(t.slice(3, 5));
    placed.push({
      key: `chore-${chore.id}`,
      dragId: `chore:${chore.id}`,
      variant: 'chore',
      title: chore.title,
      timeLabel: formatTimeOfDay(t),
      subtitle: chore.assignedTo?.name,
      stripeColor: chore.assignedTo?.color || '#f59e0b',
      pendingApproval: Boolean(chore.pendingApproval),
      rowIndex: hours.indexOf(hh),
      minute: mm,
      durationMin: 30,
    });
  }
  for (const task of bucket.tasks) {
    const t = getTaskTime(task);
    if (!t) continue;
    const hh = Number(t.slice(0, 2));
    if (!visibleSet.has(hh)) continue;
    const mm = Number(t.slice(3, 5));
    placed.push({
      key: `task-${task.id}`,
      dragId: `task:${task.id}`,
      variant: 'task',
      title: task.title,
      timeLabel: formatTimeOfDay(t),
      subtitle: task.assignedTo?.name,
      stripeColor: task.assignedTo?.color || '#3b82f6',
      muted: task.completed,
      rowIndex: hours.indexOf(hh),
      minute: mm,
      durationMin: 30,
    });
  }

  if (placed.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {placed.map((p) => {
        const topPct = (p.rowIndex + p.minute / 60) * slotPct;
        const heightPct = (p.durationMin / 60) * slotPct;
        return (
          <div
            key={p.key}
            className="absolute pointer-events-auto px-1"
            style={{ top: `${topPct}%`, height: `${heightPct}%`, left: 0, right: 0, zIndex: 5 }}
          >
            <WeekItemCard
              onClick={onItemClick ? () => onItemClick({ kind: p.variant, id: p.dragId.split(':')[1]! }) : undefined}
              variant={p.variant}
              size="sm"
              layout="row"
              stripeColor={p.stripeColor}
              title={p.title}
              timeLabel={p.timeLabel}
              subtitle={p.subtitle}
              muted={p.muted}
              pendingApproval={p.pendingApproval}
              dragId={enableDnd ? p.dragId : undefined}
            />
          </div>
        );
      })}
    </div>
  );
}

