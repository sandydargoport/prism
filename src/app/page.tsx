/**
 *
 * This is the main dashboard page - the home screen that displays when you
 * access Prism. It shows widgets for calendar, tasks, weather, and more.
 *
 * FILE LOCATION EXPLAINED:
 * In Next.js App Router, the URL path maps to the file system:
 *   /           -> src/app/page.tsx (this file)
 *   /calendar   -> src/app/calendar/page.tsx
 *   /tasks      -> src/app/tasks/page.tsx
 *
 * SERVER VS CLIENT COMPONENTS:
 * This file is a Server Component (the default in Next.js 14).
 * It imports the Dashboard component which is a Client Component.
 *
 * WHY THIS PATTERN?
 * - Server Component (this file): Handles metadata, initial data fetching
 * - Client Component (Dashboard): Handles interactivity, real-time updates
 *
 * This is the "Islands Architecture" pattern - static server-rendered
 * shell with interactive client-side islands where needed.
 *
 * NOTE: The AppShell (with side navigation) is now integrated into the
 * Dashboard component itself, so auth state can control nav visibility.
 *
 */

import { DashboardClient } from './DashboardClient';


/**
 * PAGE METADATA
 * This overrides the default metadata from layout.tsx for this specific page.
 * The 'title' here becomes: "Dashboard | Prism" (using the template)
 *
 * In Next.js 14, metadata is handled on the server before sending HTML.
 * This ensures search engines and social media previews get the right info.
 */
export const metadata = {
  title: 'Dashboard',
  description: 'Your family dashboard - view calendars, tasks, weather, and more.',
};


/**
 * HOME PAGE COMPONENT
 * The main dashboard page component.
 *
 * CURRENT FEATURES:
 * - Clock widget with real-time updates
 * - Weather widget with 5-day forecast
 * - Calendar widget showing upcoming events
 * - Tasks widget with checkboxes
 * - Family messages widget
 *
 * FUTURE ENHANCEMENTS:
 * - API integration for real weather data
 * - Google Calendar sync
 * - Task persistence to database
 * - Family member authentication
 * - Customizable widget layout
 *
 * DESIGN NOTES:
 * - Full screen layout optimized for 1920x1080 touchscreen
 * - Responsive grid that adapts to smaller screens
 * - Dark mode support via CSS variables
 */
export default function HomePage() {
  // FUTURE: Server-side data fetching
  // In a production app, you would fetch initial data here:
  //
  // const weatherData = await fetchWeather();
  // const calendarEvents = await fetchEvents();
  // const tasks = await fetchTasks();
  //
  // Then pass them as props to Dashboard for hydration.
  // This improves initial load time since data arrives with the HTML.

  return (
    <main className="min-h-screen bg-background">
      {/*
        DASHBOARD COMPONENT
        The main interactive dashboard with all widgets.

        Props:
        - requireAuth: Set to true to show PIN pad before dashboard
        - currentUser: Pre-authenticated user (for server-side auth)
        - weatherLocation: Location for weather widget

        TODO in future phases:
        - Pass server-fetched data as initialData prop
        - Implement proper authentication flow
        - Add user preferences from database
      */}
      <DashboardClient />
    </main>
  );
}
