/**
 *
 * Displays the current time and date on the dashboard.
 * This is one of the most essential widgets - always visible at a glance.
 *
 * FEATURES:
 * - Large, readable time display
 * - Current date with day of week
 * - Optional seconds display
 * - 12-hour or 24-hour format (configurable)
 * - Updates in real-time
 *
 * DESIGN CONSIDERATIONS:
 * - Large font for visibility from across the room
 * - High contrast for easy reading
 * - Minimal design to not distract
 * - Updates smoothly without flickering
 *
 * USAGE:
 *   <ClockWidget />
 *   <ClockWidget showSeconds />
 *   <ClockWidget format24Hour />
 *
 */

'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useLocale } from 'next-intl';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTimeFormat } from '@/components/providers';
import { formatDisplayTime, getDisplayDateKey, toDisplayDate } from '@/lib/utils/timeFormat';
import { WidgetContainer } from './WidgetContainer';


/**
 * CLOCK WIDGET PROPS
 */
export interface ClockWidgetProps {
  /** Show seconds in the time display */
  showSeconds?: boolean;
  /** Use 24-hour format (e.g., 14:30 vs 2:30 PM) */
  format24Hour?: boolean;
  /** Show the date below the time */
  showDate?: boolean;
  /** Widget size variant */
  size?: 'small' | 'medium' | 'large';
  /** Additional CSS classes */
  className?: string;
}


/**
 * CLOCK WIDGET COMPONENT
 * Displays the current time and date.
 *
 * HOW IT WORKS:
 * 1. Uses useState to store the current time
 * 2. useEffect sets up an interval to update every second
 * 3. Formats time/date using date-fns library
 * 4. Cleans up interval on unmount to prevent memory leaks
 *
 * PERFORMANCE NOTE:
 * The interval updates every second. For a battery-powered device,
 * you might want to update less frequently (every minute) and hide seconds.
 *
 * @example Basic usage
 * <ClockWidget />
 *
 * @example With seconds, 24-hour format
 * <ClockWidget showSeconds format24Hour />
 *
 * @example Compact (no date)
 * <ClockWidget showDate={false} />
 */
export const ClockWidget = React.memo(function ClockWidget({
  showSeconds = false,
  format24Hour,
  showDate = true,
  size = 'medium',
  className,
}: ClockWidgetProps) {
  const { timeFormat, displayTimezone } = useTimeFormat();
  const locale = useLocale();
  const effectiveTimeFormat = format24Hour === undefined
    ? timeFormat
    : format24Hour ? '24h' : '12h';
  // The current time, read when the widget mounts and then every second
  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    // Cleanup: Clear interval when component unmounts
    // This prevents memory leaks
    return () => clearInterval(intervalId);
  }, []);

  // Formatted strings
  const timeString = formatDisplayTime(currentTime, effectiveTimeFormat, { showSeconds }, displayTimezone);
  // Locale-aware, via Intl rather than a fixed date-fns pattern: word order
  // differs per language ("Tuesday, January 21" vs "Dienstag, 21. Januar"), so
  // a hardcoded pattern would render German words in US order.
  const dateString = toDisplayDate(currentTime, displayTimezone).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // The time and date size from the widget's own box (container query units),
  // so a small tile on a tablet shrinks the text instead of wrapping "4:10 PM"
  // onto two lines and pushing the date out of the box. The size class is the
  // ceiling: a roomy tile still gets the size it always had.
  const fit = clockFit(effectiveTimeFormat, showSeconds, size);
  // "4:10 PM" -> "4:10" + "PM": the day half is drawn small beside the digits,
  // which leaves the digits most of the width.
  const { digits, dayHalf, dayHalfFirst } = splitDayHalf(timeString);
  const dayHalfSpan = dayHalf && (
    <span className={cn('text-[0.45em] font-semibold', dayHalfFirst ? 'mr-[0.15em]' : 'ml-[0.15em]')}>
      {dayHalf}
    </span>
  );

  return (
    <WidgetContainer
      title="Clock"
      icon={<Clock className="h-4 w-4" />}
      size={size === 'large' ? 'wide' : 'small'}
      showHeader={false}
      // No flex here: it would replace the card's grid, the content row would
      // stop filling the tile, and the face below would have no box to size from.
      className={className}
    >
      <div
        className="flex flex-col items-center justify-center flex-1 min-h-0 w-full text-center"
        style={{ containerType: 'size' }}
        data-clock-face
      >
        {/* TIME DISPLAY */}
        <time
          dateTime={currentTime.toISOString()}
          className={cn(
            // Font styling
            'font-bold tracking-tight',
            // Tabular numbers for consistent width
            'tabular-nums',
            // One line, always: it shrinks to fit rather than wrapping
            'whitespace-nowrap leading-none'
          )}
          style={{ fontSize: fit.time }}
        >
          {dayHalfFirst && dayHalfSpan}
          {digits}
          {!dayHalfFirst && dayHalfSpan}
        </time>

        {/* DATE DISPLAY */}
        {showDate && (
          <time
            dateTime={getDisplayDateKey(currentTime, displayTimezone)}
            className={cn(
              'text-muted-foreground mt-[0.3em] text-balance leading-tight'
            )}
            style={{ fontSize: fit.date }}
          >
            {dateString}
          </time>
        )}
      </div>
    </WidgetContainer>
  );
});


