# Calendar System

## Overview
The calendar system provides multiple views for managing events across personal and family calendars, with Google Calendar integration.

## Views

### Day View (DayViewSideBySide)
- Side-by-side columns per calendar group
- All 24 hours displayed with auto-scaling to fit screen
- All-day events in header section
- Hidden hours toggle (clock icon) in top-left
- Overlapping events cycle through horizontal positions

### Week View
- **Landscape**: 7-column grid with time column on left
- **Portrait**: Split into 2 rows (Sun-Wed, Thu-Sat+next Sun)
- All 24 hours with CSS grid auto-scaling
- Hidden hours toggle available
- All-day events in scrollable header per day

### Two-Week View
- **Landscape**: 7 columns x 2 rows
- **Portrait**: 2 columns (Week 1, Week 2) x 7 rows (days)
- Week numbers displayed in header
- Scrollable day cells for events

### Month View
- Traditional calendar grid
- Scrollable day cells (no event truncation)
- Past days visually muted

### Three-Month View
- Three-column overview
- Compact event display
- Good for long-term planning

## Navigation

### Button Navigation
- Previous/Next buttons in header
- "Today" button to jump to current date
- View switcher (hidden on mobile)

### Swipe Navigation
- Swipe left → go forward
- Swipe right → go back
- Period advances based on view type
- 50px threshold, ignores slow swipes

## Hidden Hours Feature

### Configuration
Located in Settings → Display → Calendar Hours:
- Set start hour (e.g., 12 AM)
- Set end hour (e.g., 6 AM)
- Hours hidden when toggle is active

### Toggle Button
- Clock icon in top-left of day/week views
- Highlighted when hiding is active
- Click to show/hide configured time block
- Remaining hours auto-resize to fill space

## Calendar Groups

### Types
- **User calendars**: Auto-created per family member
- **Custom groups**: Manually created groupings

### Features
- Color coding per group
- Filter calendars in calendar widget
- Inline name chips for quick filtering

## Google Calendar Integration

### OAuth Flow
- Microsoft Graph API compatible
- Scopes: Calendar.ReadWrite
- Token encryption at rest

### Sync Behavior
- Bidirectional sync
- 10-minute auto-sync interval
- Manual sync via Settings → Calendars
- Birthday extraction from contacts calendar

## Event Creation

### Add Event Modal
- Calendar selector (filterable via settings)
- Color picker with presets + user profile color
- Title, description, location
- Start/end time or all-day toggle
- Recurrence options

### Calendar Visibility
- Configure per calendar in Settings → Calendars
- "Show in Add Event modal" toggle
- Subscription calendars auto-hidden

## Mobile Behavior
- Forced to day view on mobile devices
- View switcher hidden
- Swipe navigation active
- Bottom padding for navigation bar

## Files
- `src/app/calendar/CalendarView.tsx` - Main page
- `src/app/calendar/useCalendarViewData.ts` - Data hook
- `src/components/calendar/WeekView.tsx`
- `src/components/calendar/DayViewSideBySide.tsx`
- `src/components/calendar/TwoWeekView.tsx`
- `src/components/calendar/MonthView.tsx`
- `src/components/calendar/ThreeMonthView.tsx`
- `src/lib/hooks/useHiddenHours.ts` - Hidden hours state
- `src/lib/hooks/useSwipeNavigation.ts` - Touch gestures
