'use client';

import React, { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { usePullToRefresh } from '@/lib/hooks/usePullToRefresh';
import { useMobileLayout } from '@/lib/hooks/useMobileLayout';
import { RefreshCw } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { cn } from '@/lib/utils';
import type { useDashboardData } from './useDashboardData';
import { useMobileCardOrder, loadHiddenCards } from './useMobileCardOrder';
import { useBusTracking } from '@/lib/hooks/useBusTracking';
import {
  WeatherCard, ClockCard, CalendarCard, ChoresCard, TasksCard,
  ShoppingCard, MealsCard, MessagesCard, BirthdaysCard, PointsCard,
  WishesCard, PhotosCard, RecipesCard, BusTrackingCard, MobileLayoutProvider,
} from './MobileCards';
import {
  WeatherTile, ClockTile, CalendarTile, ChoresTile, TasksTile,
  ShoppingTile, MealsTile, MessagesTile, BirthdaysTile, PointsTile,
  WishesTile, PhotosTile, RecipesTile, BusTrackingTile,
} from './TileCards';

function SortableCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative transition-shadow',
        isDragging && 'scale-[1.03] shadow-xl z-10 opacity-90 rounded-xl'
      )}
    >
      {/* Drag handle — wide touch target at top of card */}
      <div
        {...attributes}
        {...listeners}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute top-0 left-1/2 -translate-x-1/2 z-10 w-2/3 py-3 flex justify-center cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
      >
        <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
      </div>
      {children}
    </div>
  );
}

export interface MobileDashboardProps {
  data: ReturnType<typeof useDashboardData>;
}

export const MobileDashboard = memo(function MobileDashboard({ data }: MobileDashboardProps) {
  const { order, setOrder } = useMobileCardOrder();
  const { routes: busRoutes } = useBusTracking();
  const [hiddenCards] = useState(loadHiddenCards);
  const [reorderMode, setReorderMode] = useState(false);

  const { pullDistance, refreshing } = usePullToRefresh();
  const { layout } = useMobileLayout();

  // Listen for reorder mode toggle from FAB
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setReorderMode(detail?.active ?? false);
    };
    window.addEventListener('prism:mobile-reorder', handler);
    return () => window.removeEventListener('prism:mobile-reorder', handler);
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 500, tolerance: 5 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = order.indexOf(active.id as string);
      const newIndex = order.indexOf(over.id as string);
      setOrder(arrayMove(order, oldIndex, newIndex));
    }
  }, [order, setOrder]);

  const tileMap: Record<string, React.ReactNode> = useMemo(() => ({
    weather: <WeatherTile data={data.weather} />,
    clock: <ClockTile />,
    calendar: <CalendarTile data={data.calendar} />,
    chores: <ChoresTile data={data.chores} />,
    tasks: <TasksTile data={data.tasks} />,
    shopping: <ShoppingTile data={data.shopping} />,
    meals: <MealsTile data={data.meals} />,
    messages: <MessagesTile data={data.messages} />,
    birthdays: <BirthdaysTile data={data.birthdays} />,
    points: <PointsTile data={data.points} />,
    wishes: <WishesTile />,
    photos: <PhotosTile />,
    recipes: <RecipesTile />,
    busTracking: <BusTrackingTile routes={busRoutes} />,
  }), [data, busRoutes]);

  const cardMap: Record<string, React.ReactNode> = useMemo(() => ({
    weather: <WeatherCard data={data.weather} />,
    clock: <ClockCard />,
    calendar: <CalendarCard data={data.calendar} />,
    chores: <ChoresCard data={data.chores} />,
    tasks: <TasksCard data={data.tasks} />,
    shopping: <ShoppingCard data={data.shopping} />,
    meals: <MealsCard data={data.meals} />,
    messages: <MessagesCard data={data.messages} />,
    birthdays: <BirthdaysCard data={data.birthdays} />,
    points: <PointsCard data={data.points} />,
    wishes: <WishesCard />,
    photos: <PhotosCard />,
    recipes: <RecipesCard />,
    busTracking: <BusTrackingCard routes={busRoutes} />,
  }), [data, busRoutes]);

  const cardHasContent: Record<string, boolean> = useMemo(() => ({
    weather: !data.weather.loading && !!data.weather.data,
    clock: true,
    calendar: true,
    chores: true,
    tasks: true,
    shopping: true,
    meals: true,
    messages: true,
    birthdays: (data.birthdays.birthdays?.length ?? 0) > 0,
    points: !data.points.loading && (data.points.goals?.length ?? 0) > 0,
    wishes: true,
    photos: true,
    recipes: true,
    busTracking: (busRoutes?.length ?? 0) > 0,
  }), [data, busRoutes]);

  const visibleOrder = useMemo(
    () => order.filter((id) => !hiddenCards.includes(id) && cardHasContent[id] !== false),
    [order, hiddenCards, cardHasContent],
  );

  if (reorderMode) {
    return (
      <div className="p-4 pb-24 space-y-3 max-w-lg mx-auto">
        <div className="text-center text-sm text-muted-foreground py-2">
          Drag cards to reorder
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis]}
        >
          <SortableContext items={visibleOrder} strategy={verticalListSortingStrategy}>
            {visibleOrder.map((id) => (
              <SortableCard key={id} id={id}>
                {cardMap[id]}
              </SortableCard>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    );
  }

  const pullProgress = Math.min(pullDistance / 72, 1);
  const showIndicator = pullDistance > 8 || refreshing;

  const isTiles = layout === 'tiles';
  const tileRows = Math.ceil(visibleOrder.length / 2);

  return (
    <MobileLayoutProvider value={layout}>
      {/* Pull-to-refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{ height: showIndicator ? (refreshing ? 48 : pullDistance * 0.5) : 0, opacity: pullProgress, transition: pullDistance > 0 ? 'none' : 'height 0.2s, opacity 0.2s' }}
      >
        <RefreshCw
          className={cn('h-5 w-5 text-muted-foreground', refreshing && 'animate-spin')}
          style={{ transform: refreshing ? undefined : `rotate(${pullProgress * 180}deg)` }}
        />
      </div>

      {isTiles ? (
        /* Tiles: auto-size rows to fill viewport with no scroll */
        <div
          className="px-4 overflow-hidden"
          style={{
            height: `calc(100dvh - 112px - ${showIndicator ? (refreshing ? 48 : pullDistance * 0.5) : 0}px)`,
            transform: pullDistance > 0 ? `translateY(${pullDistance * 0.4}px)` : undefined,
            transition: pullDistance > 0 ? 'none' : undefined,
          }}
        >
          <div
            className="grid grid-cols-2 gap-2 h-full"
            style={{ gridTemplateRows: `repeat(${tileRows}, 1fr)` }}
          >
            {visibleOrder.map((id) => (
              <div key={id} className="min-h-0">{tileMap[id]}</div>
            ))}
          </div>
        </div>
      ) : (
        /* Rows: scrollable list */
        <div
          className="p-4 pb-24 space-y-3 max-w-lg mx-auto"
          style={pullDistance > 0 ? { transform: `translateY(${pullDistance * 0.4}px)`, transition: 'none' } : undefined}
        >
          {visibleOrder.map((id) => (
            <div key={id}>{cardMap[id]}</div>
          ))}
        </div>
      )}
    </MobileLayoutProvider>
  );
});
