'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  Grid3X3,
  LayoutGrid,
  List,
  ListChecks,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type ViewType =
  | 'agenda'
  | 'day'
  | 'week'
  | 'weekVertical'
  | 'multiWeek'
  | 'month'
  | 'threeMonth';

interface ViewMenuProps {
  viewType: ViewType;
  onViewChange: (viewType: ViewType) => void;
}

interface ViewOption {
  /** Key into the `calendar.views` catalogue. Shown in trigger AND menu. */
  labelKey: string;
  /** Icon shown alongside the label. */
  Icon: typeof Calendar;
  /** The view this option switches to. */
  view: ViewType;
}

/** 1W, 3W and 4W were retired (#804); `multiWeek` is the 2W grid. */
export const VIEW_MENU_OPTIONS: ViewOption[] = [
  { labelKey: 'agenda', Icon: ListChecks, view: 'agenda' },
  { labelKey: 'day', Icon: CalendarDays, view: 'day' },
  { labelKey: 'list', Icon: List, view: 'weekVertical' },
  { labelKey: 'schedule', Icon: Clock, view: 'week' },
  { labelKey: 'week2', Icon: CalendarRange, view: 'multiWeek' },
  { labelKey: 'month', Icon: LayoutGrid, view: 'month' },
  { labelKey: 'threeMonth', Icon: Grid3X3, view: 'threeMonth' },
];

export function ViewMenu({ viewType, onViewChange }: ViewMenuProps) {
  const t = useTranslations('calendar');
  const [open, setOpen] = React.useState(false);
  const activeIndex = Math.max(
    0,
    VIEW_MENU_OPTIONS.findIndex((o) => o.view === viewType),
  );
  const active = VIEW_MENU_OPTIONS[activeIndex] ?? VIEW_MENU_OPTIONS[0]!;
  const ActiveIcon = active.Icon;

  // Cycle through VIEW_MENU_OPTIONS with wraparound. Up/down arrows instead of left/right
  // because they map to the dropdown's vertical list and avoid confusion with
  // the < > date-range nav buttons.
  const cycle = (delta: -1 | 1) => {
    const next = (activeIndex + delta + VIEW_MENU_OPTIONS.length) % VIEW_MENU_OPTIONS.length;
    onViewChange(VIEW_MENU_OPTIONS[next]!.view);
  };

  return (
    // Fixed h-9 on the parent + items-stretch + h-full on the trigger and
    // grid-rows-2 (each row 1fr) on the triangle stack guarantees every
    // child shares the exact same top AND bottom edge, regardless of any
    // sub-pixel rounding from individual heights.
    <div className="inline-flex items-stretch gap-1 h-9">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 w-32 h-full justify-center">
            <ActiveIcon className="h-4 w-4 shrink-0" />
            <span className="truncate">{t(`views.${active.labelKey}`)}</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 p-1">
          {VIEW_MENU_OPTIONS.map((opt) => {
            const Icon = opt.Icon;
            const isActive = opt.view === viewType;
            return (
              <button
                key={opt.labelKey}
                type="button"
                onClick={() => {
                  onViewChange(opt.view);
                  setOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm',
                  'hover:bg-accent hover:text-accent-foreground transition-colors',
                  isActive ? 'bg-accent/60 text-foreground font-medium' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{t(`views.${opt.labelKey}`)}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
      <div className="grid grid-rows-2 gap-0.5 w-7 h-full">
        <button
          type="button"
          aria-label={t('nav.previousView')}
          title={t('nav.previousView')}
          onClick={() => cycle(-1)}
          className="rounded border border-input hover:bg-accent inline-flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors min-h-0"
        >
          <span className="block text-[10px] leading-none">▲</span>
        </button>
        <button
          type="button"
          aria-label={t('nav.nextView')}
          title={t('nav.nextView')}
          onClick={() => cycle(1)}
          className="rounded border border-input hover:bg-accent inline-flex items-center justify-center text-foreground/80 hover:text-foreground transition-colors min-h-0"
        >
          <span className="block text-[10px] leading-none">▼</span>
        </button>
      </div>
    </div>
  );
}
