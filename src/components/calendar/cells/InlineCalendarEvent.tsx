'use client';

import { cn } from '@/lib/utils';
import { contrastText } from '@/lib/utils/color';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, isCalendarEventPast } from '@/lib/utils/timeFormat';

export type InlineCalendarEventProps = {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
  compact?: boolean;
  showTime?: boolean;
  className?: string;
};

/**
 * Shared filled-chip / timed-dot treatment for compact calendar views.
 *
 * Spacing comes from custom properties rather than fixed classes, so a theme's
 * `events` mode can tighten the whole ramp. The fallbacks are the values that
 * were hard-coded here before, so a theme that says nothing renders exactly as
 * it always did.
 *
 * The `compact` prop is a different axis and stays: it is the caller saying
 * this chip is in a small cell. A theme says how tight the house likes its
 * calendar; the view says how much room this particular one has.
 */
export function InlineCalendarEvent({
  event,
  onClick,
  compact = false,
  showTime = true,
  className,
}: InlineCalendarEventProps) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const past = isCalendarEventPast(
    event.startTime,
    event.endTime,
    event.allDay,
    new Date(),
    displayTimezone
  );
  const time =
    showTime && !event.allDay
      ? formatDisplayTime(event.startTime, timeFormat, {}, displayTimezone)
      : null;

  return (
    <button
      type="button"
      title={event.title}
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onClick(event);
      }}
      className={cn(
        'w-full min-w-0 truncate rounded text-left transition-[background-color,filter,opacity]',
        'font-[var(--event-font-weight)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-seasonal-accent',
        'leading-tight',
        compact ? 'px-0.5 py-px text-[8px]' : 'px-[var(--event-padding-x,0.25rem)] py-[var(--event-padding-y,0.125rem)] text-[length:var(--event-font-size,0.75rem)]',
        event.allDay ? 'block hover:brightness-95' : 'flex items-center gap-1 hover:bg-accent/60',
        past && 'opacity-55 saturate-[0.65]',
        className
      )}
      style={
        event.allDay
          ? { backgroundColor: event.color, color: past ? contrastText(event.color) : '#fff' }
          : undefined
      }
    >
      {event.allDay ? (
        event.title
      ) : (
        <>
          <span
            aria-hidden
            className={cn('shrink-0 rounded-full', compact ? 'h-1 w-1' : 'h-1.5 w-1.5')}
            style={{ backgroundColor: event.color }}
          />
          {time && <span className="shrink-0 tabular-nums text-muted-foreground">{time}</span>}
          <span className="truncate text-foreground">{event.title}</span>
        </>
      )}
    </button>
  );
}
