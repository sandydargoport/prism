## Code Documentation Standards

### File Header Comments

```typescript
/**
 * CalendarWidget.tsx
 *
 * Displays upcoming calendar events on the dashboard.
 * Shows events from all enabled calendars with color-coding.
 *
 * Features:
 * - Multi-calendar display
 * - Color-coded by calendar
 * - Touch-enabled event details
 * - Responsive layout
 *
 * @component
 * @example
 * <CalendarWidget size="medium" maxEvents={5} />
 */
```

### Function Documentation

```typescript
/**
 * Syncs events from Google Calendar to local database
 *
 * @param calendarId - Google Calendar ID to sync
 * @param syncToken - Optional sync token for incremental sync
 * @returns Array of synced events
 * @throws {SyncError} If sync fails due to auth or network issues
 *
 * @example
 * const events = await syncGoogleCalendar('primary');
 */
async function syncGoogleCalendar(
  calendarId: string,
  syncToken?: string
): Promise<Event[]> {
  // Implementation with inline comments...
}
```

### Inline Comments for Non-Coders

```typescript
// CUSTOMIZE: Change this color to match your family member's color
const ERIC_COLOR = '#3B82F6'; // Blue

// CUSTOMIZE: Change idle timeout (in seconds)
const IDLE_TIMEOUT = 120; // 2 minutes

// DO NOT MODIFY: This handles authentication with Google
const oauth2Client = new google.auth.OAuth2(/* ... */);

// FEATURE: Show/hide seasonal themes
// Set to false if you prefer a clean look year-round
const ENABLE_SEASONAL_THEMES = true;
```

### Component Documentation

```typescript
interface CalendarWidgetProps {
  /** Widget size (small: 1/6 screen, medium: 1/4, large: 1/2) */
  size: 'small' | 'medium' | 'large';

  /** Maximum number of events to display */
  maxEvents?: number;

  /** Which calendars to show (null = all) */
  calendarIds?: string[] | null;

  /** Show/hide all-day events */
  showAllDay?: boolean;
}

/**
 * Calendar Widget Component
 *
 * Displays a list of upcoming calendar events with color-coding.
 * Users can tap events to view details or edit (if permissions allow).
 */
export function CalendarWidget({
  size,
  maxEvents = 10,
  calendarIds = null,
  showAllDay = true
}: CalendarWidgetProps) {
  // Component implementation...
}
```
