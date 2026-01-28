### 1. Multi-Calendar System

#### Calendar Sources & Mapping
**Concept:** Multiple external calendars can map to a single dashboard calendar

**Important Clarifications:**
- **Family Calendar is NOT a user** - It is a shared calendar source that any family member can view/add to
- **Default Calendar:** When creating events, the default selection should be "Other" (or the user's personal calendar), NOT the Family calendar
- **Family Calendar:** Available as a selection option, but not pre-selected by default
- **Per-User Calendars:** Each family member has their own calendar for personal events

**Example Mapping:**
```
Google Calendar Sources          →  Dashboard Calendar
├─ "US Holidays"                →  Family Calendar (shared)
├─ "Birthdays"                  →  Family Calendar (shared)
├─ "Travel Calendar"            →  Family Calendar (shared)
├─ "Alex Work Calendar"         →  Alex's Calendar (personal)
└─ "Jordan Client Calendar"        →  Jordan's Calendar (personal)

Apple iCal Sources              →  Dashboard Calendar
├─ "School Events"              →  Family Calendar (shared)
├─ "Emma Activities"        →  Emma's Calendar (personal)
└─ "Sophie Activities"           →  Sophie's Calendar (personal)

Internal Calendars (No External Sync)
├─ "Other"                      →  Other Calendar (default for new events)
└─ "Family"                     →  Family Calendar (shared, selectable)
```

**Calendar Selection Behavior:**
- When adding a new event, "Other" should be the default calendar selection
- Users can explicitly choose "Family" or their personal calendar
- Family calendar is a shared resource, not tied to any individual user

#### Supported Calendar Protocols
- **Google Calendar API** (OAuth 2.0)
- **Apple iCal** (CalDAV protocol)
- **Microsoft 365/Outlook** (Graph API - future)
- **Generic CalDAV** (for other services)

#### Calendar Views
1. **Day View (Side-by-Side)** - Shows each family member's calendar in separate columns, aligned by hour vertically. For a 4-person family, displays 4 calendars horizontally with hours running vertically down the page.
2. **3-Day View** - Today + next 2 days
3. **Week View** - Current week (Sunday-Saturday)
4. **Two-Week View (Sun-Sat)** - Current + next week, Sunday start (DEFAULT)
5. **Month View** - Full calendar month

#### Calendar Features
- **Color Coding:** Each dashboard calendar has unique color
- **Toggle Visibility:** Show/hide individual calendars
- **All/None Toggle:** Quickly show all or hide all calendars
- **Event Details:** Tap event to view full details (title, time, location, notes)
- **Add Event:** Tap empty time slot or "+" button
- **Edit Event:** Long-press event (if permissions allow)
- **Delete Event:** Swipe or trash icon (parents only)
- **Recurring Events:** Support for daily, weekly, monthly, yearly
- **All-Day Events:** Display at top of day
- **Multi-Day Events:** Span across days visually
- **Event Reminders:** Visual + optional sound notification
- **Sync Status:** Show last sync time, manual refresh option

#### Event Creation Form
```
┌─ Add Event ────────────────────┐
│ Title: [________________]      │
│ Calendar: [Alex ▼]             │
│ Start: [Jan 31] [6:00 PM]      │
│ End:   [Jan 31] [7:00 PM]      │
│ Repeats: [Weekly ▼]            │
│ Until: [May 31, 2025]          │
│ Location: [________________]   │
│ Notes: [________________]      │
│                                │
│ [Cancel]  [Save to Calendar]   │
└────────────────────────────────┘
```

#### Sync Configuration
- **Sync Interval:** 5-15 minutes (configurable)
- **Manual Refresh:** Pull-to-refresh or button
- **Bi-directional:** Dashboard → External calendars
- **Conflict Resolution:** Last-write-wins
- **Offline Support:** Cache events locally, sync when online
