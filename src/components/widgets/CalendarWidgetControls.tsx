'use client';

import * as React from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { VIEW_OPTIONS, WidgetViewType, ResolvedViewType } from '@/lib/hooks/useCalendarWidgetPrefs';
import { ViewOptionsMenu } from '@/app/calendar/ViewOptionsMenu';
import type { OverlayFlags } from '@/lib/hooks/useDayBucketsForRange';

interface CalendarWidgetControlsProps {
  viewType: WidgetViewType;
  setViewType: (v: WidgetViewType) => void;
  availableViews: WidgetViewType[];
  resolvedView: ResolvedViewType;
  widgetBordered: boolean;
  setWidgetBordered: (v: boolean) => void;
  mergedView: boolean;
  setMergedView: (v: boolean) => void;
  showNotes: boolean;
  setShowNotes: (v: boolean) => void;
  notesSupported: boolean;
  transparentMode: boolean;
  showMerge: boolean;
  displayMode: 'inline' | 'cards';
  setDisplayMode: (m: 'inline' | 'cards') => void;
  hideWeekends: boolean;
  setHideWeekends: (v: boolean) => void;
  overlays: OverlayFlags;
  setOverlays: (next: OverlayFlags) => void;
  goToPrevious: () => void;
  goToToday: () => void;
  goToNext: () => void;
}

export function CalendarWidgetControls({
  viewType,
  setViewType,
  availableViews,
  resolvedView,
  widgetBordered,
  setWidgetBordered,
  mergedView,
  setMergedView,
  showNotes,
  setShowNotes,
  notesSupported,
  transparentMode,
  showMerge,
  displayMode,
  setDisplayMode,
  hideWeekends,
  setHideWeekends,
  overlays,
  setOverlays,
  goToPrevious,
  goToToday,
  goToNext,
}: CalendarWidgetControlsProps) {
  // The widget views that benefit from "card vs inline" toggle: day, list,
  // week, multiWeek, month. Agenda has no such concept.
  const displayApplicable = resolvedView !== 'agenda';
  // Hide-weekends is currently only honored by MultiWeekView (see
  // CalendarView.tsx for matching scope). Other views ignore the flag.
  const weekendsApplicable = resolvedView === 'multiWeek';
  const showOverlayRows = displayMode === 'cards';

  const resetAll = () => {
    setDisplayMode('inline');
    setWidgetBordered(false);
    setShowNotes(false);
    setHideWeekends(false);
    setOverlays({ events: true, meals: true, chores: true, tasks: true });
  };

  return (
    // Layout mirrors the calendar subpage toolbar: Today | < > | view menu |
    // gear popover. All controls share h-8 so the toolbar reads as one band.
    <div className="flex items-stretch gap-1" onClick={(e) => e.stopPropagation()}>
      {/* Navigation (hidden in agenda-only mode) */}
      {availableViews.length > 1 && resolvedView !== 'agenda' && (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            className={cn(
              'h-8 px-2 text-xs',
              // The widget toolbar inherits its background from
              // WidgetContainer, which can be transparent over a wallpaper.
              // Without an explicit foreground color, "Today" renders white-
              // on-white in transparent mode. Force a contrasting fill.
              transparentMode
                ? 'bg-transparent border-current/30 text-current hover:bg-current/10'
                : 'bg-background text-foreground hover:bg-accent',
            )}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={goToPrevious} aria-label="Previous" className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNext} aria-label="Next" className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* View selector with stacked ▲▼ cycle triangles on the right side.
          Same pattern as the calendar subpage's ViewMenu — fixed-width
          centered trigger, triangle stack matching trigger height. */}
      {availableViews.length > 1 && (
        <ViewPopover
          viewType={viewType}
          setViewType={setViewType}
          availableViews={availableViews}
          transparentMode={transparentMode}
        />
      )}

      {/* Filter selector — display mode (cards vs inline), grid lines, notes,
          merge calendars, and overlay toggles (events/meals/chores/tasks).
          The merge toggle that used to be a separate inline button now lives
          inside this popover for a less crowded toolbar. */}
      <ViewOptionsMenu
        displayMode={displayMode}
        onDisplayModeChange={setDisplayMode}
        weeksBordered={widgetBordered}
        onWeeksBorderedChange={setWidgetBordered}
        hideWeekends={hideWeekends}
        onHideWeekendsChange={setHideWeekends}
        showNotes={showNotes}
        onShowNotesChange={setShowNotes}
        weekendsApplicable={weekendsApplicable}
        notesApplicable={notesSupported}
        displayApplicable={displayApplicable}
        mergedView={mergedView}
        onMergedViewChange={setMergedView}
        mergeApplicable={showMerge}
        overlays={overlays}
        onOverlaysChange={setOverlays}
        showOverlayRows={showOverlayRows}
        onReset={resetAll}
        triggerClassName="h-8"
      />
    </div>
  );
}

