'use client';

import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, startOfDay } from 'date-fns';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Merge,
  Plus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { contrastText } from '@/lib/utils/color';
import { useFamily } from '@/components/providers';
import { Button } from '@/components/ui/button';
import { AddEventModal } from '@/components/modals';
import { PageWrapper, SubpageHeader, FilterBar } from '@/components/layout';
const MonthView = lazy(() => import('@/components/calendar/MonthView').then(m => ({ default: m.MonthView })));
const WeekView = lazy(() => import('@/components/calendar/WeekView').then(m => ({ default: m.WeekView })));
const MultiWeekView = lazy(() => import('@/components/calendar/MultiWeekView').then(m => ({ default: m.MultiWeekView })));
const ThreeMonthView = lazy(() => import('@/components/calendar/ThreeMonthView').then(m => ({ default: m.ThreeMonthView })));
const DayViewSideBySide = lazy(() => import('@/components/calendar/DayViewSideBySide').then(m => ({ default: m.DayViewSideBySide })));
const WeekVerticalView = lazy(() => import('@/components/calendar/WeekVerticalView').then(m => ({ default: m.WeekVerticalView })));
const AgendaView = lazy(() => import('@/components/calendar/AgendaView').then(m => ({ default: m.AgendaView })));
import { useCalendarViewData } from './useCalendarViewData';
import { useCalendarNotes } from '@/lib/hooks/useCalendarNotes';
import { useDayBucketsForRange } from '@/lib/hooks/useDayBucketsForRange';
import type { DayBucket } from '@/lib/hooks/useWeekViewData';
import type { CalendarEvent } from '@/types/calendar';
import { WeekItemCard } from '@/components/calendar/cells';
import { useIsMobile, useSwipeNavigation } from '@/lib/hooks';
import { useAuth } from '@/components/providers';
import { useWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import { useWeekMutations } from '@/lib/hooks/useWeekMutations';
import { ViewMenu } from './ViewMenu';
import { ViewOptionsMenu } from './ViewOptionsMenu';
import { useChores } from '@/lib/hooks/useChores';
import { useTasks } from '@/lib/hooks/useTasks';
import { useMeals } from '@/lib/hooks/useMeals';
import { useRecipes } from '@/lib/hooks/useRecipes';
import { useTaskLists } from '@/lib/hooks/useTaskLists';
import { ChoreModal } from '@/app/chores/ChoreModal';
import { TaskModal } from '@/app/tasks/TaskModal';
import { useChoreModals } from '@/app/chores/useChoreModals';
import type { OverlayItemRef } from '@/components/calendar/cells';
import type { Chore, Task, Meal } from '@/types';

const MEAL_TYPE_ORDER = { breakfast: 0, lunch: 1, snack: 2, dinner: 3 } as const;
const EMPTY_EVENTS: CalendarEvent[] = [];

/**
 * Sorts meals by mealType so the day's stack reads breakfast → lunch → snack →
 * dinner regardless of insertion order. Stable for equal mealType values.
 */
function sortMealsByType<T extends { mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' }>(
  meals: T[],
): T[] {
  return [...meals].sort((a, b) => MEAL_TYPE_ORDER[a.mealType] - MEAL_TYPE_ORDER[b.mealType]);
}

// Lazy-loaded MealModal — pulled from MealsView so the meal-edit modal can
// be opened directly from the calendar without yanking in all of MealsView.
const MealModal = lazy(() => import('@/app/meals/MealsView').then(m => ({ default: m.MealModal })));

export function CalendarView() {
  const { activeUser, requireAuth } = useAuth();
  const { members: familyMembers } = useFamily();
  const { weekStartsOn } = useWeekStartsOn();
  const {
    currentDate, setCurrentDate,
    viewType, setViewType,
    weekCount, setWeekCount,
    weeksBordered, setWeeksBordered,
    displayMode, setDisplayMode,
    hideWeekends, setHideWeekends,
    overlays, setOverlays,
    selectedEvent, setSelectedEvent,
    showAddEvent, setShowAddEvent,
    editingEvent, setEditingEvent,
    selectedCalendarIds,
    calendarGroups,
    toggleCalendar,
    mergedView, setMergedView,
    events, loading, error, refreshEvents,
    goToToday, goToPrevious, goToNext, getDateRangeTitle,
  } = useCalendarViewData();

  // Date range covered by the active view — used by useDayBucketsForRange to
  // know which days need meal/chore/task buckets prepared.
  const { rangeFrom, rangeTo } = useMemo(() => {
    switch (viewType) {
      case 'agenda':
        return { rangeFrom: new Date(), rangeTo: addDays(new Date(), 30) };
      case 'day':
        return { rangeFrom: currentDate, rangeTo: currentDate };
      case 'week':
      case 'weekVertical': {
        const ws = startOfWeek(currentDate, { weekStartsOn });
        return { rangeFrom: ws, rangeTo: addDays(ws, 6) };
      }
      case 'multiWeek': {
        const ws = startOfWeek(currentDate, { weekStartsOn });
        return { rangeFrom: ws, rangeTo: endOfWeek(addWeeks(ws, weekCount - 1), { weekStartsOn }) };
      }
      case 'month':
      case 'threeMonth': {
        const ms = startOfWeek(startOfMonth(currentDate), { weekStartsOn });
        const me = endOfWeek(endOfMonth(currentDate), { weekStartsOn });
        return { rangeFrom: ms, rangeTo: me };
      }
    }
  }, [viewType, currentDate, weekCount, weekStartsOn]);

  // Build per-day buckets in cards mode regardless of which overlay checkboxes
  // are on — the bucket also carries weather, which should always render.
  // Per-overlay flags below decide whether each stream actually populates.
  const cardsMode = displayMode === 'cards';
  const overlaysActive = cardsMode;

  const { bucketsByDate, refresh: refreshBuckets } = useDayBucketsForRange({
    from: rangeFrom,
    to: rangeTo,
    overlays: {
      events: false, // events come from CalendarView's filtered list, not the bucket
      meals: cardsMode && overlays.meals,
      chores: cardsMode && overlays.chores,
      tasks: cardsMode && overlays.tasks,
    },
    externalEvents: events,
  });

  // Meals are tied to the Family calendar pill: when Family is filtered out,
  // hide the day's meals from every view. If no Family group exists (single-
  // user setups), default to showing meals.
  const familyGroup = useMemo(
    () => calendarGroups.find((g) => g.name === 'Family'),
    [calendarGroups],
  );
  const showAll = selectedCalendarIds.has('all');
  const familyVisible = useMemo(() => {
    if (!familyGroup) return true;
    return showAll || selectedCalendarIds.has(familyGroup.id);
  }, [familyGroup, selectedCalendarIds, showAll]);
  const mealColor = familyGroup?.color ?? '#F59E0B';

  // Set of family-member user IDs whose calendar pill is currently selected.
  // Used to filter chores/tasks by their `assignedTo` so the profile pills
  // toggle assigned chores/tasks alongside that user's events.
  const selectedUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const g of calendarGroups) {
      if (!g.userId) continue;
      if (showAll || selectedCalendarIds.has(g.id)) ids.add(g.userId);
    }
    return ids;
  }, [calendarGroups, selectedCalendarIds, showAll]);

  // Honour the Events overlay checkbox: when off, suppress all event cards.
  // Day buckets keep weather + meals/chores/tasks, so other overlays still work.
  const visibleEvents = overlays.events ? events : EMPTY_EVENTS;

  // Sorted, pill-filtered buckets. Meals follow the Family pill; chores/tasks
  // follow the assigned user's pill (unassigned items show whenever Family is
  // visible so they aren't lost when only user pills are selected).
  const filteredBucketsByDate = useMemo(() => {
    const next = new Map<string, typeof bucketsByDate extends Map<string, infer V> ? V : never>();
    for (const [key, bucket] of bucketsByDate.entries()) {
      const meals = familyVisible ? sortMealsByType(bucket.meals) : [];
      const chores = bucket.chores.filter((c) => {
        if (showAll) return true;
        if (!c.assignedTo) return familyVisible;
        return selectedUserIds.has(c.assignedTo.id);
      });
      const tasks = bucket.tasks.filter((t) => {
        if (showAll) return true;
        if (!t.assignedTo) return familyVisible;
        return selectedUserIds.has(t.assignedTo.id);
      });
      next.set(key, { ...bucket, meals, chores, tasks });
    }
    return next;
  }, [bucketsByDate, familyVisible, selectedUserIds, showAll]);

  const refreshAll = useMemo(() => async () => {
    await Promise.all([refreshEvents(), refreshBuckets()]);
  }, [refreshEvents, refreshBuckets]);

  const { moveChore, moveTask, moveMeal, moveEvent } = useWeekMutations({ refresh: refreshAll });

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const [moveError, setMoveError] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // In-page edit modals for overlay items (meals/chores/tasks) so a click on
  // a calendar card opens the same modal that lives on the feature page.
  const [editingChore, setEditingChore] = useState<Chore | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  // Live data for the modals. The bucket carries lightweight summaries; the
  // modals need full records (e.g. meal recipe URL, chore startDay), which
  // these hooks load on demand.
  const { chores: allChoresList, refresh: refreshAllChores } = useChores({
    showDisabled: true,
    includeFuture: true,
    enabled: overlaysActive && (overlays.chores || overlays.tasks),
  });
  const { tasks: allTasksList, refresh: refreshAllTasks } = useTasks({
    showCompleted: true,
    enabled: overlaysActive && overlays.tasks,
  });
  const { meals: allMealsList, refresh: refreshAllMeals } = useMeals({
    enabled: overlaysActive && overlays.meals,
  });
  const { recipes } = useRecipes();
  const { lists: taskLists } = useTaskLists();

  const { saveEditedChore } = useChoreModals({
    refreshChores: refreshAllChores,
    setShowAddModal: () => {},
    setEditingChore,
    deleteChore: () => {},
  });

  const handleOverlayItemClick = useMemo(
    () => (ref: { kind: 'meal' | 'chore' | 'task'; id: string }) => {
      if (ref.kind === 'chore') {
        const c = allChoresList.find((x) => x.id === ref.id);
        if (c) setEditingChore(c);
      } else if (ref.kind === 'task') {
        const t = allTasksList.find((x) => x.id === ref.id);
        if (t) setEditingTask(t);
      } else {
        const m = allMealsList.find((x) => x.id === ref.id);
        if (m) setEditingMeal(m);
      }
    },
    [allChoresList, allTasksList, allMealsList],
  );

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
    // Drop targets may carry a region suffix (e.g. `2026-04-30:body`) when
    // multiple drop zones share a date. Strip it before bucket lookup.
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
        const t = allTasksList.find((x) => x.id === itemId);
        await moveTask(itemId, targetBucket.date, t?.dueDate ? new Date(t.dueDate) : null);
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

  const isMobile = useIsMobile();

  // Notes support for day and list views
  const [showNotes, setShowNotes] = useState(false);
  const notesSupported = viewType === 'day' || viewType === 'weekVertical';
  const notesDays = useMemo(() => {
    if (!notesSupported || !showNotes) return [];
    if (viewType === 'day') return [currentDate];
    const ws = startOfWeek(currentDate, { weekStartsOn });
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [notesSupported, showNotes, viewType, currentDate, weekStartsOn]);

  const notesFrom = notesDays.length > 0 ? format(notesDays[0]!, 'yyyy-MM-dd') : '';
  const notesTo = notesDays.length > 0 ? format(notesDays[notesDays.length - 1]!, 'yyyy-MM-dd') : '';
  const { notesByDate, upsertNote } = useCalendarNotes({
    from: notesFrom,
    to: notesTo,
    enabled: showNotes && notesSupported,
  });

  // Swipe navigation for touch devices
  const swipeRef = useSwipeNavigation<HTMLDivElement>({
    onSwipeLeft: goToNext,
    onSwipeRight: goToPrevious,
    threshold: 50,
  });

  const handleAddWithAuth = async () => {
    const user = await requireAuth('Add Event', 'Please log in to add an event');
    if (!user) return;
    setShowAddEvent(true);
  };

  // Mobile is agenda-only.
  useEffect(() => {
    if (isMobile && viewType !== 'agenda') {
      setViewType('agenda');
    }
  }, [isMobile, viewType, setViewType]);

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <SubpageHeader
          icon={!isMobile ? <Calendar className="h-5 w-5 text-primary" /> : undefined}
          title={getDateRangeTitle()}
          actions={<>
            {isMobile ? null : (
              <>
                <Button variant="outline" size="sm" onClick={goToToday} className="h-9">Today</Button>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={goToPrevious} aria-label="Previous" className="h-9 w-9">
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={goToNext} aria-label="Next" className="h-9 w-9">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </>
            )}
            {/* View switcher dropdown — mobile is agenda-only and hides this. */}
            <div className="hidden md:flex">
              <ViewMenu
                viewType={viewType}
                weekCount={weekCount}
                onViewChange={setViewType}
                onWeekCountChange={setWeekCount}
              />
            </div>
            {/* Single gear popover replacing Notes/Grid/Cards/Hide-weekends/
                Overlays toggle buttons. */}
            <div className="hidden md:flex items-center gap-1">
              <ViewOptionsMenu
                displayMode={displayMode}
                onDisplayModeChange={setDisplayMode}
                weeksBordered={weeksBordered}
                onWeeksBorderedChange={setWeeksBordered}
                hideWeekends={hideWeekends}
                onHideWeekendsChange={setHideWeekends}
                showNotes={showNotes}
                onShowNotesChange={setShowNotes}
                // hideWeekends is currently only honored by MultiWeekView.
                // Only show the toggle when it has effect; expand here if/when
                // WeekView, WeekVerticalView, MonthView learn to respect it.
                weekendsApplicable={viewType === 'multiWeek'}
                notesApplicable={notesSupported}
                displayApplicable={viewType !== 'threeMonth'}
                overlays={overlays}
                onOverlaysChange={setOverlays}
                showOverlayRows={cardsMode}
                onReset={() => {
                  setDisplayMode('inline');
                  setWeeksBordered(false);
                  setHideWeekends(false);
                  setShowNotes(false);
                  setMergedView(false);
                  setOverlays({ events: true, meals: true, chores: true, tasks: true });
                }}
              />
            </div>
            {!isMobile && (
              <Button size="sm" onClick={handleAddWithAuth}>
                <Plus className="h-4 w-4 mr-1" />Add Event
              </Button>
            )}
          </>}
        />

        {!isMobile && calendarGroups.length > 0 && (
          <FilterBar>
            <span className="text-sm text-muted-foreground shrink-0">Show:</span>
            <Button
              variant={selectedCalendarIds.has('all') ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleCalendar('all')}
              className="h-7 text-xs"
            >
              All
            </Button>
            {calendarGroups.map((group) => {
              const isSelected = selectedCalendarIds.has(group.id) || selectedCalendarIds.has('all');
              return (
                <Button
                  key={group.id}
                  variant={isSelected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleCalendar(group.id)}
                  className={cn('h-7 text-xs gap-1.5', isSelected && 'border-transparent')}
                  style={isSelected ? { backgroundColor: group.color, color: contrastText(group.color) } : undefined}
                >
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.55)' : group.color }} />
                  {group.name}
                </Button>
              );
            })}
            {(viewType === 'weekVertical' || viewType === 'day') && calendarGroups.length > 1 && (
              <Button
                variant={mergedView ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setMergedView(!mergedView)}
                className="gap-1 ml-auto"
                title={mergedView ? 'Split by calendar' : 'Merge into one column'}
              >
                <Merge className="h-3.5 w-3.5" />
                {mergedView ? 'Split' : 'Merge'}
              </Button>
            )}
          </FilterBar>
        )}

        <div ref={swipeRef} className="flex-1 overflow-hidden p-4 min-h-0">
          {loading && (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && (
            <div className="h-full flex items-center justify-center">
              <p className="text-destructive">Failed to load calendar: {error}</p>
            </div>
          )}
          {!loading && !error && (
            <div className="h-full">
            {moveError && (
              <div className="mb-2 rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {moveError}
              </div>
            )}
            <Suspense fallback={<div className="h-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <DndContext
              sensors={dndSensors}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={() => setActiveDragId(null)}
            >
              {viewType === 'agenda' && (
                <AgendaView
                  events={visibleEvents}
                  days={30}
                  onEventClick={setSelectedEvent}
                  displayMode={displayMode}
                  bucketsByDate={overlaysActive ? filteredBucketsByDate : undefined}
                  enableDnd={overlaysActive}
                  mealColor={mealColor}
                  onItemClick={handleOverlayItemClick}
                />
              )}
              {viewType === 'month' && (
                <MonthView currentDate={currentDate} events={visibleEvents} onEventClick={setSelectedEvent}
                  onDateClick={(date) => { setCurrentDate(date); setViewType('day'); }} bordered={weeksBordered} displayMode={displayMode}
                  bucketsByDate={overlaysActive ? filteredBucketsByDate : undefined}
                  enableDnd={overlaysActive}
                  onItemClick={handleOverlayItemClick}
                />
              )}
              {viewType === 'week' && (
                <WeekView currentDate={currentDate} events={visibleEvents} onEventClick={setSelectedEvent} bordered={weeksBordered} displayMode={displayMode}
                  bucketsByDate={overlaysActive ? filteredBucketsByDate : undefined}
                  enableDnd={overlaysActive}
                  mealColor={mealColor}
                  onItemClick={handleOverlayItemClick}
                />
              )}
              {viewType === 'weekVertical' && (
                <WeekVerticalView
                  currentDate={currentDate}
                  events={visibleEvents}
                  calendarGroups={calendarGroups}
                  selectedCalendarIds={selectedCalendarIds}
                  mergedView={mergedView}
                  bordered={weeksBordered}
                  onEventClick={setSelectedEvent}
                  showNotes={showNotes}
                  notesByDate={notesByDate}
                  onNoteChange={activeUser ? upsertNote : undefined}
                  displayMode={displayMode}
                  bucketsByDate={overlaysActive ? filteredBucketsByDate : undefined}
                  enableDnd={overlaysActive}
                  mealColor={mealColor}
                  onItemClick={handleOverlayItemClick}
                />
              )}
              {viewType === 'multiWeek' && (
                /* All weekCounts (1/2/3/4) use MultiWeekView so the grid
                   compresses to fit the page and overflows into popovers
                   instead of growing taller than the viewport. */
                <MultiWeekView currentDate={currentDate} events={visibleEvents} onEventClick={setSelectedEvent} weekCount={weekCount} bordered={weeksBordered} displayMode={displayMode}
                  bucketsByDate={overlaysActive ? filteredBucketsByDate : undefined}
                  enableDnd={overlaysActive}
                  hideWeekends={hideWeekends}
                  mealColor={mealColor}
                  onItemClick={handleOverlayItemClick}
                />
              )}
              {viewType === 'threeMonth' && (
                <ThreeMonthView currentDate={currentDate} events={visibleEvents} onEventClick={setSelectedEvent}
                  onDateClick={(date) => { setCurrentDate(date); setViewType('month'); }} bordered={weeksBordered} />
              )}
              {viewType === 'day' && (
                <DayViewSideBySide
                  currentDate={currentDate}
                  events={visibleEvents}
                  calendarGroups={calendarGroups}
                  selectedCalendarIds={selectedCalendarIds}
                  mergedView={mergedView}
                  bordered={weeksBordered}
                  onEventClick={setSelectedEvent}
                  showNotes={showNotes}
                  notesByDate={notesByDate}
                  onNoteChange={activeUser ? upsertNote : undefined}
                  displayMode={displayMode}
                  bucketsByDate={overlaysActive ? filteredBucketsByDate : undefined}
                  enableDnd={overlaysActive}
                  mealColor={mealColor}
                  onItemClick={handleOverlayItemClick}
                />
              )}
              <DragOverlay dropAnimation={null}>
                {activeDragId ? (
                  <CalendarDragPreview dragId={activeDragId} bucketsByDate={filteredBucketsByDate} events={visibleEvents} mealColor={mealColor} />
                ) : null}
              </DragOverlay>
            </DndContext>
            </Suspense>
            </div>
          )}
        </div>

        {selectedEvent && (
          <EventDetailModal
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
            onEdit={() => { setEditingEvent(selectedEvent); setSelectedEvent(null); }}
            onDeleted={() => { setSelectedEvent(null); refreshEvents(); }}
          />
        )}

        <AddEventModal
          open={showAddEvent || editingEvent !== null}
          onOpenChange={(open) => { if (!open) { setShowAddEvent(false); setEditingEvent(null); } }}
          event={editingEvent ? {
            id: editingEvent.id,
            title: editingEvent.title,
            description: editingEvent.description,
            location: editingEvent.location,
            startTime: editingEvent.startTime,
            endTime: editingEvent.endTime,
            allDay: editingEvent.allDay,
            color: editingEvent.color,
            recurring: false,
            recurrenceRule: undefined,
            reminderMinutes: undefined,
            calendarSourceId: editingEvent.calendarId !== 'local' ? editingEvent.calendarId : undefined,
          } : undefined}
          onEventCreated={() => { refreshEvents(); setShowAddEvent(false); setEditingEvent(null); }}
        />

        {editingChore && (
          <ChoreModal
            chore={editingChore}
            familyMembers={familyMembers}
            onClose={() => setEditingChore(null)}
            onSave={async (updated) => {
              await saveEditedChore(editingChore.id, updated);
              await refreshBuckets();
            }}
          />
        )}

        {editingTask && (
          <TaskModal
            task={editingTask}
            familyMembers={familyMembers}
            taskLists={taskLists}
            onClose={() => setEditingTask(null)}
            onSave={async (updated) => {
              try {
                const res = await fetch(`/api/tasks/${editingTask.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: updated.title,
                    priority: updated.priority,
                    category: updated.category,
                    assignedTo: updated.assignedTo?.id,
                    dueDate: updated.dueDate === null ? null : updated.dueDate.toISOString(),
                    completed: updated.completed,
                    listId: updated.listId,
                  }),
                });
                if (!res.ok) throw new Error('Failed to update task');
                await refreshAllTasks();
                await refreshBuckets();
              } catch (err) {
                toast({ title: err instanceof Error ? err.message : 'Failed to update task', variant: 'destructive' });
              } finally {
                setEditingTask(null);
              }
            }}
          />
        )}

        {editingMeal && (
          <Suspense fallback={null}>
            <MealModal
              meal={editingMeal}
              weekOf={editingMeal.weekOf}
              dayOptions={['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const}
              recipes={recipes}
              onClose={() => setEditingMeal(null)}
              onSave={async (updates) => {
                try {
                  const res = await fetch(`/api/meals/${editingMeal.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates),
                  });
                  if (!res.ok) throw new Error('Failed to update meal');
                  await refreshAllMeals();
                  await refreshBuckets();
                } catch (err) {
                  toast({ title: err instanceof Error ? err.message : 'Failed to update meal', variant: 'destructive' });
                } finally {
                  setEditingMeal(null);
                }
              }}
            />
          </Suspense>
        )}
      </div>
    </PageWrapper>
  );
}


