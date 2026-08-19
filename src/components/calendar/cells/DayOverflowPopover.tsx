'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime } from '@/lib/utils/timeFormat';

interface DayOverflowPopoverProps {
  /** The date this popover represents — shown in the popover header. */
  date: Date;
  /** Events that didn't fit in the cell. */
  hiddenEvents: CalendarEvent[];
  /** Click handler for an individual event. */
  onEventClick: (event: CalendarEvent) => void;
  /** Optional className for the trigger button. */
  triggerClassName?: string;
}

/**
 * "+N more" button that opens a popover listing the events that didn't fit.
 * Touch-friendly: trigger is a 32px+ tappable button; the popover itself is
 * Radix-managed and dismisses on outside click / Escape.
 */
export function DayOverflowPopover({
  date,
  hiddenEvents,
  onEventClick,
  triggerClassName,
}: DayOverflowPopoverProps) {
  const { timeFormat } = useTimeFormat();
  const [open, setOpen] = React.useState(false);

  if (hiddenEvents.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className={cn(
            // Full-width + a taller min-height so it's an easy touch target on a
            // wall display (was min-h-20px / 10px text — fiddly to tap).
            'flex w-full items-center text-left text-[11px] font-medium px-2 py-1 rounded',
            'bg-muted/60 hover:bg-muted active:bg-muted text-muted-foreground transition-colors',
            'min-h-[28px]',
            triggerClassName,
          )}
        >
          + {hiddenEvents.length} more
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-60"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-semibold text-muted-foreground mb-2">
          {format(date, 'EEEE, MMM d')}
        </div>
        <ul className="space-y-1 list-none m-0 p-0">
          {hiddenEvents.map((event) => (
            <li key={event.id}>
              <button
                onClick={() => {
                  onEventClick(event);
                  setOpen(false);
                }}
                className="w-full text-left px-2 py-1 rounded bg-card hover:bg-accent transition-colors flex items-center gap-2 border border-border/40"
                style={{ borderLeft: `3px solid ${event.color}` }}
              >
                {!event.allDay && (
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                    {formatDisplayTime(event.startTime, timeFormat)}
                  </span>
                )}
                <span className="text-xs font-medium truncate flex-1 text-foreground">
                  {event.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
