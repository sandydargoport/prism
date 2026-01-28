/**
 * ============================================================================
 * PRISM - Clock Widget
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
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
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer } from './WidgetContainer';


/**
 * CLOCK WIDGET PROPS
 * ============================================================================
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
 * ============================================================================
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
 * ============================================================================
 */
export function ClockWidget({
  showSeconds = false,
  format24Hour = false,
  showDate = true,
  size = 'medium',
  className,
}: ClockWidgetProps) {
  // State to hold the current time
  // Initialize with current time to avoid hydration mismatch
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Update the time every second
  useEffect(() => {
    // Update immediately on mount
    setCurrentTime(new Date());

    // Set up interval for updates
    const intervalId = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    // Cleanup: Clear interval when component unmounts
    // This prevents memory leaks
    return () => clearInterval(intervalId);
  }, []);

  // Format strings for date-fns
  // See: https://date-fns.org/docs/format
  const timeFormat = format24Hour
    ? showSeconds ? 'HH:mm:ss' : 'HH:mm'
    : showSeconds ? 'h:mm:ss a' : 'h:mm a';

  const dateFormat = 'EEEE, MMMM d'; // e.g., "Tuesday, January 21"

  // Formatted strings
  const timeString = format(currentTime, timeFormat);
  const dateString = format(currentTime, dateFormat);

  // Size-based styling
  const timeStyles = {
    small: 'text-3xl',
    medium: 'text-5xl',
    large: 'text-7xl',
  };

  const dateStyles = {
    small: 'text-sm',
    medium: 'text-lg',
    large: 'text-xl',
  };

  return (
    <WidgetContainer
      title="Clock"
      icon={<Clock className="h-4 w-4" />}
      size={size === 'large' ? 'wide' : 'small'}
      showHeader={false}
      className={cn('flex items-center justify-center', className)}
    >
      <div className="flex flex-col items-center justify-center h-full text-center">
        {/* TIME DISPLAY */}
        <time
          dateTime={currentTime.toISOString()}
          className={cn(
            // Font styling
            'font-bold tracking-tight',
            // Tabular numbers for consistent width
            'tabular-nums',
            // Size-based class
            timeStyles[size]
          )}
        >
          {timeString}
        </time>

        {/* DATE DISPLAY */}
        {showDate && (
          <time
            dateTime={currentTime.toISOString().split('T')[0]}
            className={cn(
              'text-muted-foreground mt-1',
              dateStyles[size]
            )}
          >
            {dateString}
          </time>
        )}
      </div>
    </WidgetContainer>
  );
}


/**
 * USE CURRENT TIME HOOK
 * ============================================================================
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
 * ============================================================================
 */
export function useCurrentTime(updateInterval = 1000): Date {
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    setTime(new Date());

    const intervalId = setInterval(() => {
      setTime(new Date());
    }, updateInterval);

    return () => clearInterval(intervalId);
  }, [updateInterval]);

  return time;
}


/**
 * FORMAT TIME
 * ============================================================================
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
 * ============================================================================
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