function EventDetailModal({ event, onClose, onEdit, onDeleted }: {
  event: { id: string; title: string; startTime: Date; endTime: Date; allDay: boolean; color: string; location?: string; calendarName: string };
  onClose: () => void;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const { confirm, dialogProps } = useConfirmDialog();

  const handleDelete = async () => {
    const ok = await confirm('Delete this event?', 'Are you sure you want to delete this event?');
    if (!ok) return;
    try {
      const response = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        toast({ title: err.error || 'Failed to delete event', variant: 'destructive' });
        return;
      }
      onDeleted();
    } catch { toast({ title: 'Failed to delete event', variant: 'destructive' }); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="w-full h-2 rounded-t-lg -mt-6 -mx-6 mb-4" style={{ backgroundColor: event.color }} />
        <h2 className="text-xl font-bold mb-2">{event.title}</h2>
        <p className="text-sm text-muted-foreground mb-1">
          {event.allDay
            ? format(event.startTime, 'EEEE, MMMM d')
            : `${format(event.startTime, 'EEEE, MMMM d')} at ${format(event.startTime, 'h:mm a')}`}
        </p>
        {event.location && <p className="text-sm text-muted-foreground mb-4">{event.location}</p>}
        <p className="text-xs text-muted-foreground">{event.calendarName}</p>
        <div className="flex justify-between mt-6">
          <Button variant="destructive" onClick={handleDelete}>
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={onEdit}>Edit</Button>
          </div>
        </div>
      </div>
      <ConfirmDialog {...dialogProps} />
    </div>
  );
}

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
} as const;