/**
 * Compact view picker with stacked ▲▼ cycle triangles next to a fixed-width
 * trigger so users can rapidly cycle through views without aiming at a
 * moving button. Mirrors the calendar page's ViewMenu, scaled for the widget
 * toolbar.
 */
function ViewPopover({
  viewType,
  setViewType,
  availableViews,
  transparentMode,
}: {
  viewType: WidgetViewType;
  setViewType: (v: WidgetViewType) => void;
  availableViews: WidgetViewType[];
  transparentMode: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const enabled = VIEW_OPTIONS.filter((opt) => availableViews.includes(opt.value));
  const activeOpt =
    VIEW_OPTIONS.find((opt) => opt.value === viewType) ?? enabled[0] ?? VIEW_OPTIONS[0]!;

  const cycle = (delta: -1 | 1) => {
    if (enabled.length < 2) return;
    const idx = enabled.findIndex((o) => o.value === activeOpt.value);
    const safeIdx = idx >= 0 ? idx : 0;
    const next = (safeIdx + delta + enabled.length) % enabled.length;
    setViewType(enabled[next]!.value);
  };

  return (
    // Fixed h-8 on the parent + h-full on the trigger + grid-rows-2 (1fr each)
    // on the triangle stack guarantees the trigger and stack share the same
    // top AND bottom edges exactly. Same pattern as the calendar page's
    // ViewMenu, scaled down for the widget toolbar.
    <div className="inline-flex items-stretch gap-1 h-8">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Calendar view"
            className={cn(
              'inline-flex items-center justify-center gap-1 h-full w-24 px-2 text-xs rounded border border-input bg-background hover:opacity-90',
              transparentMode && 'bg-transparent border-current/20',
            )}
          >
            <span className="truncate">{activeOpt.label}</span>
            <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-32 p-1">
          {VIEW_OPTIONS.map((opt) => {
            const isActive = opt.value === viewType;
            const isAvailable = availableViews.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={!isAvailable}
                onClick={() => {
                  setViewType(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs',
                  'hover:bg-accent hover:text-accent-foreground transition-colors',
                  isActive ? 'bg-accent/60 text-foreground font-medium' : 'text-muted-foreground',
                  !isAvailable && 'opacity-40 cursor-not-allowed',
                )}
              >
                <span className="flex-1 text-left">{opt.label}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      <div className="grid grid-rows-2 gap-0.5 w-7 h-full">
        <button
          type="button"
          aria-label="Previous view"
          title="Previous view"
          onClick={() => cycle(-1)}
          className="rounded border border-input hover:bg-accent inline-flex items-center justify-center min-h-0"
        >
          <span className="block text-[10px] leading-none">▲</span>
        </button>
        <button
          type="button"
          aria-label="Next view"
          title="Next view"
          onClick={() => cycle(1)}
          className="rounded border border-input hover:bg-accent inline-flex items-center justify-center min-h-0"
        >
          <span className="block text-[10px] leading-none">▼</span>
        </button>
      </div>
    </div>
  );
}
