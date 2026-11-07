/**
 *
 * The full-screen calendar view with multiple display options.
 * This is the expanded version of the calendar widget.
 *
 * VIEWS:
 * - Day: Single day with hourly breakdown
 * - Week: Current week overview
 * - Two-Week: Current + next week (default)
 * - Month: Full calendar month
 *
 * FEATURES:
 * - View switching between day/week/two-week/month
 * - Calendar filtering by family member
 * - Event creation (tap on empty time slot)
 * - Event details (tap on event)
 * - Navigation (previous/next period)
 *
 */

import { Suspense } from 'react';
import { CalendarView } from './CalendarView';
import { CalendarSkeleton } from './CalendarSkeleton';


/**
 * PAGE METADATA
 */
export const metadata = {
  title: 'Calendar',
  description: 'View and manage your family calendar events.',
};


/**
 * CALENDAR PAGE COMPONENT
 * Server component that renders the calendar page.
 * The CalendarView is a client component for interactivity.
 */
export default function CalendarPage() {
  return (
    <main className="min-h-fill bg-background">
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarView />
      </Suspense>
    </main>
  );
}
