'use client';

import * as React from 'react';
import { useMemo, useCallback, useState, useContext, lazy, Suspense } from 'react';
import { format, isToday, isTomorrow, startOfWeek, endOfWeek, addDays, addWeeks, startOfMonth, endOfMonth } from 'date-fns';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Calendar, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isLightColor } from '@/lib/utils/color';
import { deduplicateEvents } from '@/lib/utils/calendarDedup';
import { WidgetContainer, useWidgetBgOverride } from './WidgetContainer';
import { useCalendarEvents, useCalendarFilter, useCalendarNotes } from '@/lib/hooks';
import { useDayBucketsForRange } from '@/lib/hooks/useDayBucketsForRange';
import { useWeekMutations } from '@/lib/hooks/useWeekMutations';
import { useAuth } from '@/components/providers';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { useCalendarWidgetPrefs, VIEW_OPTIONS, CalendarPrefsScopeContext } from '@/lib/hooks/useCalendarWidgetPrefs';
import { CalendarWidgetControls } from './CalendarWidgetControls';
import type { CalendarEvent } from '@/types/calendar';
export type { CalendarEvent };

const MonthView = lazy(() => import('@/components/calendar/MonthView').then(m => ({ default: m.MonthView })));
const WeekView = lazy(() => import('@/components/calendar/WeekView').then(m => ({ default: m.WeekView })));
const MultiWeekView = lazy(() => import('@/components/calendar/MultiWeekView').then(m => ({ default: m.MultiWeekView })));
const DayViewSideBySide = lazy(() => import('@/components/calendar/DayViewSideBySide').then(m => ({ default: m.DayViewSideBySide })));
const WeekVerticalView = lazy(() => import('@/components/calendar/WeekVerticalView').then(m => ({ default: m.WeekVerticalView })));
const AgendaView = lazy(() => import('@/components/calendar/AgendaView').then(m => ({ default: m.AgendaView })));

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