/** Size ceilings per variant, in rem: text-3xl/5xl/7xl and text-sm/lg/xl. */
const TIME_REM = { small: 1.875, medium: 3, large: 4.5 } as const;
const DATE_REM = { small: 0.875, medium: 1.125, large: 1.25 } as const;

/**
 * Font sizes for the clock face that fit its box.
 *
 * The time's width is counted in em from its widest form (12:59:59 PM), not
 * the current string, so the size does not jump when 9:59 becomes 10:00.
 * Measured in bold tabular digits: "12:59" is 2.6em, ":59" adds 1.45em, and
 * the half-size " PM" adds 0.75em. The time takes at most 88% of the width
 * and 45% of the height, leaving room for two lines of date below it.
 *
 * The date keeps the text floor (it may wrap to two lines, never shrink
 * below what is readable across a room), and is otherwise capped at 9% of
 * the width so a narrow tile still wraps it into two lines, not three.
 */
export function clockFit(
  timeFormat: '12h' | '24h',
  showSeconds: boolean,
  size: keyof typeof TIME_REM,
): { time: string; date: string } {
  const em = 2.6 + (showSeconds ? 1.45 : 0) + (timeFormat === '12h' ? 0.75 : 0);
  const widthCq = Math.round((88 / em) * 10) / 10;
  return {
    time: `min(${TIME_REM[size]}rem, ${widthCq}cqw, 45cqh)`,
    date: `max(calc(var(--text-floor) * var(--zoom-inv, 1)), min(${DATE_REM[size]}rem, 9cqw, 14cqh))`,
  };
}


/**
 * Separates the day half from the digits, whichever side a locale puts it:
 * "4:10 PM" -> 4:10 + PM after; "午後4:10" -> 4:10 + 午後 first; "16:10" -> none.
 */
export function splitDayHalf(time: string): { digits: string; dayHalf: string; dayHalfFirst: boolean } {
  const after = time.match(/^(\d[\d:.]*\d)\s*(\p{L}.*)$/u);
  if (after) return { digits: after[1]!, dayHalf: after[2]!, dayHalfFirst: false };
  const first = time.match(/^(\D*\p{L}\D*?)\s*(\d[\d:.]*\d)$/u);
  if (first) return { digits: first[2]!, dayHalf: first[1]!, dayHalfFirst: true };
  return { digits: time, dayHalf: '', dayHalfFirst: false };
}


/**
 * USE CURRENT TIME HOOK
 * Custom hook for getting the current time with auto-update.
 * Can be used in other components that need real-time time.
 *
 * @param updateInterval - How often to update (ms), default 1000
 * @returns Current Date object
 *
 * @example
 * function MyComponent() {
 *   const time = useCurrentTime(60000); // Update every minute
 *   return <div>{format(time, 'h:mm a')}</div>;
 * }
 */
export function useCurrentTime(updateInterval = 1000): Date {
  const [time, setTime] = useState<Date>(() => new Date());

  useEffect(() => {
    const intervalId = setInterval(() => {
      setTime(new Date());
    }, updateInterval);

    return () => clearInterval(intervalId);
  }, [updateInterval]);

  return time;
}


/**
 * FORMAT TIME
 * Utility function to format time consistently throughout the app.
 *
 * @param date - Date to format
 * @param options - Formatting options
 * @returns Formatted time string
 *
 * @example
 * formatTime(new Date()) // "2:30 PM"
 * formatTime(new Date(), { format24Hour: true }) // "14:30"
 * formatTime(new Date(), { showSeconds: true }) // "2:30:45 PM"
 */
export function formatTime(
  date: Date,
  options: { format24Hour?: boolean; showSeconds?: boolean } = {}
): string {
  const { format24Hour = false, showSeconds = false } = options;

  const formatString = format24Hour
    ? showSeconds ? 'HH:mm:ss' : 'HH:mm'
    : showSeconds ? 'h:mm:ss a' : 'h:mm a';

  return format(date, formatString);
}