const CHORE_PENDING_APPROVAL_COLOR = '#a855f7';
const CHORE_OVERDUE_COLOR = '#ef4444';
const CHORE_PENDING_COLOR = '#f59e0b';
const MEAL_FALLBACK_COLOR = '#10b981';

/**
 * Renders the dragged item as a portaled DragOverlay so it isn't clipped by
 * `overflow-hidden` ancestors on the calendar views (every cards-mode view
 * uses an outer scroll container that would otherwise hide the drag preview).
 */
function CalendarDragPreview({
  dragId,
  bucketsByDate,
  events,
  mealColor,
}: {
  dragId: string;
  bucketsByDate: Map<string, DayBucket>;
  events: CalendarEvent[];
  mealColor: string;
}) {
  const colon = dragId.indexOf(':');
  if (colon === -1) return null;
  const variant = dragId.slice(0, colon) as 'meal' | 'chore' | 'task' | 'event';
  const itemId = dragId.slice(colon + 1);

  if (variant === 'event') {
    const ev = events.find((e) => e.id === itemId);
    if (!ev) return null;
    return (
      <div className="w-56 opacity-90">
        <WeekItemCard
          variant="event"
          size="sm"
          layout="column"
          stripeColor={ev.color}
          title={ev.title}
          timeLabel={ev.allDay ? 'All day' : new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(ev.startTime)}
          subtitle={ev.location || ev.calendarName}
        />
      </div>
    );
  }

  for (const bucket of bucketsByDate.values()) {
    if (variant === 'meal') {
      const meal = bucket.meals.find((m) => String(m.id) === itemId);
      if (meal) {
        const stripeColor = mealColor;
        return (
          <div className="w-56 opacity-90">
            <WeekItemCard
              variant="meal"
              size="sm"
              layout="row"
              stripeColor={stripeColor}
              title={meal.name}
              timeLabel={meal.mealType}
              muted={Boolean(meal.cookedAt)}
            />
          </div>
        );
      }
    } else if (variant === 'chore') {
      const chore = bucket.chores.find((c) => String(c.id) === itemId);
      if (chore) {
        // Parse nextDue (YYYY-MM-DD DATE column) as a local date and compare
        // to startOfDay(today). new Date('YYYY-MM-DD') is parsed as UTC and
        // would mark today's chore as overdue in negative-UTC zones — same
        // bug fixed in DayColumn.choreStripeColor and useDayBucketsForRange.
        let isOverdue = false;
        if (chore.nextDue) {
          const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(chore.nextDue);
          if (m) {
            const due = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            isOverdue = due < startOfDay(new Date());
          }
        }
        const stripeColor = chore.pendingApproval
          ? CHORE_PENDING_APPROVAL_COLOR
          : isOverdue
            ? CHORE_OVERDUE_COLOR
            : CHORE_PENDING_COLOR;
        return (
          <div className="w-56 opacity-90">
            <WeekItemCard
              variant="chore"
              size="sm"
              layout="row"
              stripeColor={stripeColor}
              title={chore.title}
              subtitle={chore.assignedTo?.name}
              muted={Boolean(chore.pendingApproval)}
            />
          </div>
        );
      }
    } else if (variant === 'task') {
      const task = bucket.tasks.find((t) => String(t.id) === itemId);
      if (task) {
        return (
          <div className="w-56 opacity-90">
            <WeekItemCard
              variant="task"
              size="sm"
              layout="row"
              stripeColor={PRIORITY_COLORS[task.priority]}
              title={task.title}
              subtitle={task.assignedTo?.name}
              muted={task.completed}
            />
          </div>
        );
      }
    }
  }
  return null;
}
