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
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { BirthdaysWidget } from '@/components/widgets/BirthdaysWidget';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useRemoveBirthday } from './useRemoveBirthday';
import type { useDashboardData } from './useDashboardData';
import { useMobileCardOrder, useHiddenCards } from './useMobileCardOrder';
import { PhoneCardsSheet } from './PhoneCardsSheet';
import { PHONE_CARDS_EVENT, PHONE_REORDER_EVENT } from '@/lib/constants/dock';
import { useBusTracking } from '@/lib/hooks/useBusTracking';
import { pickShownTrack, useBusLive } from '@/lib/hooks/useBusLive';
import { useNow } from '@/lib/hooks/useNow';
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
  const { routes: busRoutes, allRoutes: allBusRoutes } = useBusTracking();
  const busLive = useBusLive(allBusRoutes.length > 0);
  const now = useNow();
  // As on the bus widget: with a live provider, today's trip on an open route
  // stands in for the email view, before it starts and once it is done.
  const liveBus = pickShownTrack(busLive.tracks, busRoutes.map((r) => r.id), busLive.provider, now.getTime() + busLive.clockOffsetMs);
  const [hiddenCards, setHiddenCards] = useHiddenCards();
  const [reorderMode, setReorderMode] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const toggleCard = useCallback((id: string) => {
    setHiddenCards((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }, [setHiddenCards]);
  // Birthdays has no page of its own, so its card opens the full widget here.
  const [birthdaysOpen, setBirthdaysOpen] = useState(false);
  const openBirthdays = useCallback(() => setBirthdaysOpen(true), []);
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();
  const removeBirthday = useRemoveBirthday(confirm);

  const { pullDistance, refreshing } = usePullToRefresh();
  const { layout, setLayout } = useMobileLayout();

  // More > This phone > Cards and Reorder (#1354), sent once More has closed.
  useEffect(() => {
    const reorder = (e: Event) => setReorderMode((e as CustomEvent).detail?.active ?? false);
    const cards = () => setCardsOpen(true);
    window.addEventListener(PHONE_REORDER_EVENT, reorder);
    window.addEventListener(PHONE_CARDS_EVENT, cards);
    return () => {
      window.removeEventListener(PHONE_REORDER_EVENT, reorder);
      window.removeEventListener(PHONE_CARDS_EVENT, cards);
    };
  }, []);

  // The same hidden list and layout the dashboard draws from, so a tap shows
  // at once and Done only closes the sheet.
  const cardsSheet = (
    <PhoneCardsSheet open={cardsOpen} onOpenChange={setCardsOpen} hidden={hiddenCards} onToggle={toggleCard} layout={layout} onLayout={setLayout} />
  );

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
    birthdays: <BirthdaysTile data={data.birthdays} onOpen={openBirthdays} />,
    points: <PointsTile data={data.points} />,
    wishes: <WishesTile />,
    photos: <PhotosTile />,
    recipes: <RecipesTile />,
    busTracking: <BusTrackingTile routes={busRoutes} live={liveBus} provider={busLive.provider} />,
  }), [data, busRoutes, liveBus, busLive.provider, openBirthdays]);

  const cardMap: Record<string, React.ReactNode> = useMemo(() => ({
    weather: <WeatherCard data={data.weather} />,
    clock: <ClockCard />,
    calendar: <CalendarCard data={data.calendar} />,
    chores: <ChoresCard data={data.chores} />,
    tasks: <TasksCard data={data.tasks} />,
    shopping: <ShoppingCard data={data.shopping} />,
    meals: <MealsCard data={data.meals} />,
    messages: <MessagesCard data={data.messages} />,
    birthdays: <BirthdaysCard data={data.birthdays} onOpen={openBirthdays} />,
    points: <PointsCard data={data.points} />,
    wishes: <WishesCard />,
    photos: <PhotosCard />,
    recipes: <RecipesCard />,
    busTracking: <BusTrackingCard routes={busRoutes} live={liveBus} provider={busLive.provider} />,
  }), [data, busRoutes, liveBus, busLive.provider, openBirthdays]);

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
    busTracking: (busRoutes?.length ?? 0) > 0 || liveBus !== null,
  }), [data, busRoutes, liveBus, busLive.provider]);

  const visibleOrder = useMemo(
    () => order.filter((id) => !hiddenCards.includes(id) && cardHasContent[id] !== false),
    [order, hiddenCards, cardHasContent],
  );

  if (reorderMode) {
    return (
      <div className="p-4 pb-24 space-y-3 max-w-lg mx-auto" data-mobile-reorder>
        {/* Done sits above the dock while reordering (#1354). */}
        <div
          className="fixed inset-x-2 z-40 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-2 shadow-lg"
          style={{ bottom: 'calc(var(--nav-bottom, 0px) + 0.5rem)' }}
          data-reorder-done-bar
        >
          <span className="text-sm text-muted-foreground">Drag cards to reorder</span>
          <button
            type="button"
            onClick={() => setReorderMode(false)}
            className="min-h-[44px] rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
            data-reorder-done
          >
            Done
          </button>
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
        {cardsSheet}
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
          data-mobile-cards
          style={{
            height: `calc(100dvh - 112px - ${showIndicator ? (refreshing ? 48 : pullDistance * 0.5) : 0}px)`,
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
          data-mobile-cards
        >
          {visibleOrder.map((id) => (
            <div key={id}>{cardMap[id]}</div>
          ))}
        </div>
      )}

      <Dialog open={birthdaysOpen} onOpenChange={setBirthdaysOpen}>
        {/* A column, so the widget fills the sheet: it shows as many rows as
            fit its own height, and in a short auto-sized slot that was one. */}
        <DialogContent className="h-[80dvh] flex flex-col p-4 pt-10">
          <DialogTitle className="sr-only">Birthdays</DialogTitle>
          <div className="flex-1 min-h-0">
            <BirthdaysWidget
              birthdays={data.birthdays.birthdays ?? []}
              loading={data.birthdays.loading}
              error={data.birthdays.error}
              maxItems={50}
              onRemove={removeBirthday}
            />
          </div>
        </DialogContent>
      </Dialog>
      {cardsSheet}
      <ConfirmDialog {...confirmDialogProps} />
    </MobileLayoutProvider>
  );
});