export const CalendarWidget = React.memo(function CalendarWidget({
  events: externalEvents,
  loading: externalLoading,
  error: externalError,
  onEventClick,
  titleHref,
  className,
  gridW = 2,
  gridH = 2,
}: CalendarWidgetProps) {
  const { activeUser } = useAuth();
  const { weekStartsOn } = useWeekStartsOn();
  const bgOverride = useWidgetBgOverride();
  const transparentMode = bgOverride?.hasCustomBg === true;

  const {
    currentDate, setCurrentDate,
    widgetBordered, setWidgetBordered,
    mergedView, setMergedView,
    showNotes, setShowNotes,
    viewType, setViewType,
    displayMode, setDisplayMode,
    hideWeekends, setHideWeekends,
    overlays, setOverlays,
    availableViews, effectiveView, resolvedView, resolvedWeekCount, viewUnavailable,
    goToToday, goToPrevious, goToNext,
  } = useCalendarWidgetPrefs(gridW, gridH, useContext(CalendarPrefsScopeContext));

  const { events: apiEvents, loading: apiLoading, error: apiError, refresh: refreshEvents } = useCalendarEvents({ daysToShow: 60 });
  const { selectedCalendarIds, toggleCalendar, filterEvents, calendarGroups } = useCalendarFilter();

  const loading = externalLoading ?? apiLoading;
  const error = externalError ?? apiError;
  const rawEvents = externalEvents ?? apiEvents;
  const events = useMemo(() => deduplicateEvents(filterEvents(rawEvents)), [filterEvents, rawEvents]);

  // Date range for overlay buckets (meals/chores/tasks). Mirrors the page-level
  // calculation so each view's visible window has the right data loaded.
  const cardsMode = displayMode === 'cards';
  const { from: bucketsFrom, to: bucketsTo } = useMemo(() => {
    if (resolvedView === 'day') return { from: currentDate, to: currentDate };
    if (resolvedView === 'list' || resolvedView === 'week') {
      const ws = startOfWeek(currentDate, { weekStartsOn });
      return { from: ws, to: endOfWeek(currentDate, { weekStartsOn }) };
    }
    if (resolvedView === 'multiWeek') {
      const ws = startOfWeek(currentDate, { weekStartsOn });
      return { from: ws, to: addDays(addWeeks(ws, resolvedWeekCount), -1) };
    }
    if (resolvedView === 'month') {
      // MonthView renders a 6-week grid starting on the week containing the
      // 1st and ending on the week containing the last day, so leading/trailing
      // days from neighbouring months are visible. Bucket range must match,
      // otherwise overlay items on those visible-but-out-of-month days are missing.
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      return {
        from: startOfWeek(monthStart, { weekStartsOn }),
        to: endOfWeek(monthEnd, { weekStartsOn }),
      };
    }
    // agenda — 30 day window (matches AgendaView days below, so cards-mode
    // meal/chore/task overlays are loaded for every day the agenda shows)
    return { from: currentDate, to: addDays(currentDate, 29) };
  }, [resolvedView, resolvedWeekCount, currentDate, weekStartsOn]);

  const overlaysActive = cardsMode;
  const effectiveOverlays = useMemo(() => ({
    events: overlays.events,
    meals: cardsMode && overlays.meals,
    chores: cardsMode && overlays.chores,
    tasks: cardsMode && overlays.tasks,
  }), [cardsMode, overlays]);

  const { bucketsByDate, refresh: refreshBuckets } = useDayBucketsForRange({
    from: bucketsFrom,
    to: bucketsTo,
    overlays: effectiveOverlays,
    externalEvents: events,
  });

  // Hide events from the calendar surface when the events overlay is off.
  const visibleEvents = useMemo(() => (overlays.events ? events : []), [overlays.events, events]);

  // Drag-and-drop wiring: same dnd-kit setup as /week and the calendar
  // subpage so meals/chores/tasks can be reordered between days.
  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);
  const refreshAll = useCallback(async () => {
    await Promise.all([refreshEvents(), refreshBuckets()]);
  }, [refreshEvents, refreshBuckets]);
  const { moveChore, moveTask, moveMeal, moveEvent } = useWeekMutations({ refresh: refreshAll });

  const handleDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    if (id.startsWith('__static__:')) return;
    setActiveDragId(id);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveDragId(null);
    setMoveError(null);
    const { active, over } = e;
    if (!over) return;
    const dragId = String(active.id);
    const overId = String(over.id);
    const targetIso = overId.includes(':') ? overId.slice(0, overId.indexOf(':')) : overId;
    const colon = dragId.indexOf(':');
    if (colon === -1) return;
    const variant = dragId.slice(0, colon);
    const itemId = dragId.slice(colon + 1);
    const targetBucket = bucketsByDate.get(targetIso);
    if (!targetBucket) return;
    try {
      if (variant === 'chore') await moveChore(itemId, targetBucket.date);
      else if (variant === 'task') {
        let originalDue: Date | null = null;
        for (const b of bucketsByDate.values()) {
          const t = b.tasks.find((x) => x.id === itemId);
          if (t?.dueDate) { originalDue = new Date(t.dueDate); break; }
        }
        await moveTask(itemId, targetBucket.date, originalDue);
      }
      else if (variant === 'meal') await moveMeal(itemId, targetBucket.date);
      else if (variant === 'event') {
        const ev = events.find((e) => e.id === itemId);
        if (!ev) return;
        await moveEvent(itemId, ev.startTime, ev.endTime, targetBucket.date);
      }
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Failed to move item');
    }
  };

  const enableDnd = overlaysActive;

  const notesSupported = resolvedView === 'list' || resolvedView === 'day';
  const notesDays = useMemo(() => {
    if (!notesSupported) return [];
    if (resolvedView === 'day') return [currentDate];
    const ws = startOfWeek(currentDate, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [notesSupported, resolvedView, currentDate, weekStartsOn]);

  const notesFrom = notesDays.length > 0 ? format(notesDays[0]!, 'yyyy-MM-dd') : '';
  const notesTo = notesDays.length > 0 ? format(notesDays[notesDays.length - 1]!, 'yyyy-MM-dd') : '';
  const { notesByDate, upsertNote } = useCalendarNotes({
    from: notesFrom,
    to: notesTo,
    enabled: showNotes && notesSupported,
  });

  const handleEventClick = useCallback((event: CalendarEvent) => {
    onEventClick?.(event);
  }, [onEventClick]);

  const showMerge = (resolvedView === 'day' || resolvedView === 'list') && calendarGroups.length > 1;

  // Calendar filter chips
  const calendarChips = calendarGroups.length > 0 ? (
    <div className="flex items-center gap-1 flex-wrap px-3 pb-2 -mt-1">
      <button
        onClick={() => toggleCalendar('all')}
        className={cn(
          'px-2 py-1 rounded-full text-[10px] font-medium transition-colors leading-none',
          selectedCalendarIds.has('all')
            ? 'bg-primary text-primary-foreground'
            : transparentMode ? 'text-current/70 hover:text-current' : 'bg-muted text-muted-foreground hover:bg-accent'
        )}
      >
        All
      </button>
      {calendarGroups.map((group) => (
        <button
          key={group.id}
          onClick={() => toggleCalendar(group.id)}
          className={cn(
            'px-2 py-1 rounded-full text-[10px] font-medium transition-colors inline-flex items-center gap-1 leading-none',
            selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all')
              ? isLightColor(group.color) ? '!text-black' : '!text-white'
              : transparentMode ? 'text-current/60 hover:text-current' : 'bg-muted text-muted-foreground hover:bg-accent'
          )}
          style={
            selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all')
              ? { backgroundColor: group.color }
              : undefined
          }
        >
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all') ? 'rgba(255,255,255,0.55)' : group.color }} />
          {group.name}
        </button>
      ))}
    </div>
  ) : null;

  return (
    <WidgetContainer
      title="Calendar"
      titleHref={titleHref}
      icon={<Calendar className="h-4 w-4" />}
      size="large"
      loading={loading}
      error={error}
      actions={
        <CalendarWidgetControls
          viewType={viewType}
          setViewType={setViewType}
          availableViews={availableViews}
          resolvedView={resolvedView}
          widgetBordered={widgetBordered}
          setWidgetBordered={setWidgetBordered}
          mergedView={mergedView}
          setMergedView={setMergedView}
          showNotes={showNotes}
          setShowNotes={setShowNotes}
          notesSupported={notesSupported}
          transparentMode={transparentMode}
          showMerge={showMerge}
          displayMode={displayMode}
          setDisplayMode={setDisplayMode}
          hideWeekends={hideWeekends}
          setHideWeekends={setHideWeekends}
          overlays={overlays}
          setOverlays={setOverlays}
          goToPrevious={goToPrevious}
          goToToday={goToToday}
          goToNext={goToNext}
        />
      }
      className={className}
    >
      {calendarChips}
      {viewUnavailable && (
        <div className="text-[10px] text-muted-foreground text-center py-1 bg-muted/50 rounded mb-1">
          Resize widget for {VIEW_OPTIONS.find(v => v.value === viewType)?.label} view
        </div>
      )}

      {moveError && (
        <div className="text-[10px] text-destructive text-center py-1 bg-destructive/10 rounded mb-1">
          {moveError}
        </div>
      )}

      {/* flex-1 min-h-0: fills remaining space after chips / notices */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <DndContext
          sensors={dndSensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => { setActiveDragId(null); setMoveError(null); }}
        >
          <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
            {resolvedView === 'agenda' && (
              <AgendaView
                events={visibleEvents}
                days={30}
                // Agenda is a scrollable list — show every event for each day
                // rather than truncating to a "+N more" summary (0 = no cap).
                // 30-day window matches the calendar subpage; empty days are
                // skipped, so a longer horizon just shows more of your events.
                maxEventsPerDay={0}
                onEventClick={handleEventClick}
                displayMode={displayMode}
                bucketsByDate={overlaysActive ? bucketsByDate : undefined}
                enableDnd={enableDnd}
              />
            )}

            {resolvedView === 'list' && (
              <WeekVerticalView
                currentDate={currentDate}
                events={visibleEvents}
                calendarGroups={calendarGroups}
                selectedCalendarIds={selectedCalendarIds}
                mergedView={mergedView}
                bordered={widgetBordered}
                displayMode={displayMode}
                bucketsByDate={overlaysActive ? bucketsByDate : undefined}
                enableDnd={enableDnd}
                onEventClick={handleEventClick}
                showNotes={showNotes}
                notesByDate={notesByDate}
                onNoteChange={activeUser ? upsertNote : undefined}
              />
            )}

            {resolvedView === 'month' && (
              <MonthView
                currentDate={currentDate}
                events={visibleEvents}
                onEventClick={handleEventClick}
                bordered={widgetBordered}
                displayMode={displayMode}
                bucketsByDate={overlaysActive ? bucketsByDate : undefined}
                enableDnd={enableDnd}
                onDateClick={(date) => {
                  setCurrentDate(date);
                  setViewType('day');
                }}
              />
            )}

            {resolvedView === 'week' && (
              <WeekView
                currentDate={currentDate}
                events={visibleEvents}
                onEventClick={handleEventClick}
                bordered={widgetBordered}
                displayMode={displayMode}
                bucketsByDate={overlaysActive ? bucketsByDate : undefined}
                enableDnd={enableDnd}
              />
            )}

            {resolvedView === 'multiWeek' && (
              <MultiWeekView
                currentDate={currentDate}
                events={visibleEvents}
                onEventClick={handleEventClick}
                weekCount={resolvedWeekCount}
                bordered={widgetBordered}
                displayMode={displayMode}
                bucketsByDate={overlaysActive ? bucketsByDate : undefined}
                enableDnd={enableDnd}
                hideWeekends={hideWeekends}
              />
            )}

            {resolvedView === 'day' && (
              <div className="h-full flex flex-col">
                <div className="text-center text-sm font-medium text-foreground mb-2 shrink-0">
                  {formatDayHeader(currentDate)}
                </div>
                <div className="flex-1 min-h-0">
                  <DayViewSideBySide
                    currentDate={currentDate}
                    events={visibleEvents}
                    calendarGroups={calendarGroups}
                    selectedCalendarIds={selectedCalendarIds}
                    mergedView={mergedView}
                    bordered={widgetBordered}
                    displayMode={displayMode}
                    bucketsByDate={overlaysActive ? bucketsByDate : undefined}
                    enableDnd={enableDnd}
                    onEventClick={handleEventClick}
                    showNotes={showNotes}
                    notesByDate={notesByDate}
                    onNoteChange={activeUser ? upsertNote : undefined}
                  />
                </div>
              </div>
            )}
          </Suspense>
        </DndContext>
      </div>
    </WidgetContainer>
  );
});

function formatDayHeader(date: Date): string {
  const dayName = format(date, 'EEEE, MMMM d, yyyy');
  if (isToday(date)) return `Today - ${dayName}`;
  if (isTomorrow(date)) return `Tomorrow - ${dayName}`;
  return dayName;
}
