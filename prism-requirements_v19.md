# Family Dashboard - Complete Requirements & Architecture Document

## Project Overview

**Project Name:** TBD - Choose from recommendations below:

1. **HomeHive** - Suggests a bustling, collaborative family hub (like a beehive)
2. **NestBoard** - Warm, family-oriented, suggests a central gathering place
3. **FamilyFlow** - Emphasizes smooth coordination and daily rhythms
4. **Hearth** - Evokes warmth, home, the heart of the household
5. **Together** - Simple, meaningful, emphasizes family connection

**Purpose:** Open-source family calendar and dashboard with unique enhancements  
**Target Audience:** Families wanting a centralized touchscreen display for calendars, tasks, chores, and home information  
**License:** Open Source (MIT License recommended)

---

## Technical Stack

### Core Technologies
- **Frontend Framework:** React 18+ with TypeScript
- **Application Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS (for easy customization by non-coders)
- **Database:** PostgreSQL 15+
- **Caching:** Redis (optional, for performance)
- **Deployment:** Docker + Docker Compose
- **Target Environment:** Windows host running Docker Desktop (Linux containers)

### Key Libraries
- **UI Components:** shadcn/ui (accessible, customizable)
- **Drag & Drop:** react-grid-layout (for customizable widgets)
- **Charts:** Recharts (for solar monitoring, statistics)
- **Date Handling:** date-fns
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod validation
- **State Management:** React Context + hooks (keep it simple)
- **API Calls:** Native fetch with error handling

---

## Display Specifications

### Primary Target Displays
- **ViewSonic TD2465** (24", 1920x1080, touchscreen)
- **ViewSonic TD2760** (27", 1920x1080, touchscreen)
- **Dell P2424HT** (24", 1920x1080, touchscreen)

### Display Characteristics
- **Resolution:** 1920x1080 (Full HD) - optimize for this
- **Aspect Ratio:** 16:9
- **Touch Input:** Capacitive touch (finger and stylus)
- **Orientation:** Portrait or Landscape (configurable)
- **Mounting:** Wall-mounted (consider touch height for kids)

### Responsive Design Requirements
- **Primary:** 1920x1080 desktop touchscreen
- **Secondary:** Mobile browser (view-only or limited editing)
- **Tablet:** Full functionality on iPad/Android tablets
- **Minimum Support:** 1280x720 (HD)

---

## User Personas & Permissions

### Family Structure (Example - Template for Users)
- **Alex** - Parent, Full Admin
- **Jordan** - Parent, Full Admin  
- **Emma** - Child (school age), Limited permissions
- **Sophie** - Child (school age), Limited permissions

### Permission Levels

| Action | Parent | Child | Guest |
|--------|--------|-------|-------|
| View all calendars | ✅ | ✅ | ✅ |
| View own calendar | ✅ | ✅ | ❌ |
| Add event (own calendar) | ✅ | ✅ | ❌ |
| Edit event (own calendar) | ✅ | ✅ | ❌ |
| Delete event (own calendar) | ✅ | ❌ | ❌ |
| Add/Edit/Delete any event | ✅ | ❌ | ❌ |
| Manage tasks/chores | ✅ | ✅* | ❌ |
| Complete tasks/chores | ✅ | ✅ | ❌ |
| Delete completed items | ✅ | ❌ | ❌ |
| Modify settings | ✅ | ❌ | ❌ |
| Access smart home controls | ✅ | ❌ | ❌ |
| View family locations | ✅ | ✅ | ❌ |
| Post family messages | ✅ | ✅ | ❌ |
| Delete family messages | ✅ | ❌ | ❌ |
| Toggle Away Mode | ✅ | ❌ | ❌ |

*Children can add tasks/chores for themselves but cannot assign to others

### Authentication System
- **Login Method:** PIN or password-based
- **Session Length:** Configurable (default: 30 minutes for parents, 15 for children)
- **Auto-logout:** After inactivity timeout
- **Remember Device:** Optional (for trusted displays)
- **Default Mode:** View-only (no login required for viewing)
- **Quick Login:** Pin pad with family member photos

---

## Core Features - Version 1.0

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

---

### 2. Task Management (Hybrid Model)

#### Internal Task System (Always Available)
**Features:**
- Create, edit, delete tasks
- Assign to family members
- Due dates and priorities (High, Medium, Low)
- Categories/tags (Work, School, Home, Personal)
- Subtasks/checklists
- Notes/descriptions
- Mark complete/incomplete
- Archive completed tasks

**Task Structure:**
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  assignedTo: string; // Family member ID
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  category: string;
  completed: boolean;
  completedDate?: Date;
  subtasks?: SubTask[];
  source: 'internal' | 'microsoft-todo' | 'apple-reminders';
  sourceId?: string; // External ID if synced
  lastSynced?: Date;
  createdBy: string;
  createdAt: Date;
}
```

#### Microsoft To Do Integration (Optional)
- **Authentication:** Microsoft Graph API OAuth 2.0
- **Sync Direction:** Bi-directional (read & write)
- **Sync Interval:** 10-15 minutes
- **List Mapping:** Map To Do lists to family members
- **Conflict Resolution:** Dashboard changes take precedence for internal tasks

#### Future Integrations (Architecture Ready)
- Apple Reminders (CalDAV or iCloud API)
- Todoist (REST API)
- Google Tasks (Google Tasks API)
- TickTick
- Any.do

#### Task Display
- **Widget:** "Today's Tasks" on main dashboard
- **Dedicated Page:** Full task list with filters
- **Filters:** By person, priority, due date, category
- **Sort:** Due date, priority, alphabetical
- **Color Coding:** By assigned person (matches calendar colors)
- **Source Indicator:** Small icon showing task source

---

### 3. Chores System (Hybrid Model)

#### Internal Chores System (Primary)
**Why Internal is Better:**
- Touch-optimized for kids
- Parent approval workflow
- Allowance/points tracking
- Custom recurring schedules
- Gamification features

**Chore Structure:**
```typescript
interface Chore {
  id: string;
  title: string;
  description?: string;
  assignedTo: string;
  schedule: 'daily' | 'weekly' | 'monthly' | 'custom';
  scheduleDays?: number[]; // [0,2,4] = Sun, Tue, Thu
  points?: number; // For allowance tracking
  requiresApproval: boolean;
  lastCompleted?: Date;
  completions: ChoreCompletion[];
  source: 'internal' | 'external';
  createdAt: Date;
}

interface ChoreCompletion {
  id: string;
  choreId: string;
  completedBy: string;
  completedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  points?: number;
  photoProof?: string; // Optional: kid takes photo of completed chore
}
```

#### Features
- **Recurring Schedules:** Daily, weekly, biweekly, monthly, custom interval (N days)
- **Assignments:** Assign to specific family members or leave unassigned (anyone can complete)
- **Points/Allowance:** Optional point system for allowance tracking
- **Parent Approval:** Child completions always require parent approval; parents self-approve
- **Photo Proof:** Kids can take photo of completed chore (optional)
- **Progress Tracking:** Weekly/monthly completion rates
- **Reminders:** Notification when chore is due
- **Chore Rotation:** Auto-rotate assignments weekly/monthly
- **Next Due Calculation:** After completion/approval, chore hides until next due date based on frequency

#### Permission Logic (Implemented)
- **Children can only complete their own assigned chores** - If a chore is assigned to Sophie, Emma cannot complete it (and vice versa). Unassigned chores can be completed by any family member.
- **Children cannot complete each other's tasks** - Same ownership rules apply to tasks.
- **Duplicate completion prevention** - If a chore is already pending parental approval, children see "This chore is already pending parental approval" instead of creating duplicate completions.
- **Parent approval workflow:**
  - When a child completes a chore, it enters "pending" state
  - Parents can approve via dedicated approve button OR by clicking "complete" on a pending chore (which auto-approves)
  - Only after approval does the chore's `nextDue` date update and the chore disappears until next due

#### Dedicated Chores Page
```
┌─ CHORES ───────────────────────────────────┐
│  Emma's Chores (5 points earned)       │
│  ☑️ Make bed (approved) ............. 1pt   │
│  ☑️ Feed dog (pending approval) .... 2pts  │
│  ⬜ Empty dishwasher ............... 2pts   │
│  ⬜ Homework (30 min) .............. 0pts   │
│                                            │
│  Sophie's Chores (3 points earned)           │
│  ☑️ Brush teeth (approved) ......... 0pts   │
│  ☑️ Put away toys (approved) ....... 1pt    │
│  ⬜ Set table ...................... 2pts   │
└────────────────────────────────────────────┘
```

#### CSV Import/Export
- Export chores list to CSV
- Import from CSV (for users syncing with other systems)
- Template CSV for easy creation

#### Future Integrations (Optional)
- OurHome (if API becomes available)
- Homey (if API available)
- ChoreMonster (if API available)

---

### 4. Shopping List (Hybrid Model)

#### Internal Shopping List (Primary)
**Features:**
- Add, edit, delete items
- Categories (Produce, Dairy, Meat, Pantry, etc.)
- Quantity and units
- Check off items
- Uncheck to add back to list
- Multiple lists (Grocery, Hardware, Pharmacy)
- Share list via QR code (for mobile access in store)
- **List Assignment:** Assign lists to specific family members or leave unassigned for "All Family"
  - When assigned to a specific user, only that user (or parents) can check off items
  - Unassigned lists allow any family member to check items
  - Anyone can add items to any list (no restrictions on adding)

**Implementation Status:**
- ✅ Add/edit/delete items on existing lists
- ✅ Check/uncheck items with permission enforcement
- ✅ Database schema supports `assignedTo` field on lists
- ✅ API supports list assignment
- ❌ **TODO:** UI to create new shopping lists
- ❌ **TODO:** UI to assign/edit list ownership

**List Structure:**
```typescript
interface ShoppingList {
  id: string;
  name: string; // "Grocery", "Target", "Hardware", etc.
  sortOrder: number;
  assignedTo?: string | 'all'; // User ID or 'all' for family-wide
  createdAt: Date;
  items: ShoppingItem[];
}
```

**Item Structure:**
```typescript
interface ShoppingItem {
  id: string;
  name: string;
  quantity?: number;
  unit?: string; // lbs, oz, count, etc.
  category: string;
  listId: string; // Which list (grocery, hardware, etc.)
  checked: boolean;
  addedBy: string;
  source: 'internal' | 'anylist' | 'bring';
  sourceId?: string;
  notes?: string;
  recurring?: boolean; // Auto-add weekly/monthly
  createdAt: Date;
}
```

#### Shopping List Display
- **Widget:** "Shopping List" showing unchecked items
- **Dedicated Page:** Full list organized by grocery store location
- **Store Layout Categories:**
  - 🥬 Produce (fruits, vegetables)
  - 🥩 Meat & Seafood
  - 🧀 Dairy & Refrigerated
  - ❄️ Frozen Foods
  - 🥫 Pantry & Canned Goods
  - 🍞 Bakery
  - 🌮 Ethnic Foods (Asian, Latin, etc.)
  - 🧴 Health & Beauty
  - 🧹 Household & Cleaning
  - 🐕 Pet Supplies
  - 🍷 Beverages & Alcohol
  - 🍪 Snacks & Candy
  - Other

**Smart Features:**
- **Auto-Categorization:** Items automatically assigned to categories based on name
- **Learning:** System learns from manual category changes
- **Custom Order:** Reorder categories to match your store's layout
- **Quick Add:** 
  - **Voice-to-Text (Critical Feature):** Tap microphone icon, speak item
  - Works via browser Web Speech API (no backend needed)
  - Example: "Milk, apples, chicken breast, tortillas"
  - System parses and categorizes automatically
- **Alexa Integration (Optional):**
  - "Alexa, add milk to my shopping list"
  - "Alexa, add eggs and bread to my shopping list"
  - Alexa skill sends items to dashboard API
  - Items automatically categorized

**Shopping Experience:**
- Categories collapse/expand
- Check off items as you shop
- Unchecked items move to top
- "Smart Shop" mode: Reorder by your typical store path
- Share list QR code for in-store mobile access

#### Mobile Access
- **QR Code:** Display QR code that opens mobile-friendly list
- **Responsive:** Works on phone browser
- **Real-time Sync:** Check off items on phone, updates dashboard

#### Future Integrations (Architecture Ready)
- **AnyList** (has API)
- **Bring!** (has API)
- **Google Keep** (unofficial API)
- **Apple Reminders** (shopping list)
- **Mariano's** (if API becomes available - research needed)
- **Out of Milk**

---

### 5. Meal Planning (Hybrid Model)

#### Internal Meal List (V1.0)
**Simple Weekly Meal List:**
- List of meals planned for the week
- Optional: Assign to specific days
- Check off as cooked
- Reset weekly (Sunday)
- Notes field (e.g., "prep veggies night before")
- Recipe link field (optional)

**Meal Structure:**
```typescript
interface Meal {
  id: string;
  name: string;
  day?: string; // Optional: 'monday', 'tuesday', etc., or null
  recipeUrl?: string;
  notes?: string;
  cooked: boolean;
  cookedDate?: Date;
  source: 'internal' | 'paprika';
  sourceId?: string;
  weekOf: Date; // Week this meal is planned for
  createdBy: string;
}
```

#### Meal Widget
```
┌─ THIS WEEK'S MEALS ────────────┐
│ Monday                         │
│   ☑️ Spaghetti & meatballs      │
│ Tuesday                        │
│   ⬜ Chicken tacos              │
│ Wednesday                      │
│   ⬜ Salmon with roasted veggies│
│ Thursday - Sunday              │
│   ⬜ Pizza (takeout)            │
│   ⬜ Grilled burgers            │
│   ⬜ Leftovers buffet           │
│                                │
│ Not assigned to specific days: │
│   ⬜ Pasta primavera            │
└────────────────────────────────┘
```

#### Features
- **Day Assignment:** Optional - can just list meals for the week
- **Quick Add:** Add meal name and optional day
- **Reorder:** Drag to reassign days
- **Recipe Links:** Click to open recipe
- **Shopping Integration:** Optionally add ingredients to shopping list
- **Meal History:** See what you cooked last week/month

#### Paprika Integration (Phase 2)
- **Full Recipe Import:** Import recipes from Paprika
- **Meal Plans:** Sync Paprika meal plans
- **Grocery List Sync:** Import Paprika grocery list to shopping list
- **Pantry Management:** Track what's in stock
- **Authentication:** Paprika API (documentation limited, may require reverse engineering)

---

### 6. Maintenance Reminders (Internal)

#### Purpose
Track recurring home, car, and appliance maintenance

#### Reminder Structure
```typescript
interface MaintenanceReminder {
  id: string;
  title: string;
  category: 'car' | 'home' | 'appliance' | 'yard' | 'other';
  description?: string;
  schedule: 'monthly' | 'quarterly' | 'annually' | 'custom';
  customInterval?: number; // Days
  lastCompleted?: Date;
  nextDue: Date;
  assignedTo?: string;
  completed: boolean;
  completions: MaintenanceCompletion[];
  notes?: string;
  cost?: number; // Optional cost tracking
  vendor?: string; // Who did the work
  createdAt: Date;
}

interface MaintenanceCompletion {
  id: string;
  completedDate: Date;
  completedBy: string;
  cost?: number;
  vendor?: string;
  notes?: string;
}
```

#### Examples
- **Car:** Oil change every 3 months, tire rotation every 6 months
- **Home:** Replace HVAC filter monthly, clean gutters quarterly
- **Appliances:** Clean dryer vent annually, replace water filter quarterly
- **Yard:** Fertilize lawn quarterly, winterize sprinklers

#### Display
- **Low-Priority Widget:** Collapsible section showing upcoming items
- **Notifications:** Reminder 1 week before due, day of due
- **Dedicated Page:** Full maintenance log with history
- **Calendar Integration:** Optionally show on calendar

#### Features
- **History Tracking:** See when last completed and by whom
- **Cost Tracking:** Optional cost field for budgeting
- **Vendor Notes:** Track who did the work
- **Export:** CSV export for record keeping

---

### 7. Weather Widget

#### Data Source
- **Primary:** OpenWeatherMap API (free tier: 1,000 calls/day)
- **Backup:** Weather.gov API (free, US only)

#### Display Information
- **Current Conditions:**
  - Temperature (°F or °C)
  - "Feels like" temperature
  - Conditions (sunny, cloudy, rainy, etc.)
  - Humidity %
  - Wind speed and direction
  
- **4-5 Day Forecast:**
  - High/Low temperatures
  - Precipitation chance
  - Weather icon
  - Brief description

#### Widget Design
```
┌─ WEATHER ──────────────────────┐
│  Currently in Springfield, IL   │
│  ☀️ 72°F (Feels like 70°F)     │
│  Sunny • Humidity 45%          │
│                                │
│  Tue  Wed  Thu  Fri  Sat       │
│  ☀️   ⛅   🌧️   ☁️   ☀️        │
│  75°  68°  62°  65°  70°       │
│  58°  52°  48°  50°  55°       │
└────────────────────────────────┘
```

#### Configuration
- **Location:** Auto-detect or manual entry (city, zip code, coordinates)
- **Units:** Fahrenheit or Celsius
- **Update Frequency:** Every 30-60 minutes
- **Alerts:** Severe weather notifications

---

### 8. Clock Widget

#### Display Elements
- **Time:** Large, readable format (12hr or 24hr)
- **Date:** Day of week, month, day, year
- **Optional:** Seconds display (configurable)
- **Optional:** Sunrise/sunset times

#### Clock Formats
```
┌─ Standard ─────────────────┐    ┌─ Detailed ─────────────────┐
│  2:34 PM                   │    │  Tuesday, January 20       │
│  Tuesday, Jan 20           │    │  2:34:15 PM                │
└────────────────────────────┘    │  Sunrise: 7:12 AM          │
                                  │  Sunset:  5:48 PM          │
                                  └────────────────────────────┘
```

#### Features
- **Time Zone:** Auto-detect or manual selection
- **DST Awareness:** Automatically adjust for daylight saving
- **World Clocks:** Optional additional time zones (for travel/family)
- **Countdown Timers:** Optional countdown to events ("2 days until vacation")

---

### 9. Photo Slideshow

#### Photo Sources
- **iCloud Photos** (primary) - via iCloud API
- **OneDrive** (backup/additional) - via Microsoft Graph API
- **Local Upload:** Direct file upload to dashboard
- **Google Photos** (future) - via Google Photos API

#### Slideshow Features
- **Album Selection:** Choose which albums to include/exclude
- **Transition Effects:** Fade, slide, zoom
- **Display Duration:** 10-60 seconds per photo (configurable)
- **Shuffle:** Random order or chronological
- **Favorites:** Star photos to appear more frequently
- **Date Range:** Show photos from specific time periods
- **People Filter:** Show photos with specific family members (if facial recognition available)

#### Display Modes
1. **Widget Mode:** Small photo frame on dashboard (1/6 screen)
2. **Screensaver Mode:** Full-screen slideshow when idle
3. **Dedicated Page:** Full-screen slideshow on demand

#### Photo Upload
- **Drag & Drop:** Directly onto dashboard (parents only)
- **Mobile Upload:** Upload from phone via QR code link
- **Sync:** Auto-sync from iCloud/OneDrive at interval

#### Privacy
- **Face Detection:** Optional blur faces for privacy
- **Location Hiding:** Strip EXIF location data
- **Date Overlays:** Optional date/location caption

---

### 10. Family Messaging Board

#### Purpose
Leave quick messages for family members (e.g., "Dad at gym, back at 9am")

#### Message Structure
```typescript
interface FamilyMessage {
  id: string;
  message: string;
  author: string;
  color: string; // Author's color
  createdAt: Date;
  expiresAt?: Date; // Auto-delete after date
  pinned: boolean;
  important: boolean; // Red flag icon
}
```

#### Features
- **Quick Post:** Tap "+" to add message
- **Voice Input:** Speech-to-text for quick messages
- **Pin Important:** Pin critical messages to top
- **Auto-Expire:** Messages auto-delete after X hours/days
- **Color Coded:** Each family member's messages in their color
- **Emojis:** Quick emoji picker
- **Templates:** Common messages ("At gym", "Running late", "Dinner ready")

#### Message Board Display
```
┌─ FAMILY MESSAGES ──────────────────────┐
│ 📌 Emma: Swim practice canceled    │
│    (pinned by Jordan • 2 hours ago)       │
│                                        │
│ Alex: At gym, back at 9am 💪           │
│    (8:15 AM)                           │
│                                        │
│ Jordan: Picked up dry cleaning ✓          │
│    (Yesterday 4:30 PM)                 │
│                                        │
│ Sophie: Can I have a playdate Friday?    │
│    (Yesterday 3:00 PM)                 │
└────────────────────────────────────────┘
```

#### Message Management
- **Parents:** Can delete any message
- **Children:** Can only delete their own messages
- **Auto-Delete:** Messages older than 7 days (configurable)
- **Archive:** Option to archive old messages

---

### 11. Birthday Reminders

#### Data Sources
- **Calendar Events:** Parse birthdays from synced calendars
- **Contacts:** Import from Google/Apple contacts (if API available)
- **Manual Entry:** Add birthdays directly

#### Display
- **Widget:** "Upcoming Birthdays" showing next 30 days
- **Countdown:** Days until birthday
- **Age Calculation:** Automatically calculate age
- **Notifications:** Reminder 1 week before, day before, day of

#### Birthday Display
```
┌─ UPCOMING BIRTHDAYS ───────────┐
│  🎂 Emma - Jan 28 (5 days) │
│     Turning 12                 │
│                                │
│  🎂 Grandma - Feb 14 (25 days) │
│     Turning 78                 │
│                                │
│  🎂 Jordan - Mar 3 (42 days)      │
│     Turning [hidden 😊]        │
└────────────────────────────────┘
```

#### Features
- **Gift Ideas:** Optional notes field for gift ideas
- **Party Planning:** Link to calendar event for party
- **Send Card Reminder:** Reminder to send card X days before
- **Recurring Yearly:** Automatically recur each year

---

### 12. Away/Travel Mode

#### Purpose
Privacy screen to hide sensitive information when away from home or when guests visit

#### Behavior
**When Enabled:**
- Hides calendar events (shows generic "Family Calendar")
- Hides task lists and chores
- Hides family messages
- Hides location map
- Hides maintenance reminders
- Shows only: Clock, Weather, Photos

#### Away Mode Display
```
┌────────────────────────────────────────┐
│                                        │
│  🏠 Family Dashboard                   │
│                                        │
│      [Photo Slideshow]                 │
│                                        │
│  ☀️ 72°F Sunny                         │
│  Tuesday, January 20, 2026             │
│  2:34 PM                               │
│                                        │
│  [Tap to unlock with PIN]              │
│                                        │
└────────────────────────────────────────┘
```

#### Activation
- **Manual Toggle:** Parent taps "Away Mode" button
- **Scheduled:** Auto-enable based on calendar (e.g., travel events)
- **Geofence:** Auto-enable when all family members leave home (future)
- **Voice:** "Alexa, enable away mode" (future)

#### Exit Away Mode
- **PIN Entry:** Parent enters PIN to disable
- **Auto-Disable:** When family returns home (geofence)
- **Scheduled:** Auto-disable at end of travel dates

---

### 13. Dark/Light Mode

#### Theme Options
- **Light Mode:** White/light gray backgrounds, dark text
- **Dark Mode:** Dark backgrounds, light text (easier on eyes at night)
- **Auto:** Switch based on time of day (light during day, dark at night)

#### Auto-Switch Settings
- **Sunrise/Sunset:** Switch at actual sunrise/sunset times
- **Custom Times:** User-defined switch times (e.g., 7am/7pm)
- **Ambient Light:** Switch based on room brightness (requires sensor - future)

#### Theme Customization
- **Color Schemes:** Pre-defined palettes for each mode
- **Contrast Options:** High contrast for accessibility
- **Font Size:** Adjustable for readability

#### Color Variables (Tailwind)
```css
/* Light Mode */
--bg-primary: #ffffff;
--bg-secondary: #f3f4f6;
--text-primary: #111827;
--text-secondary: #6b7280;

/* Dark Mode */
--bg-primary: #111827;
--bg-secondary: #1f2937;
--text-primary: #f9fafb;
--text-secondary: #9ca3af;
```

---

### 14. Seasonal Themes (12 Monthly Themes)

#### Theme Schedule
1. **January** - New Year / Winter Wonderland
   - Colors: Blues, whites, silver
   - Icons: Snowflakes, champagne glasses
   - Backgrounds: Snow scenes, fireworks
   
2. **February** - Valentine's Day
   - Colors: Pinks, reds, purples
   - Icons: Hearts, roses, cupid
   - Backgrounds: Heart patterns, romantic scenes
   
3. **March** - St. Patrick's Day / Spring Awakening
   - Colors: Greens, golds, pastels
   - Icons: Clovers, rainbows, flowers blooming
   - Backgrounds: Irish landscapes, spring gardens
   
4. **April** - Easter / Spring Blooms
   - Colors: Pastels (pink, yellow, blue, green)
   - Icons: Easter eggs, bunnies, flowers
   - Backgrounds: Spring meadows, gardens
   
5. **May** - Spring / Mother's Day
   - Colors: Florals, bright colors
   - Icons: Flowers, butterflies, hearts
   - Backgrounds: Flower gardens, nature
   
6. **June** - Summer / Father's Day
   - Colors: Blues, yellows, greens
   - Icons: Sun, beach, BBQ, ties
   - Backgrounds: Beach scenes, outdoor activities
   
7. **July** - Independence Day / Summer
   - Colors: Red, white, blue
   - Icons: Flags, fireworks, stars
   - Backgrounds: Patriotic themes, summer fun
   
8. **August** - Back to School
   - Colors: Yellows, reds, blues
   - Icons: School bus, pencils, apples, backpacks
   - Backgrounds: School themes, autumn preview
   
9. **September** - Fall / Autumn Harvest
   - Colors: Oranges, browns, yellows, reds
   - Icons: Falling leaves, pumpkins, scarecrows
   - Backgrounds: Autumn foliage, harvest scenes
   
10. **October** - Halloween
    - Colors: Orange, black, purple
    - Icons: Pumpkins, ghosts, bats, witches
    - Backgrounds: Spooky scenes, jack-o-lanterns
    
11. **November** - Thanksgiving
    - Colors: Warm oranges, browns, golds
    - Icons: Turkeys, cornucopia, autumn leaves
    - Backgrounds: Harvest tables, family gatherings
    
12. **December** - Christmas / Winter Holidays
    - Colors: Red, green, gold, silver
    - Icons: Snowflakes, trees, ornaments, presents
    - Backgrounds: Winter scenes, holiday lights

#### Theme Controls
- **Auto-Switch:** Changes on 1st of each month (default)
- **Manual Override:** Select any theme manually
- **Theme Intensity:** Subtle (colors only) or Full (colors + icons + backgrounds)
- **Disable Themes:** Option for minimal/clean look year-round
- **Custom Themes:** Users can upload custom theme assets (future)

#### Theme Assets
```
themes/
├── january/
│   ├── background.jpg
│   ├── colors.css
│   └── icons/
├── february/
│   ├── background.jpg
│   ├── colors.css
│   └── icons/
└── ...
```

---

### 15. Customizable Layouts

#### Pre-built Templates

**1. Family Central** (Default)
- Large calendar (center)
- Tasks (right sidebar)
- Weather + Clock (top)
- Messages (bottom)
- Photos (bottom right)

**2. Task Master**
- Large tasks/chores (center)
- Small calendar (left sidebar)
- Weather + Clock (top)
- Shopping list (right)

**3. Photo Frame**
- Large photo slideshow (center, 70% of screen)
- Minimal info strip (bottom 30%): Clock, Weather, Today's events

**4. Command Center**
- Grid layout with all widgets visible
- Smaller widgets (2x3 or 3x3 grid)
- Calendar, Tasks, Chores, Weather, Photos, Messages all shown

**5. Clean & Simple**
- Large clock (center)
- Weather (top right)
- Today's agenda (bottom)
- Minimal widgets, lots of whitespace

#### Widget System
```typescript
interface Widget {
  id: string;
  type: 'calendar' | 'tasks' | 'chores' | 'weather' | 'clock' | 'photos' | 'messages' | 'shopping' | 'meals' | 'birthdays' | 'solar' | 'music';
  size: 'small' | 'medium' | 'large';
  position: { x: number; y: number; width: number; height: number };
  visible: boolean;
  settings: WidgetSettings;
}

interface WidgetSettings {
  refreshInterval?: number;
  dataSource?: string;
  customColor?: string;
  // Widget-specific settings
}
```

#### Drag & Drop Customization
- **Parent Mode:** Enter edit mode to customize layout
- **Drag Widgets:** Click and drag to reposition
- **Resize:** Drag corners to resize widgets
- **Add/Remove:** Toggle widget visibility
- **Grid Snap:** Widgets snap to grid for clean alignment
- **Save Layout:** Save custom layouts with names
- **Per-Display:** Different layouts for different displays
- **Reset:** Return to default template

#### Layout Editor
```
┌─ Layout Editor (Parent Mode) ──────────────┐
│  [Save] [Cancel] [Reset to Default]        │
│  ┌──────────┬──────────┬──────────┐        │
│  │ Calendar │ Weather  │  Tasks   │ ← Drag │
│  │ (Large)  │ (Small)  │ (Medium) │        │
│  ├──────────┴──────────┼──────────┤        │
│  │ Photos (Medium)     │ Messages │        │
│  │                     │ (Small)  │        │
│  └─────────────────────┴──────────┘        │
│                                            │
│  Available Widgets:                        │
│  [+Clock] [+Chores] [+Shopping] [+Meals]  │
└────────────────────────────────────────────┘
```

---

### 16. Solar Panel Monitoring

#### Data Source
- **Enphase Enlighten API** (official API)
- **Authentication:** OAuth 2.0 or API key
- **Rate Limits:** 10,000 calls/day (free tier)

#### Metrics Displayed
- **Current Production:** Real-time watts (W) or kilowatts (kW)
- **Today's Production:** Total kWh produced today
- **This Week:** Total kWh for current week
- **This Month:** Total kWh for current month
- **All-Time:** Lifetime production (optional)
- **System Status:** Online, offline, or issues
- **Panel Performance:** Individual panel output (if available)

#### Time Periods
- **Real-time:** Updated every 5-15 minutes
- **Hourly:** Production by hour (today)
- **Daily:** Production by day (last 7 days, last 30 days)
- **Monthly:** Production by month (last 12 months)
- **Yearly:** Annual production comparison

#### Solar Widget Display
```
┌─ SOLAR PRODUCTION ─────────────┐
│  🔆 Currently Producing        │
│     3.2 kW                     │
│                                │
│  Today: 18.5 kWh ▲ 12%        │
│  This Week: 142 kWh           │
│  This Month: 580 kWh          │
│  YTD: 4,250 kWh ▲ 8%          │
│                                │
│  [View Details] [View Graph]   │
└────────────────────────────────┘
```

#### Solar Details Page
- **Production Graph:** Line chart showing production over time
- **Weather Correlation:** Overlay weather on production graph
- **Efficiency:** Compare to expected production
- **Savings:** Calculate $ saved based on utility rate
- **Environmental Impact:** 
  - CO2 offset (yearly and YTD)
  - Trees equivalent
  - Miles driven equivalent
- **YTD Metrics:**
  - Total kWh produced year-to-date
  - Comparison to last year (if available)
  - Monthly breakdown graph
  - Best production day this year

#### Configuration
- **System Size:** Total panel capacity (kW)
- **Utility Rate:** $/kWh for savings calculation
- **Expected Production:** Monthly averages for comparison
- **Alerts:** Notification if production drops unexpectedly

---

### 17. Sonos/Music Control

#### Data Source
- **Sonos API** (official Sonos Control API)
- **Authentication:** OAuth 2.0
- **Alternative:** Local network discovery (node-sonos library)

#### Features
- **Now Playing:** Show what's playing on each Sonos speaker/group
- **Playback Controls:** Play, pause, skip, volume
- **Multi-Room:** Control multiple speakers/rooms
- **Grouping:** View and modify speaker groups
- **Source Info:** Album art, artist, song title, source (Spotify, Apple Music, etc.)

#### Music Widget Display
```
┌─ NOW PLAYING ──────────────────────┐
│  Living Room                       │
│  ♫ "Bohemian Rhapsody" - Queen    │
│  🎵 Greatest Hits                  │
│  [⏮] [⏸] [⏭]  🔊 ━━━━●─── 65%   │
│                                    │
│  Kitchen (Grouped with Living)     │
│  ♫ Same as Living Room            │
│  🔊 ━━━━━●─ 72%                   │
│                                    │
│  Bedroom                           │
│  🔇 Not Playing                    │
└────────────────────────────────────┘
```

#### Music Control Page (Dedicated)
- **Room Selection:** Tap room to expand controls
- **Playback Control:** Play, pause, skip, previous
- **Volume Control:** Per-room volume sliders
- **Speaker Grouping:** Group/ungroup speakers
- **Favorites:** Quick access to favorite playlists/stations
- **Browse:** Browse music sources (if API supports)

#### Integration Notes
- **Apple Music Control:** Via Sonos (if playing through Sonos)
- **Direct Apple Music API:** May require separate integration (future)
- **Spotify:** Also controlled via Sonos
- **Local Music:** If stored on Sonos library

### 21. Babysitter Info Screen (V1.0)

#### Purpose
Quick reference screen for babysitters with essential family information

#### Information Displayed

**Emergency Contacts:**
- Parents' cell phones (click to call on mobile)
- Backup contacts (grandparents, neighbors)
- Pediatrician name and number
- Nearest hospital/urgent care
- Poison control
- Address for emergency services

**House Information:**
- WiFi network and password
- WiFi QR code (scan to connect)
- Alarm code (if applicable)
- Thermostat instructions
- Emergency shut-offs (water, gas, electric)

**Kids' Information:**
- Bedtimes (by child)
- Dietary restrictions/allergies
- Medications and dosages
- Favorite snacks/comfort items
- Bedtime routines
- Screen time rules

**House Rules:**
- TV/tablet time limits
- Approved snacks
- Approved activities
- Outdoor play rules
- Visitor policies

**Important Locations:**
- First aid kit
- Flashlights
- Fire extinguisher
- Snacks
- Kids' rooms
- Bathroom supplies

**Pet Care (if applicable):**
- Feeding times and amounts
- Walking schedule
- Behavioral notes
- Vet contact

#### Babysitter Screen Design
```
┌─ BABYSITTER INFO ──────────────────────────┐
│  🚨 EMERGENCY: 911                         │
│                                            │
│  📱 Parents                                │
│  Alex: (555) 555-0101 [Call]              │
│  Jordan: (555) 555-0102 [Call]               │
│  We'll be back by: 10:00 PM               │
│                                            │
│  🏥 Pediatrician                           │
│  Dr. Smith: (555) 555-0200                │
│                                            │
│  📶 WiFi                                   │
│  Network: SmithFamily5G                   │
│  Password: ••••••••• [Show] [QR Code]    │
│                                            │
│  😴 Bedtimes                               │
│  Emma: 8:30 PM                        │
│  Sophie: 8:00 PM                            │
│                                            │
│  [View Full Info] [Emergency Details]     │
└────────────────────────────────────────────┘
```

#### Access Control
- **Quick Access:** Dedicated button on main screen or "Babysitter Mode"
- **No Authentication Required:** Should be accessible without PIN
- **Optional PIN:** Parents can optionally require PIN for sensitive info
- **Printable:** Export to PDF for paper backup

#### Babysitter Mode
- **Simplified View:** Only shows relevant widgets
- **Hides:** Family messages, financial info, location tracking
- **Shows:** Clock, weather, babysitter info, emergency contacts
- **Easy Exit:** Parents can disable with PIN

---

### 22. Delightful Animations (V1.0)

#### Animation Philosophy
- **Purposeful, not decorative:** Animations should enhance UX, not distract
- **Occasional, not constant:** Special moments only (theme changes, achievements)
- **Performant:** 60fps, GPU-accelerated, CSS-based where possible
- **Toggleable:** Can be disabled in settings for minimal/clean aesthetic

#### Monthly Theme Change Animations

**January (New Year):**
- Confetti burst and fireworks
- "Happy New Year!" message fades in

**February (Valentine's):**
- Floating hearts animation
- Pink/red color transition

**March (St. Patrick's):**
- Rainbow slides across screen
- Clovers float up from bottom

**April (Easter/Spring):**
- Flowers bloom in corners
- Butterfly flutters across

**May (Spring/Mother's Day):**
- Flower petals fall gently
- Soft color bloom effect

**June (Summer):**
- Sun rays animation
- Beach ball bounces across

**July (Independence Day):**
- Fireworks burst
- Stars and stripes wave

**August (Back to School):**
- School bus drives across screen
- Pencils and apples bounce in

**September (Fall):** 🍂
- **Animated tree** in corner with leaves falling
- Leaves drift and tumble realistically
- Tree gradually changes from green to autumn colors
- Wind gusts make leaves fall in waves
- Leaves pile up at bottom briefly before fading
- Duration: 8-10 seconds, plays once on theme change

**October (Halloween):**
- Bats fly across screen
- Pumpkin appears and "transforms" with jack-o-lantern face
- Ghost floats by

**November (Thanksgiving):**
- Leaves swirl and settle
- Turkey struts across bottom

**December (Christmas):**
- Snowflakes fall gently
- Twinkling lights appear on edges

#### Other Delightful Moments

**Chore Completion:**
- Confetti burst (smaller than New Year)
- "Great job!" message
- Points/star animation adding to total

**All Chores Completed:**
- Trophy appears with shine effect
- Achievement unlocked sound (optional)

**Birthday:**
- Balloon floats up when viewing birthday reminder
- Birthday cake candles flicker

**Solar Production Milestone:**
- Sun "powers up" with rays extending
- Achievement badge appears
- Example: "You've offset 1 ton of CO2!"

**First Login of Day:**
- Gentle "Good morning/afternoon/evening" fade-in
- Relevant emoji (☀️🌤️🌙)

**Achievement Unlocked:**
- Badge slides in from side
- Examples: "Week Streak!", "Shopping Champion", "Chore Master"

#### Animation Implementation
```typescript
// Example: September falling leaves
const FallingLeavesAnimation = () => {
  return (
    <motion.div
      className="fixed inset-0 pointer-events-none z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Animated tree in corner */}
      <motion.div 
        className="absolute bottom-0 left-8"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
      >
        <Tree className="autumn-colors" />
      </motion.div>
      
      {/* Individual falling leaves */}
      {leaves.map((leaf, i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{ 
            x: leaf.startX, 
            y: -20,
            rotate: 0 
          }}
          animate={{
            y: window.innerHeight + 20,
            x: leaf.endX,
            rotate: leaf.rotations,
          }}
          transition={{
            duration: leaf.duration,
            delay: leaf.delay,
            ease: "easeIn"
          }}
        >
          <Leaf color={leaf.color} />
        </motion.div>
      ))}
    </motion.div>
  );
};
```

#### Performance Considerations
- Use CSS transforms (translateX, translateY, scale, rotate) for GPU acceleration
- Limit number of animated elements (max 20-30 leaves)
- Use `will-change` CSS property sparingly
- Fade out and remove DOM elements after animation completes
- Disable animations on low-powered devices (detect via browser API)

#### Animation Settings
```typescript
interface AnimationSettings {
  enabled: boolean;
  themeChangeAnimations: boolean;
  achievementAnimations: boolean;
  reducedMotion: boolean; // Respects prefers-reduced-motion
}
```

### 18. Family Location Map (Future)

#### Data Source
- **Apple Find My** (no official API - requires iCloud auth simulation)
- **Alternatives:** Life360 API, Google Location Sharing

#### Technical Challenges
- **Unofficial API:** Apple doesn't provide Find My API
- **Solutions:** 
  - Use pyicloud library (Python)
  - Reverse engineer iCloud authentication
  - OR use Life360 as alternative (has official API)

#### Map Display
- **Map View:** Interactive map showing family member locations
- **List View:** List of locations with addresses
- **Location History:** Timeline of movements (optional, privacy-sensitive)
- **Geofencing:** Alerts when arriving/leaving locations (home, school, work)

#### Privacy Controls
- **Opt-in:** Family members must consent
- **Limited History:** Only store recent locations
- **Dashboard Only:** Not accessible remotely by default
- **Kids:** Show on dashboard but don't allow kids to see parent locations (configurable)

#### Architecture Support
```typescript
interface LocationIntegration {
  authenticate(): Promise<void>;
  getLocations(): Promise<FamilyLocation[]>;
  setGeofence(location: Location, radius: number): Promise<void>;
}

interface FamilyLocation {
  memberId: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  timestamp: Date;
  batteryLevel?: number;
}
```

---

### 19. Bus Tracking (Future)

#### Data Source
- **FirstView App** (no API - requires reverse engineering)

#### Technical Approach Options
1. **MITM Proxy:** Intercept app traffic to find API endpoints
2. **App Decompilation:** Decompile APK/IPA to find API calls
3. **Notification Parsing:** Parse push notifications (limited data)
4. **Web Scraping:** If FirstView has web portal (unlikely)

#### Implementation Strategy
1. **Research Phase:** Determine if FirstView has undocumented API
2. **Reverse Engineering:** Use tools like Charles Proxy, Burp Suite
3. **API Simulation:** Build wrapper around discovered endpoints
4. **Fallback:** If impossible, allow manual "bus is arriving" button

#### Bus Widget Display
```
┌─ EMMA'S BUS ───────────────┐
│  Bus #42 - Route to School     │
│  🚌 2.3 miles away             │
│  ⏱️ Arriving in 8 minutes      │
│                                │
│  [View on Map] [Notify Me]     │
└────────────────────────────────┘
```

#### Features
- **ETA Calculation:** Based on bus location and speed
- **Proximity Alerts:** Notification when bus is 5-10 min away
- **Route Display:** Show bus route on map
- **Delay Notifications:** Alert if bus is running late
- **Calendar Integration:** Show before school start times

#### Architecture Support
```typescript
interface BusTrackingIntegration {
  authenticate(credentials: Credentials): Promise<void>;
  getBusLocation(busId: string): Promise<BusLocation>;
  subscribeToUpdates(busId: string, callback: Function): void;
}

interface BusLocation {
  busId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  eta: number; // Minutes
  timestamp: Date;
}
```

---

### 20. Indoor Environment / Smart Home (Future)

#### Data Sources
- **Homebridge** (primary - connects to HomeKit devices)
- **Home Assistant** (alternative integration)
- **Direct Device APIs:** Ecobee, Nest, etc.

#### Homebridge Integration
- **Protocol:** HAP (HomeKit Accessory Protocol)
- **Connection:** WebSocket or HTTP API
- **Authentication:** Homebridge PIN/credentials

#### Devices to Control/Monitor
**Supported via Homebridge:**
- Lutron switches/dimmers
- TP-Link Kasa plugs/switches
- Wemo switches
- Temperature sensors
- Humidity sensors
- Motion sensors
- Door/window sensors

#### Smart Home Widget
```
┌─ SMART HOME ───────────────────┐
│  🏠 72°F  💧 45%               │
│                                │
│  Living Room                   │
│  💡 Ceiling Light    [ON] 75%  │
│  💡 Table Lamp       [OFF]     │
│                                │
│  Kitchen                       │
│  🔌 Coffee Maker     [OFF]     │
│  💡 Under Cabinet    [ON]      │
│                                │
│  [View All Rooms]              │
└────────────────────────────────┘
```

#### Smart Home Control Page
- **Room-based Organization:** Group devices by room
- **Device Controls:** 
  - Lights: On/off, brightness slider
  - Switches: On/off toggle
  - Outlets: On/off toggle
  - Sensors: Read-only status
- **Scenes:** Trigger HomeKit scenes ("Good Morning", "Movie Time")
- **Automations:** View active automations (read-only)

#### Temperature/Humidity Monitoring
- **Multiple Sensors:** Show readings from different rooms
- **Trend Graphs:** Historical data
- **Alerts:** Notification if temp/humidity outside range
- **Integration:** Display on main dashboard widget

#### Architecture Support
```typescript
interface SmartHomeIntegration {
  connect(): Promise<void>;
  getDevices(): Promise<Device[]>;
  getAccessories(room?: string): Promise<Accessory[]>;
  controlDevice(deviceId: string, command: Command): Promise<void>;
  subscribeToUpdates(callback: Function): void;
}

interface Accessory {
  id: string;
  name: string;
  type: 'light' | 'switch' | 'outlet' | 'sensor';
  room: string;
  state: boolean | number;
  brightness?: number; // For lights
  temperature?: number; // For sensors
  humidity?: number; // For sensors
}
```

---

## User Interface Design

### Application Structure & Navigation

#### Overview
Prism is a multi-page application, not just a single dashboard screen. The application consists of a main dashboard widget view plus dedicated functionality pages accessible via a persistent navigation sidebar.

#### Navigation Sidebar
- **Position:** Left vertical sidebar (persistent on desktop/tablet)
- **Visibility:** Always visible on desktop (1920x1080); collapsible on tablet; bottom nav on mobile
- **Maximum Pages:** 5 or fewer dedicated pages (plus dashboard home)
- **Visual Style:** Icons with labels, highlight for current page

#### Application Pages

| Page | Purpose | Key Features |
|------|---------|--------------|
| **Dashboard** (Home) | Widget overview of all family information | Customizable widget grid, at-a-glance view |
| **Calendar** | Full calendar management | Multi-view (day/week/2-week/month), per-user filtering |
| **Tasks/Chores** | Task and chore management | Combined or separate (TBD), assignment tracking |
| **Shopping** | Shopping list management | Multiple lists, category organization |

*Note: Additional pages may be added (up to 5 total dedicated pages) as features mature.*

#### Dashboard vs. Dedicated Pages

**Dashboard (Widget View):**
- Displays compact widgets for all features
- Quick actions via widget plus (+) buttons
- Overview/summary information
- Optimized for wall-mounted display "at a glance" view

**Dedicated Pages:**
- Full-featured interface for each capability
- **Per-user filtering/modals:** Dedicated pages will have modals and filters broken out per family member
- Detailed editing and management
- More screen real estate for complex interactions

#### Navigation Structure
```
┌─────────────────────────────────────────────────────────────────┐
│ ┌─────────┐                                                     │
│ │ 🏠 Home │  ═══════════════════════════════════════════════   │
│ │         │  │                                              │   │
│ │ 📅 Cal  │  │           MAIN CONTENT AREA                  │   │
│ │         │  │                                              │   │
│ │ ✅ Tasks│  │    Dashboard: Widget Grid                    │   │
│ │         │  │    - OR -                                    │   │
│ │ 🛒 Shop │  │    Dedicated Page: Full Feature View         │   │
│ │         │  │                                              │   │
│ │ ⚙️ Set  │  │                                              │   │
│ └─────────┘  ═══════════════════════════════════════════════   │
└─────────────────────────────────────────────────────────────────┘
```

---

### Touch Optimization

#### Touch Target Sizes
- **Minimum:** 44x44px (Apple HIG standard)
- **Recommended:** 48x48px (Material Design standard)
- **Spacing:** 8px minimum between touch targets
- **Large Buttons:** 60x60px for primary actions

#### Touch Interactions
- **Tap:** Select, activate, toggle
- **Long Press:** Context menu, edit mode (1-2 seconds)
- **Swipe:** Navigate between views, delete items
- **Pinch:** Zoom (photos, maps)
- **Drag:** Reorder items, move widgets (edit mode)

#### Visual Feedback
- **Tap Feedback:** 
  - Highlight/ripple effect on touch
  - Color change (darken 10%)
  - Scale slightly (95%)
  - Duration: 100-200ms
- **Loading States:** Spinner or skeleton screens
- **Success/Error:** Toast notifications or inline messages

#### Gesture Examples
```typescript
// Long press to edit event
onLongPress={(event) => {
  if (hasPermission) {
    openEditDialog(event);
  }
}}

// Swipe to delete task
onSwipeLeft={(task) => {
  if (canDelete) {
    confirmDelete(task);
  }
}}

// Pull to refresh calendar
onPullDown={() => {
  syncCalendars();
}}
```

---

### Accessibility

#### Visual Accessibility
- **Color Contrast:** WCAG AA minimum (4.5:1 for text)
- **High Contrast Mode:** Option for increased contrast
- **Font Sizes:** Scalable text (16px minimum, up to 24px)
- **Color Blindness:** Don't rely solely on color (use icons + text)
- **Focus Indicators:** Clear focus rings for keyboard navigation

#### Touch Accessibility
- **Large Touch Targets:** Especially for kids and elderly
- **No Small Text Links:** Minimum 16px for touch targets
- **Adequate Spacing:** Prevent accidental touches
- **Confirmation Dialogs:** For destructive actions (delete)

#### Screen Reader Support (Mobile)
- **Semantic HTML:** Use proper heading hierarchy
- **ARIA Labels:** For icon buttons and complex widgets
- **Alt Text:** For images and icons
- **Focus Management:** Logical tab order

---

### Responsive Design

#### Breakpoints
```css
/* Desktop/Touchscreen (Primary) */
@media (min-width: 1920px) { /* 1080p displays */ }
@media (min-width: 1280px) { /* HD displays */ }

/* Tablet */
@media (min-width: 768px) and (max-width: 1279px) { }

/* Mobile */
@media (max-width: 767px) { }
```

#### Layout Adjustments
**Desktop (1920x1080):**
- Multi-column grid layout
- All widgets visible (based on template)
- Sidebar navigation
- Large touch targets

**Tablet (768px - 1279px):**
- 2-column grid
- Collapsible sidebar
- Slightly smaller widgets
- Maintain touch targets

**Mobile (<768px):**
- Single column
- Bottom navigation
- Simplified widgets
- Priority content only
- Swipe between pages

---

### Animation & Transitions

#### Principles
- **Purposeful:** Animations should clarify, not distract
- **Fast:** 200-300ms for most transitions
- **Smooth:** 60fps minimum
- **Reduced Motion:** Respect prefers-reduced-motion setting

#### Animation Examples
```css
/* Widget transitions */
.widget {
  transition: all 0.2s ease-out;
}

/* Page transitions */
.page-enter {
  opacity: 0;
  transform: translateX(20px);
}
.page-enter-active {
  opacity: 1;
  transform: translateX(0);
  transition: all 0.3s ease-out;
}

/* Loading skeleton */
@keyframes shimmer {
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
}
```

#### Idle Mode Transitions
- **Fade to Screensaver:** 2-second fade when entering idle mode
- **Wake Animation:** Quick fade-in when motion detected
- **Smooth Theme Switch:** Cross-fade between light/dark mode (500ms)

---

## Data Architecture

### Database Schema

#### Core Tables

**users**
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('parent', 'child', 'guest')),
  color VARCHAR(7) NOT NULL, -- Hex color code
  pin VARCHAR(255), -- Hashed PIN
  email VARCHAR(255),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**calendar_sources**
```sql
CREATE TABLE calendar_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'google', 'apple', 'microsoft'
  source_calendar_id VARCHAR(255) NOT NULL, -- External calendar ID
  dashboard_calendar_name VARCHAR(100) NOT NULL, -- Maps to dashboard calendar
  display_name VARCHAR(100),
  color VARCHAR(7),
  enabled BOOLEAN DEFAULT true,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  last_synced TIMESTAMP,
  sync_errors JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**events**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_source_id UUID REFERENCES calendar_sources(id) ON DELETE CASCADE,
  external_event_id VARCHAR(255), -- ID from Google/Apple/etc.
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  all_day BOOLEAN DEFAULT false,
  recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- iCal RRULE format
  created_by UUID REFERENCES users(id),
  color VARCHAR(7),
  reminder_minutes INTEGER,
  last_synced TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_start_time (start_time),
  INDEX idx_calendar_source (calendar_source_id)
);
```

**tasks**
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  due_date TIMESTAMP,
  priority VARCHAR(20) CHECK (priority IN ('high', 'medium', 'low')),
  category VARCHAR(100),
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,
  completed_by UUID REFERENCES users(id),
  source VARCHAR(50) DEFAULT 'internal', -- 'internal', 'microsoft-todo', etc.
  source_id VARCHAR(255), -- External task ID
  last_synced TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_due_date (due_date)
);
```

**chores**
```sql
CREATE TABLE chores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  schedule VARCHAR(20) CHECK (schedule IN ('daily', 'weekly', 'monthly', 'custom')),
  schedule_days INTEGER[], -- [0,2,4] for Sun, Tue, Thu
  points INTEGER DEFAULT 0,
  requires_approval BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**chore_completions**
```sql
CREATE TABLE chore_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chore_id UUID REFERENCES chores(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES users(id),
  completed_at TIMESTAMP DEFAULT NOW(),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  points INTEGER,
  photo_url TEXT,
  notes TEXT
);
```

**shopping_items**
```sql
CREATE TABLE shopping_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10,2),
  unit VARCHAR(50),
  category VARCHAR(100),
  checked BOOLEAN DEFAULT false,
  source VARCHAR(50) DEFAULT 'internal',
  source_id VARCHAR(255),
  recurring BOOLEAN DEFAULT false,
  recurrence_interval VARCHAR(20), -- 'weekly', 'monthly'
  added_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**shopping_lists**
```sql
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL, -- 'Grocery', 'Hardware', etc.
  icon VARCHAR(50),
  color VARCHAR(7),
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**meals**
```sql
CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  day_of_week INTEGER, -- 0-6 (Sun-Sat), NULL if unassigned
  recipe_url TEXT,
  notes TEXT,
  cooked BOOLEAN DEFAULT false,
  cooked_at TIMESTAMP,
  week_of DATE NOT NULL, -- Week this meal is planned for
  source VARCHAR(50) DEFAULT 'internal',
  source_id VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_week_of (week_of)
);
```

**maintenance_reminders**
```sql
CREATE TABLE maintenance_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) CHECK (category IN ('car', 'home', 'appliance', 'yard', 'other')),
  description TEXT,
  schedule VARCHAR(20) CHECK (schedule IN ('monthly', 'quarterly', 'annually', 'custom')),
  custom_interval_days INTEGER,
  last_completed TIMESTAMP,
  next_due DATE NOT NULL,
  assigned_to UUID REFERENCES users(id),
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_next_due (next_due)
);
```

**maintenance_completions**
```sql
CREATE TABLE maintenance_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id UUID REFERENCES maintenance_reminders(id) ON DELETE CASCADE,
  completed_at TIMESTAMP DEFAULT NOW(),
  completed_by UUID REFERENCES users(id),
  cost DECIMAL(10,2),
  vendor VARCHAR(255),
  notes TEXT
);
```

**family_messages**
```sql
CREATE TABLE family_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message TEXT NOT NULL,
  author_id UUID REFERENCES users(id),
  pinned BOOLEAN DEFAULT false,
  important BOOLEAN DEFAULT false,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_created_at (created_at DESC)
);
```

**birthdays**
```sql
CREATE TABLE birthdays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  birth_date DATE NOT NULL,
  user_id UUID REFERENCES users(id), -- If family member
  gift_ideas TEXT,
  send_card_days_before INTEGER DEFAULT 7,
  created_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_birth_month_day (EXTRACT(MONTH FROM birth_date), EXTRACT(DAY FROM birth_date))
);
```

**settings**
```sql
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**layouts**
```sql
CREATE TABLE layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  display_id VARCHAR(100), -- For multi-display setups
  widgets JSONB NOT NULL, -- Array of widget configurations
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**api_credentials**
```sql
CREATE TABLE api_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service VARCHAR(100) UNIQUE NOT NULL, -- 'google', 'enphase', 'sonos', etc.
  encrypted_credentials TEXT NOT NULL, -- Encrypted JSON
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

### API Integrations

#### Google Calendar

**Authentication:** OAuth 2.0  
**Scopes:** `https://www.googleapis.com/auth/calendar`  
**API Docs:** https://developers.google.com/calendar

**Key Endpoints:**
```
GET /calendars/{calendarId}/events - List events
POST /calendars/{calendarId}/events - Create event
PUT /calendars/{calendarId}/events/{eventId} - Update event
DELETE /calendars/{calendarId}/events/{eventId} - Delete event
```

**Sync Strategy:**
- Initial sync: Fetch all events from past 6 months to future 12 months
- Incremental sync: Use syncToken for changes since last sync
- Frequency: Every 10 minutes
- Webhooks: Set up push notifications for real-time updates

**Implementation:**
```typescript
class GoogleCalendarIntegration {
  async authenticate(credentials: OAuth2Credentials): Promise<void>
  async syncCalendar(calendarId: string): Promise<Event[]>
  async createEvent(calendarId: string, event: Event): Promise<Event>
  async updateEvent(calendarId: string, eventId: string, event: Event): Promise<Event>
  async deleteEvent(calendarId: string, eventId: string): Promise<void>
  async subscribeToChanges(calendarId: string, webhookUrl: string): Promise<void>
}
```

---

#### Apple iCal (CalDAV)

**Protocol:** CalDAV (WebDAV extension)  
**Authentication:** Apple ID + App-Specific Password  
**Server:** `https://caldav.icloud.com`

**Key Operations:**
```xml
<!-- PROPFIND: List calendars -->
PROPFIND /12345678/calendars/
<!-- REPORT: Query events -->
REPORT /12345678/calendars/calendar-name/
<!-- PUT: Create/Update event -->
PUT /12345678/calendars/calendar-name/event-uid.ics
<!-- DELETE: Delete event -->
DELETE /12345678/calendars/calendar-name/event-uid.ics
```

**Sync Strategy:**
- Use CalDAV sync-collection REPORT
- Track ctag (calendar collection tag) for change detection
- Parse iCalendar (.ics) format
- Frequency: Every 10 minutes

**Implementation:**
```typescript
class AppleCalendarIntegration {
  async authenticate(appleId: string, appPassword: string): Promise<void>
  async listCalendars(): Promise<Calendar[]>
  async syncCalendar(calendarUrl: string): Promise<Event[]>
  async createEvent(calendarUrl: string, event: Event): Promise<void>
  async updateEvent(calendarUrl: string, eventId: string, event: Event): Promise<void>
  async deleteEvent(calendarUrl: string, eventId: string): Promise<void>
}
```

---

#### Microsoft To Do

**Authentication:** Microsoft Graph API OAuth 2.0  
**Scopes:** `Tasks.ReadWrite`  
**API Docs:** https://learn.microsoft.com/en-us/graph/api/resources/todo-overview

**Key Endpoints:**
```
GET /me/todo/lists - Get task lists
GET /me/todo/lists/{listId}/tasks - Get tasks
POST /me/todo/lists/{listId}/tasks - Create task
PATCH /me/todo/lists/{listId}/tasks/{taskId} - Update task
DELETE /me/todo/lists/{listId}/tasks/{taskId} - Delete task
```

**Sync Strategy:**
- Delta query for incremental sync
- Frequency: Every 15 minutes
- Map To Do lists to family members

**Implementation:**
```typescript
class MicrosoftToDoIntegration {
  async authenticate(credentials: OAuth2Credentials): Promise<void>
  async listTaskLists(): Promise<TaskList[]>
  async syncTasks(listId: string): Promise<Task[]>
  async createTask(listId: string, task: Task): Promise<Task>
  async updateTask(listId: string, taskId: string, task: Task): Promise<Task>
  async deleteTask(listId: string, taskId: string): Promise<void>
}
```

---

#### iCloud Photos

**Authentication:** iCloud login (unofficial)  
**Library:** `pyicloud` (Python) or `icloud-api` (Node.js)  
**Challenge:** No official API - use reverse-engineered libraries

**Approach:**
```typescript
class iCloudPhotosIntegration {
  async authenticate(appleId: string, password: string, mfa?: string): Promise<void>
  async listAlbums(): Promise<Album[]>
  async getPhotosFromAlbum(albumId: string, limit?: number): Promise<Photo[]>
  async getRecentPhotos(days: number): Promise<Photo[]>
  async downloadPhoto(photoId: string): Promise<Buffer>
}
```

**Sync Strategy:**
- Fetch album list daily
- Download new photos from selected albums
- Cache locally for slideshow
- Frequency: Every 6-12 hours

---

#### OneDrive

**Authentication:** Microsoft Graph API OAuth 2.0  
**Scopes:** `Files.Read`  
**API Docs:** https://learn.microsoft.com/en-us/graph/api/resources/onedrive

**Key Endpoints:**
```
GET /me/drive/root/children - List root items
GET /me/drive/items/{itemId}/children - List folder items
GET /me/drive/items/{itemId}/content - Download file
```

**Implementation:**
```typescript
class OneDrivePhotosIntegration {
  async authenticate(credentials: OAuth2Credentials): Promise<void>
  async listFolders(path?: string): Promise<Folder[]>
  async getPhotosFromFolder(folderId: string): Promise<Photo[]>
  async downloadPhoto(photoId: string): Promise<Buffer>
}
```

---

#### Enphase Enlighten API

**Authentication:** API Key or OAuth 2.0  
**API Docs:** https://developer-v4.enphase.com/docs  
**Rate Limits:** 10,000 requests/day (free tier)

**Key Endpoints:**
```
GET /api/v4/systems - List systems
GET /api/v4/systems/{systemId}/summary - System summary
GET /api/v4/systems/{systemId}/telemetry/production_meter - Real-time production
GET /api/v4/systems/{systemId}/energy_lifetime - Lifetime production
GET /api/v4/systems/{systemId}/stats - Daily/weekly/monthly stats
```

**Data Points:**
- Current production (W)
- Today's energy (Wh)
- Lifetime energy (Wh)
- System status
- Per-panel production (if available)

**Implementation:**
```typescript
class EnphaseIntegration {
  async authenticate(apiKey: string): Promise<void>
  async getSystemSummary(systemId: string): Promise<SystemSummary>
  async getCurrentProduction(systemId: string): Promise<ProductionData>
  async getEnergyStats(systemId: string, period: 'day'|'week'|'month'): Promise<EnergyStats>
}
```

**Sync Frequency:** Every 10-15 minutes during daylight hours

---

#### Sonos API

**Authentication:** OAuth 2.0  
**API Docs:** https://developer.sonos.com/reference/  
**Requires:** Sonos developer account approval

**Key Endpoints:**
```
GET /control/api/v1/groups - Get speaker groups
GET /control/api/v1/groups/{groupId}/playback - Get playback state
POST /control/api/v1/groups/{groupId}/playback/play - Play
POST /control/api/v1/groups/{groupId}/playback/pause - Pause
POST /control/api/v1/groups/{groupId}/groupVolume - Set volume
```

**Alternative:** Local network control via node-sonos library (no OAuth required, but limited to local network)

**Implementation:**
```typescript
class SonosIntegration {
  async authenticate(credentials: OAuth2Credentials): Promise<void>
  async discoverSpeakers(): Promise<Speaker[]>
  async getGroups(): Promise<SpeakerGroup[]>
  async getPlaybackState(groupId: string): Promise<PlaybackState>
  async play(groupId: string): Promise<void>
  async pause(groupId: string): Promise<void>
  async skip(groupId: string): Promise<void>
  async setVolume(groupId: string, volume: number): Promise<void>
  async groupSpeakers(speakerIds: string[]): Promise<void>
}
```

**Sync Frequency:** Real-time via WebSocket or polling every 5 seconds

---

#### OpenWeatherMap API

**Authentication:** API Key  
**API Docs:** https://openweathermap.org/api  
**Free Tier:** 1,000 calls/day

**Key Endpoints:**
```
GET /data/2.5/weather?q={city} - Current weather
GET /data/2.5/forecast?q={city} - 5-day forecast
```

**Implementation:**
```typescript
class WeatherIntegration {
  async getCurrentWeather(location: string): Promise<CurrentWeather>
  async getForecast(location: string, days: number): Promise<ForecastDay[]>
}
```

**Sync Frequency:** Every 30-60 minutes

---

## Project Structure

```
family-dashboard/
├── README.md
├── CONTRIBUTING.md
├── LICENSE
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
│
├── docs/
│   ├── setup-guide.md
│   ├── api-integration.md
│   ├── customization-guide.md
│   ├── troubleshooting.md
│   └── architecture.md
│
├── public/
│   ├── fonts/
│   ├── images/
│   │   └── themes/
│   │       ├── january/
│   │       ├── february/
│   │       └── ...
│   └── icons/
│
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Dashboard home
│   │   ├── api/                  # API routes
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   └── logout/route.ts
│   │   │   ├── calendar/
│   │   │   │   ├── events/route.ts
│   │   │   │   ├── sync/route.ts
│   │   │   │   └── sources/route.ts
│   │   │   ├── tasks/route.ts
│   │   │   ├── chores/route.ts
│   │   │   ├── shopping/route.ts
│   │   │   ├── meals/route.ts
│   │   │   ├── maintenance/route.ts
│   │   │   ├── messages/route.ts
│   │   │   ├── weather/route.ts
│   │   │   ├── photos/route.ts
│   │   │   ├── solar/route.ts
│   │   │   ├── music/route.ts
│   │   │   └── settings/route.ts
│   │   ├── calendar/
│   │   │   └── page.tsx          # Calendar full page
│   │   ├── tasks/
│   │   │   └── page.tsx          # Tasks full page
│   │   ├── chores/
│   │   │   └── page.tsx          # Chores full page
│   │   ├── shopping/
│   │   │   └── page.tsx          # Shopping list page
│   │   ├── meals/
│   │   │   └── page.tsx          # Meal planning page
│   │   ├── map/
│   │   │   └── page.tsx          # Family location map
│   │   ├── smarthome/
│   │   │   └── page.tsx          # Smart home controls
│   │   ├── settings/
│   │   │   └── page.tsx          # Settings page
│   │   └── away-mode/
│   │       └── page.tsx          # Away mode screen
│   │
│   ├── components/
│   │   ├── widgets/              # Dashboard widgets
│   │   │   ├── CalendarWidget.tsx
│   │   │   ├── TasksWidget.tsx
│   │   │   ├── ChoresWidget.tsx
│   │   │   ├── WeatherWidget.tsx
│   │   │   ├── ClockWidget.tsx
│   │   │   ├── PhotoWidget.tsx
│   │   │   ├── MessagesWidget.tsx
│   │   │   ├── ShoppingWidget.tsx
│   │   │   ├── MealsWidget.tsx
│   │   │   ├── BirthdaysWidget.tsx
│   │   │   ├── SolarWidget.tsx
│   │   │   ├── MusicWidget.tsx
│   │   │   └── WidgetContainer.tsx
│   │   ├── calendar/             # Calendar components
│   │   │   ├── DayView.tsx
│   │   │   ├── WeekView.tsx
│   │   │   ├── TwoWeekView.tsx
│   │   │   ├── MonthView.tsx
│   │   │   ├── EventCard.tsx
│   │   │   ├── EventDialog.tsx
│   │   │   └── CalendarToolbar.tsx
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskItem.tsx
│   │   │   └── TaskDialog.tsx
│   │   ├── chores/
│   │   │   ├── ChoreList.tsx
│   │   │   ├── ChoreCard.tsx
│   │   │   └── ChoreCompletionDialog.tsx
│   │   ├── shopping/
│   │   │   ├── ShoppingList.tsx
│   │   │   ├── ShoppingItem.tsx
│   │   │   └── CategorySection.tsx
│   │   ├── layout/
│   │   │   ├── DashboardLayout.tsx
│   │   │   ├── GridLayout.tsx
│   │   │   ├── LayoutEditor.tsx
│   │   │   └── WidgetPicker.tsx
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx
│   │   │   └── PinPad.tsx
│   │   ├── ui/                   # Reusable UI components (shadcn/ui)
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── switch.tsx
│   │   │   └── ...
│   │   └── themes/
│   │       ├── ThemeProvider.tsx
│   │       └── SeasonalTheme.tsx
│   │
│   ├── lib/                      # Utilities and helpers
│   │   ├── integrations/         # Third-party API integrations
│   │   │   ├── google-calendar.ts
│   │   │   ├── apple-calendar.ts
│   │   │   ├── microsoft-todo.ts
│   │   │   ├── icloud-photos.ts
│   │   │   ├── onedrive.ts
│   │   │   ├── enphase.ts
│   │   │   ├── sonos.ts
│   │   │   ├── weather.ts
│   │   │   └── base-integration.ts
│   │   ├── db/                   # Database utilities
│   │   │   ├── client.ts         # PostgreSQL client
│   │   │   ├── migrations/       # DB migrations
│   │   │   └── seed.ts           # Seed data
│   │   ├── auth/
│   │   │   ├── session.ts        # Session management
│   │   │   └── permissions.ts    # Permission checks
│   │   ├── utils/
│   │   │   ├── date.ts           # Date formatting/parsing
│   │   │   ├── colors.ts         # Color utilities
│   │   │   ├── validation.ts     # Input validation
│   │   │   └── encryption.ts     # Credential encryption
│   │   └── constants.ts          # App constants
│   │
│   ├── hooks/                    # React hooks
│   │   ├── useCalendar.ts
│   │   ├── useTasks.ts
│   │   ├── useChores.ts
│   │   ├── useWeather.ts
│   │   ├── useAuth.ts
│   │   ├── useTheme.ts
│   │   └── useIdleDetection.ts
│   │
│   ├── types/                    # TypeScript types
│   │   ├── calendar.ts
│   │   ├── tasks.ts
│   │   ├── chores.ts
│   │   ├── shopping.ts
│   │   ├── user.ts
│   │   ├── widget.ts
│   │   └── integration.ts
│   │
│   ├── styles/                   # Global styles
│   │   ├── globals.css
│   │   └── themes/
│   │       ├── light.css
│   │       ├── dark.css
│   │       └── seasonal/
│   │           ├── january.css
│   │           ├── february.css
│   │           └── ...
│   │
│   └── middleware.ts             # Next.js middleware (auth, etc.)
│
└── tests/
    ├── unit/
    ├── integration/
    └── e2e/
```

---

## Configuration System

### Environment Variables (.env)

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/family_dashboard
REDIS_URL=redis://localhost:6379

# App Settings
NODE_ENV=production
PORT=3000
APP_URL=http://localhost:3000

# Authentication
SESSION_SECRET=your-super-secret-session-key
PIN_ENCRYPTION_KEY=your-pin-encryption-key

# Google Calendar
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Apple iCloud
APPLE_ID=your-apple-id
APPLE_APP_PASSWORD=your-app-specific-password

# Microsoft (To Do, OneDrive)
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback

# Weather
OPENWEATHER_API_KEY=your-openweather-api-key
WEATHER_LOCATION=Springfield,IL,US

# Enphase Solar
ENPHASE_API_KEY=your-enphase-api-key
ENPHASE_SYSTEM_ID=your-system-id

# Sonos
SONOS_CLIENT_ID=your-sonos-client-id
SONOS_CLIENT_SECRET=your-sonos-client-secret
SONOS_REDIRECT_URI=http://localhost:3000/api/auth/sonos/callback

# Optional: Future integrations
# HOMEBRIDGE_URL=http://homebridge-host:port
# HOMEBRIDGE_PIN=xxx-xx-xxx
# FIRSTVIEW_USERNAME=
# FIRSTVIEW_PASSWORD=
```

### User Configuration (config/user-settings.json)

```json
{
  "family": {
    "name": "The Demo Family",
    "members": [
      {
        "id": "alex",
        "name": "Alex",
        "role": "parent",
        "color": "#3B82F6",
        "avatar": "/avatars/alex.jpg"
      },
      {
        "id": "jordan",
        "name": "Jordan",
        "role": "parent",
        "color": "#EC4899",
        "avatar": "/avatars/jordan.jpg"
      },
      {
        "id": "emma",
        "name": "Emma",
        "role": "child",
        "color": "#10B981",
        "avatar": "/avatars/emma.jpg"
      },
      {
        "id": "sophie",
        "name": "Sophie",
        "role": "child",
        "color": "#F59E0B",
        "avatar": "/avatars/sophie.jpg"
      }
    ]
  },
  "display": {
    "defaultView": "twoWeek",
    "theme": "auto",
    "seasonalThemes": true,
    "idleTimeout": 120,
    "idleMode": "photos",
    "darkModeSchedule": {
      "enabled": true,
      "mode": "sunset",
      "customTimes": {
        "darkModeStart": "19:00",
        "lightModeStart": "07:00"
      }
    }
  },
  "integrations": {
    "googleCalendar": true,
    "appleCalendar": true,
    "microsoftToDo": true,
    "appleNotes": false,
    "icloudPhotos": true,
    "onedrive": true,
    "enphase": true,
    "sonos": true,
    "homebridge": false
  },
  "notifications": {
    "eventReminders": true,
    "choreReminders": true,
    "maintenanceReminders": true,
    "weatherAlerts": true,
    "soundEnabled": false
  },
  "privacy": {
    "showLocationMap": true,
    "locationHistoryDays": 7,
    "photoFaceBlur": false,
    "hideCalendarInAwayMode": true
  }
}
```

---

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

---

## Development Workflow

### Setup Instructions (docs/setup-guide.md)

**For Non-Developers:**

1. **Install Docker Desktop**
   - Download from: https://www.docker.com/products/docker-desktop
   - Install and start Docker Desktop
   - Verify: Open terminal/command prompt, run `docker --version`

2. **Download Family Dashboard**
   - Download ZIP from GitHub
   - Extract to a folder (e.g., `C:\FamilyDashboard`)

3. **Configure Settings**
   - Copy `.env.example` to `.env`
   - Edit `.env` with your API keys (instructions in file)
   - Edit `config/user-settings.json` with your family info

4. **Start Dashboard**
   - Open terminal in dashboard folder
   - Run: `docker-compose up -d`
   - Open browser: http://localhost:3000

5. **First-Time Setup Wizard**
   - Follow on-screen instructions to:
     - Create parent accounts
     - Connect calendars
     - Select photo sources
     - Choose default layout

**For Developers:**

```bash
# Clone repository
git clone https://github.com/yourusername/family-dashboard.git
cd family-dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Set up database
npm run db:setup
npm run db:migrate
npm run db:seed

# Start development server
npm run dev

# Open http://localhost:3000
```

### Docker Deployment

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: family-dashboard
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://familydash:${DB_PASSWORD}@db:5432/familydashboard
      - REDIS_URL=redis://redis:6379
    env_file:
      - .env
    volumes:
      - ./config:/app/config
      - ./uploads:/app/uploads
      - photos-cache:/app/cache/photos
    depends_on:
      - db
      - redis
    restart: unless-stopped
    networks:
      - family-dashboard-network

  db:
    image: postgres:15-alpine
    container_name: family-dashboard-db
    environment:
      - POSTGRES_DB=familydashboard
      - POSTGRES_USER=familydash
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - family-dashboard-network

  redis:
    image: redis:7-alpine
    container_name: family-dashboard-redis
    volumes:
      - redis-data:/data
    restart: unless-stopped
    networks:
      - family-dashboard-network

volumes:
  postgres-data:
  redis-data:
  photos-cache:

networks:
  family-dashboard-network:
    driver: bridge
```

**Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Build Next.js app
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy built app
COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Expose port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
```

---

## Non-Functional Requirements

### Performance Requirements
- **Page Load Time:** < 2 seconds on gigabit connection
- **Time to Interactive:** < 3 seconds
- **Widget Update:** < 500ms for local data, < 2s for API calls
- **Animation Frame Rate:** 60fps minimum
- **Database Query Time:** < 100ms for common queries
- **API Response Time:** < 1s for sync operations

### Scalability Requirements
- Support up to 10 family members
- Handle 1,000+ calendar events
- Store 500+ photos in slideshow cache
- Support 5+ concurrent displays (multi-room)
- Database: Handle 100,000+ records without performance degradation

### Reliability Requirements
- **Uptime:** 99.9% (excluding maintenance windows)
- **Data Backup:** Automated daily backups
- **Sync Reliability:** Retry failed syncs up to 3 times
- **Offline Mode:** Display cached data when network unavailable
- **Error Recovery:** Graceful degradation when services unavailable

### Security Requirements
- **Authentication:** Secure PIN/password with bcrypt (cost 12)
- **API Credentials:** Encrypted at rest (AES-256)
- **HTTPS:** Required for remote access
- **Session Security:** httpOnly, secure cookies
- **Rate Limiting:** Prevent brute force attacks (5 attempts per minute)
- **Input Validation:** Server-side validation for all inputs
- **XSS Protection:** Sanitize all user-generated content
- **CSRF Protection:** CSRF tokens on all forms

### Usability Requirements
- **Touch Targets:** Minimum 44x44px
- **Contrast Ratio:** WCAG AA (4.5:1 minimum)
- **Font Size:** Minimum 16px, scalable to 24px
- **Navigation:** Max 3 taps to reach any feature
- **Feedback:** Visual confirmation within 100ms of touch
- **Error Messages:** Clear, actionable error messages
- **Help:** Contextual help available on all screens

### Maintainability Requirements
- **Code Documentation:** JSDoc comments on all functions
- **Inline Comments:** Explain complex logic for non-coders
- **Type Safety:** TypeScript strict mode
- **Code Style:** ESLint + Prettier configuration
- **Git Commit Messages:** Conventional commits format
- **Version Control:** Semantic versioning (major.minor.patch)
- **Changelog:** Maintained for each release

### Compatibility Requirements
- **Browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Node.js:** v20.x LTS
- **Docker:** v24.x+
- **PostgreSQL:** v15.x+
- **Operating System:** Docker host (Windows, macOS, Linux)

### Deployment Requirements
- **One-Command Deploy:** `docker-compose up -d`
- **Environment Variables:** Clear .env.example template
- **Database Migrations:** Automated on container start
- **Health Checks:** Docker health check endpoint
- **Logs:** Structured logging (JSON format)
- **Monitoring:** Basic metrics endpoint (optional Prometheus)

### Internationalization (Future)
- **Phase 2:** US English only
- **Phase 3+:** Support for multiple languages (i18n)
- **Date/Time:** Respect locale settings
- **Units:** Support metric/imperial (configurable)

---

## Easy Deployment Guide for Non-Coders

### Prerequisites Setup

#### 1. Install Docker Desktop
**What it is:** Software that runs the dashboard in a container (like a mini computer)

**Windows:**
1. Go to: https://www.docker.com/products/docker-desktop
2. Click "Download for Windows"
3. Run installer (requires restart)
4. Open Docker Desktop, accept terms
5. Wait for "Docker Desktop is running" message

**Mac:**
1. Go to: https://www.docker.com/products/docker-desktop
2. Click "Download for Mac"
3. Open .dmg file, drag Docker to Applications
4. Open Docker from Applications
5. Wait for "Docker Desktop is running" message

**Verify Installation:**
1. Open Terminal (Mac) or Command Prompt (Windows)
2. Type: `docker --version`
3. Should see: "Docker version 24.x.x"

---

#### 2. Get API Keys & Accounts

**Google Calendar** (Required for calendar sync)
1. Go to: https://console.cloud.google.com
2. Create new project: "Home Dashboard"
3. Enable "Google Calendar API"
4. Create credentials → OAuth 2.0 Client ID
5. Application type: "Web application"
6. Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
7. Copy Client ID and Client Secret
8. Save for later

**Microsoft Account** (Required for To Do, OneDrive)
1. Go to: https://portal.azure.com
2. Register new application: "Home Dashboard"
3. Platform: "Web", Redirect URI: `http://localhost:3000/api/auth/microsoft/callback`
4. API Permissions: Add "Tasks.ReadWrite", "Files.Read"
5. Certificates & Secrets → New client secret
6. Copy Application (client) ID and client secret
7. Save for later

**OpenWeatherMap** (Required for weather)
1. Go to: https://openweathermap.org/api
2. Sign up for free account
3. API Keys → Copy your API key
4. Save for later

**Enphase Enlighten** (Optional, for solar monitoring)
1. Go to: https://developer-v4.enphase.com
2. Register for API access
3. Create application
4. Copy API key
5. Find your System ID in Enlighten app
6. Save for later

**Sonos** (Optional, for music control)
1. Go to: https://developer.sonos.com
2. Apply for developer access (may take 1-2 days)
3. Create integration
4. Copy Client ID and Client Secret
5. Authorized redirect URI: `http://localhost:3000/api/auth/sonos/callback`
6. Save for later

**Apple ID App-Specific Password** (Required for iCloud/iCal)
1. Go to: https://appleid.apple.com
2. Sign in
3. Security → App-Specific Passwords → Generate Password
4. Name it: "Home Dashboard"
5. Copy generated password (not your regular password)
6. Save for later

---

### Installation Steps (Copy & Paste)

#### Step 1: Download Dashboard
```bash
# Open Terminal (Mac) or Command Prompt (Windows)
# Copy and paste each line, press Enter after each

# Create folder for dashboard
mkdir Prism
cd Prism

# Download Prism code
# You'll get this link from the GitHub repository
git clone https://github.com/[username]/prism.git .
```

#### Step 2: Configure Settings
1. Find file named `.env.example`
2. Rename it to `.env` (remove ".example")
3. Open `.env` in Notepad (Windows) or TextEdit (Mac)
4. Fill in your API keys from above:

```bash
# Database (leave as-is)
DATABASE_URL=postgresql://prism:secure_password_here@db:5432/prism
DB_PASSWORD=secure_password_here  # Change this!

# App Settings (leave as-is)
NODE_ENV=production
PORT=3000
APP_URL=http://localhost:3000

# Security (change these!)
SESSION_SECRET=generate_random_string_here_min_32_chars
PIN_ENCRYPTION_KEY=generate_another_random_string_32_chars

# Google Calendar (paste your values)
GOOGLE_CLIENT_ID=your-google-client-id-here
GOOGLE_CLIENT_SECRET=your-google-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Apple iCloud (paste your values)
APPLE_ID=your-apple-id-email@icloud.com
APPLE_APP_PASSWORD=your-app-specific-password-here

# Microsoft (paste your values)
MICROSOFT_CLIENT_ID=your-microsoft-client-id-here
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret-here
MICROSOFT_REDIRECT_URI=http://localhost:3000/api/auth/microsoft/callback

# Weather (paste your value)
OPENWEATHER_API_KEY=your-openweather-api-key-here
WEATHER_LOCATION=Springfield,IL,US  # Change to your city

# Solar (optional - leave blank if you don't have solar)
ENPHASE_API_KEY=your-enphase-api-key-or-leave-blank
ENPHASE_SYSTEM_ID=your-system-id-or-leave-blank

# Sonos (optional - leave blank if you don't have Sonos)
SONOS_CLIENT_ID=your-sonos-client-id-or-leave-blank
SONOS_CLIENT_SECRET=your-sonos-client-secret-or-leave-blank
SONOS_REDIRECT_URI=http://localhost:3000/api/auth/sonos/callback
```

5. Save file

**Generate Random Strings:**
- Go to: https://www.random.org/strings/
- Length: 32 characters
- Generate 2 strings (one for SESSION_SECRET, one for PIN_ENCRYPTION_KEY)
- Copy and paste into `.env`

#### Step 3: Configure Family Settings
1. Find file: `config/user-settings.json`
2. Open in Notepad/TextEdit
3. Change family member names and colors:

```json
{
  "family": {
    "name": "The Demo Family",  // Change to your family name
    "members": [
      {
        "id": "parent1",
        "name": "Alex",           // Change to parent 1 name
        "role": "parent",
        "color": "#3B82F6"        // Blue - change if desired
      },
      {
        "id": "parent2",
        "name": "Jordan",            // Change to parent 2 name
        "role": "parent",
        "color": "#EC4899"        // Pink - change if desired
      },
      {
        "id": "child1",
        "name": "Emma",       // Change to child 1 name
        "role": "child",
        "color": "#10B981"        // Green - change if desired
      },
      {
        "id": "child2",
        "name": "Sophie",           // Change to child 2 name
        "role": "child",
        "color": "#F59E0B"        // Orange - change if desired
      }
    ]
  }
}
```

4. Save file

#### Step 4: Start Dashboard
```bash
# In Terminal/Command Prompt, run:
docker-compose up -d

# Wait 1-2 minutes for everything to start
# You'll see: "Container prism started"
```

#### Step 5: Open Dashboard
1. Open web browser (Chrome recommended)
2. Go to: http://localhost:3000
3. Follow setup wizard

---

### Setup Wizard (First Time)

When you first open the dashboard, you'll see a setup wizard:

**Screen 1: Welcome**
- Click "Get Started"

**Screen 2: Create Parent Accounts**
- Enter PIN for each parent (4-6 digits)
- Confirm PINs
- Click "Next"

**Screen 3: Connect Calendars**
- Click "Connect Google Calendar"
- Sign in with Google
- Allow permissions
- Select which calendars to sync
- Click "Connect Apple Calendar" (if using)
- Enter Apple ID and app-specific password
- Select calendars
- Click "Next"

**Screen 4: Configure Integrations**
- Toggle on/off optional integrations:
  - Microsoft To Do
  - iCloud Photos
  - OneDrive
  - Solar Monitoring
  - Music Control
- Click "Connect" for each enabled integration
- Follow prompts to authenticate
- Click "Next"

**Screen 5: Choose Layout**
- Select a template:
  - Family Central (recommended)
  - Task Master
  - Photo Frame
  - Command Center
  - Clean & Simple
- Click "Next"

**Screen 6: Done!**
- Click "Go to Dashboard"
- You're ready!

### Unit Tests
- Test utility functions
- Test API integration classes
- Test data transformations
- Test validation logic

### Integration Tests
- Test API endpoints
- Test database operations
- Test calendar sync
- Test task sync

### E2E Tests (Playwright)
- Test user flows (add event, complete chore, etc.)
- Test authentication
- Test widget interactions
- Test layout customization

### Example Test
```typescript
// tests/unit/date.test.ts
import { formatEventDate, isEventToday } from '@/lib/utils/date';

describe('Date Utilities', () => {
  test('formatEventDate displays time for today events', () => {
    const today = new Date();
    today.setHours(14, 30);
    
    expect(formatEventDate(today)).toBe('2:30 PM');
  });
  
  test('isEventToday returns true for today', () => {
    const today = new Date();
    expect(isEventToday(today)).toBe(true);
  });
});
```

---

## Security Considerations

### API Credentials
- **Never commit credentials to Git**
- Store in environment variables only
- Encrypt sensitive data in database
- Use separate credentials for development/production

### Authentication
- Hash PINs with bcrypt (cost factor 12)
- Use secure session tokens (httpOnly cookies)
- Implement rate limiting on login
- Auto-logout after inactivity

### Data Privacy
- Location data: Store minimal history (7 days default)
- Photos: Option to blur faces
- Calendar: Hide sensitive events in Away Mode
- Local-first: Personal data stays on local server

### Network Security
- HTTPS only for remote access (use reverse proxy)
- Option for VPN-only access
- No open ports except 3000 (via reverse proxy)
- CORS restrictions for API endpoints

---

## Performance Optimization

### Caching Strategy
- **Redis Cache:**
  - Calendar events (5-minute TTL)
  - Weather data (30-minute TTL)
  - Photo metadata (1-hour TTL)
  - Solar data (10-minute TTL)

- **Browser Cache:**
  - Static assets (images, fonts): 1 year
  - Theme assets: 1 month
  - API responses: No cache (use Redis)

### Database Optimization
- Index on frequently queried fields (dates, user IDs)
- Pagination for large lists
- Lazy loading for widgets
- Cleanup old data (archive events older than 1 year)

### Frontend Optimization
- Code splitting (per route)
- Lazy load widgets not in viewport
- Image optimization (Next.js Image component)
- Minimize bundle size (tree shaking)

---

## Accessibility Features

### WCAG 2.1 AA Compliance
- Color contrast ratios 4.5:1 minimum
- Keyboard navigation support
- Focus indicators on all interactive elements
- Alt text for all images
- Semantic HTML structure

### Touch Accessibility
- 44px minimum touch targets
- Adequate spacing (8px minimum)
- No hover-only interactions
- Confirmation for destructive actions

### Screen Reader Support (Mobile)
- ARIA labels on icon buttons
- Proper heading hierarchy
- Live regions for dynamic updates
- Descriptive link text

---

## Future Enhancements (Post V1.0)

### Phase 2
- Paprika full integration
- Additional shopping list integrations
- Apple Reminders integration
- Family location map
- Companion mobile app

### Phase 3
- Bus tracking (FirstView)
- Indoor environment monitoring
- Advanced smart home controls
- Voice assistant integration
- Automation rules engine

### Community Features
- Widget marketplace
- Theme sharing
- Integration plugins
- Translation support (i18n)

---

## GitHub Repository Structure

### Repository Setup

**Repository Name:** `prism` 
**Visibility:** Public (open source)  
**License:** MIT License  
**Topics:** family-dashboard, home-automation, calendar, react, nextjs, typescript, docker, prism

### Repository Files

```
prism/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Continuous Integration
│   │   ├── docker-build.yml          # Docker image build
│   │   └── tests.yml                 # Automated tests
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── integration_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── FUNDING.yml                   # Optional: Sponsors
│
├── docs/
│   ├── README.md                     # Documentation index
│   ├── SETUP_GUIDE.md                # Detailed setup instructions
│   ├── API_INTEGRATION.md            # How to add integrations
│   ├── CUSTOMIZATION.md              # Customization guide
│   ├── TROUBLESHOOTING.md            # Common issues
│   ├── CONTRIBUTING.md               # Contribution guidelines
│   ├── ARCHITECTURE.md               # Technical architecture
│   ├── DEPLOYMENT.md                 # Deployment options
│   └── screenshots/                  # Screenshots for README
│
├── scripts/
│   ├── setup.sh                      # Automated setup script
│   ├── generate-secrets.sh           # Generate random secrets
│   ├── backup.sh                     # Backup script
│   └── restore.sh                    # Restore from backup
│
├── .env.example                      # Environment variables template
├── .gitignore
├── .dockerignore
├── README.md                         # Main README (see below)
├── LICENSE
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
├── docker-compose.yml
├── docker-compose.dev.yml            # Development override
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── [rest of project files...]
```

---

### Main README.md

````markdown
# Prism 🏠

> Your family's digital home

Prism is an open-source family dashboard that brings everyone together. Sync calendars, manage chores, plan meals, track tasks, and stay connected—all on one beautiful touchscreen display.

**Prism** (noun): Your circle of friends, neighbors, and acquaintances. In "prism and kin," it represents both family and community coming together.

![Prism Dashboard](docs/screenshots/main-dashboard.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)

## ✨ Features

### 📅 Smart Calendar Management
- Sync multiple Google Calendar & Apple iCal calendars
- Map multiple calendars to one dashboard view (e.g., "Family Calendar")
- Color-coded by person
- Day, week, two-week, and month views
- Touch-optimized for kids and adults

### ✅ Task & Chore Tracking
- Built-in task lists + Microsoft To Do integration
- Dedicated chores system with points/allowance tracking
- Parent approval workflow
- Visual progress tracking

### 🛒 Smart Shopping Lists
- Organized by grocery store sections (Produce, Meat, Dairy, etc.)
- **Voice-to-text quick add** - just speak your list!
- Alexa integration (optional)
- QR code for mobile access in-store

### 🍽️ Meal Planning
- Simple weekly meal list
- Assign to specific days or keep flexible
- Recipe links
- Track what's been cooked

### 👨👩👧👦 Family Features
- Family messaging board ("Dad at gym, back at 9am")
- Birthday reminders with countdowns
- **Babysitter info screen** - emergency contacts, WiFi QR code, bedtimes, house rules
- Away/privacy mode when traveling

### 🌤️ Home Information
- Weather forecast (4-5 days)
- **Solar panel production monitoring** (Enphase) with YTD stats
- Indoor temperature & humidity
- What's playing on Sonos speakers

### 🎨 Beautiful Design
- **12 monthly seasonal themes** with delightful animations (falling leaves in September!)
- Dark/light mode with auto-switching
- Customizable layouts and widgets
- Photo slideshow from iCloud/OneDrive

### 🔒 Privacy-First
- All data stored locally on your server
- No cloud subscriptions required
- API credentials encrypted
- Away mode hides sensitive info

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- Google Calendar account
- 30 minutes for setup

### Installation (5 Steps)

```bash
# 1. Clone repository
git clone https://github.com/yourusername/prism.git
cd prism

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your API keys
# (See docs/SETUP_GUIDE.md for detailed instructions)

# 4. Start dashboard
docker-compose up -d

# 5. Open browser
# Go to: http://localhost:3000
```

That's it! Follow the setup wizard to connect your calendars and configure your dashboard.

**📚 Detailed Setup Guide:** [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)

## 📸 Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/calendar-view.png" alt="Calendar View"/></td>
    <td><img src="docs/screenshots/chores-page.png" alt="Chores"/></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/shopping-list.png" alt="Shopping List"/></td>
    <td><img src="docs/screenshots/dark-mode.png" alt="Dark Mode"/></td>
  </tr>
</table>

## 🎯 Use Cases

- **Wall-mounted display** in kitchen or entryway
- **Tablet** (iPad, Android) on counter
- **Mobile** quick access on-the-go
- **Multiple displays** throughout home

## 🛠️ Tech Stack

- **Frontend:** React, Next.js 14, TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL
- **Deployment:** Docker
- **Integrations:** Google Calendar, Microsoft To Do, iCloud, Enphase, Sonos

## 📖 Documentation

- [Setup Guide](docs/SETUP_GUIDE.md) - Step-by-step installation
- [Customization Guide](docs/CUSTOMIZATION.md) - Change colors, fonts, layouts
- [API Integration Guide](docs/API_INTEGRATION.md) - Add new integrations
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Architecture](docs/ARCHITECTURE.md) - Technical details

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute
- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit pull requests
- 📝 Improve documentation
- 🌍 Add translations
- 🔌 Build integrations

## 🗺️ Roadmap

### Version 1.0 (Current)
- ✅ Multi-calendar sync with flexible mapping
- ✅ Tasks & chores with parent approval
- ✅ Smart shopping lists with voice input
- ✅ Meal planning
- ✅ Solar monitoring with YTD stats
- ✅ Music control (Sonos)
- ✅ 12 seasonal themes with animations
- ✅ Babysitter info screen
- ✅ Away/privacy mode

### Version 2.0 (Planned)
- 🔜 iPad & mobile optimizations
- 🔜 Family location map (Apple Find My)
- 🔜 Bus/transit tracking
- 🔜 Smart home control (Homebridge)
- 🔜 Voice assistant integration (Alexa, Siri)
- 🔜 Companion mobile app

### Version 3.0 (Future)
- 🔮 Multi-language support
- 🔮 Widget marketplace
- 🔮 Advanced automations
- 🔮 Third-party integrations

[View full roadmap →](https://github.com/yourusername/prism/projects)

## 💬 Community

- [GitHub Discussions](https://github.com/yourusername/prism/discussions) - Q&A, ideas
- [Discord](https://discord.gg/prism) - Real-time chat (optional)
- [Issues](https://github.com/yourusername/prism/issues) - Bug reports

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for families who want to stay connected and organized

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=yourusername/prism&type=Date)](https://star-history.com/#yourusername/prism&Date)

---

**Made with ❤️ by the Prism community**
````

---

### CONTRIBUTING.md

````markdown
# Contributing to Prism

Thank you for your interest in contributing! Prism is built by families, for families.

## Ways to Contribute

### 🐛 Report Bugs
Found a bug? [Open an issue](https://github.com/yourusername/prism/issues/new?template=bug_report.md) with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Docker version, etc.)

### 💡 Suggest Features
Have an idea? [Open a feature request](https://github.com/yourusername/prism/issues/new?template=feature_request.md) with:
- Use case description
- Why it would be useful
- Mockups or examples (if applicable)

### 🔧 Submit Code
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### 📝 Improve Documentation
- Fix typos
- Clarify instructions
- Add examples
- Translate to other languages

### 🔌 Build Integrations
Want to add a new integration (e.g., Todoist, AnyList)? See [API_INTEGRATION.md](docs/API_INTEGRATION.md)

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/prism.git
cd prism

# Install dependencies
npm install

# Set up environment
cp .env.example .env.development
# Edit .env.development with test credentials

# Start development server
npm run dev

# Open http://localhost:3000
```

## Code Style

- TypeScript strict mode
- ESLint + Prettier
- Conventional commits format
- JSDoc comments on functions
- Inline comments for complex logic (especially for learning!)

Run linting: `npm run lint`
Run formatting: `npm run format`

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Pull Request Guidelines

- Keep PRs focused (one feature/fix per PR)
- Update documentation if needed
- Add tests for new features
- Ensure all tests pass
- Follow code style guidelines
- Describe changes clearly in PR description

## Code of Conduct

Be kind, respectful, and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Questions?

Ask in [GitHub Discussions](https://github.com/yourusername/prism/discussions) or [Discord](#).

Thank you for contributing! 🎉
````

---

### `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test

  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t prism:test .
      - name: Test Docker image
        run: docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                    # Continuous Integration
│   │   ├── docker-build.yml          # Docker image build
│   │   └── tests.yml                 # Automated tests
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   ├── feature_request.md
│   │   └── integration_request.md
│   ├── PULL_REQUEST_TEMPLATE.md
│   └── FUNDING.yml                   # Optional: Sponsors
│
├── docs/
│   ├── README.md                     # Documentation index
│   ├── SETUP_GUIDE.md                # Detailed setup instructions
│   ├── API_INTEGRATION.md            # How to add integrations
│   ├── CUSTOMIZATION.md              # Customization guide
│   ├── TROUBLESHOOTING.md            # Common issues
│   ├── CONTRIBUTING.md               # Contribution guidelines
│   ├── ARCHITECTURE.md               # Technical architecture
│   ├── DEPLOYMENT.md                 # Deployment options
│   └── screenshots/                  # Screenshots for README
│
├── scripts/
│   ├── setup.sh                      # Automated setup script
│   ├── generate-secrets.sh           # Generate random secrets
│   ├── backup.sh                     # Backup script
│   └── restore.sh                    # Restore from backup
│
├── .env.example                      # Environment variables template
├── .gitignore
├── .dockerignore
├── README.md                         # Main README (see below)
├── LICENSE
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
├── docker-compose.yml
├── docker-compose.dev.yml            # Development override
├── Dockerfile
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── [rest of project files...]
```

---

### Main README.md

````markdown
# HomeHive 🏠

> Your family's digital command center

HomeHive is an open-source family dashboard that combines calendars, tasks, chores, shopping lists, and more into one beautiful touchscreen display. Think of it as a digital family bulletin board that actually keeps up with modern life.

![HomeHive Dashboard](docs/screenshots/main-dashboard.png)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)](https://www.docker.com/)
[![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-black?style=flat&logo=next.js&logoColor=white)](https://nextjs.org/)

## ✨ Features

### 📅 Smart Calendar Management
- Sync multiple Google Calendar & Apple iCal calendars
- Map multiple calendars to one dashboard view (e.g., "Family Calendar")
- Color-coded by person
- Day, week, two-week, and month views
- Touch-optimized for kids and adults

### ✅ Task & Chore Tracking
- Built-in task lists + Microsoft To Do integration
- Dedicated chores system with points/allowance tracking
- Parent approval workflow
- Visual progress tracking

### 🛒 Smart Shopping Lists
- Organized by grocery store sections (Produce, Meat, Dairy, etc.)
- Voice-to-text quick add
- Alexa integration optional
- QR code for mobile access in-store

### 🍽️ Meal Planning
- Simple weekly meal list
- Assign to specific days or keep flexible
- Recipe links
- Track what's been cooked

### 👨👩👧👦 Family Features
- Family messaging board ("Dad at gym, back at 9am")
- Birthday reminders with countdowns
- Babysitter info screen (emergency contacts, WiFi, bedtimes)
- Away/privacy mode when traveling

### 🌤️ Home Information
- Weather forecast (4-5 days)
- Solar panel production monitoring (Enphase)
- Indoor temperature & humidity
- What's playing on Sonos speakers

### 🎨 Beautiful Design
- 12 monthly seasonal themes (Halloween, Christmas, etc.)
- Dark/light mode with auto-switching
- Delightful animations (falling leaves in September!)
- Customizable layouts and widgets
- Photo slideshow from iCloud/OneDrive

### 🔒 Privacy-First
- All data stored locally on your server
- No cloud subscriptions required
- API credentials encrypted
- Away mode hides sensitive info

## 🚀 Quick Start

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed
- Google Calendar account
- 30 minutes for setup

### Installation (5 Steps)

```bash
# 1. Clone repository
git clone https://github.com/[username]/homehive.git
cd homehive

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env with your API keys
# (See docs/SETUP_GUIDE.md for detailed instructions)

# 4. Start dashboard
docker-compose up -d

# 5. Open browser
# Go to: http://localhost:3000
```

That's it! Follow the setup wizard to connect your calendars and configure your dashboard.

**📚 Detailed Setup Guide:** [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md)

## 📸 Screenshots

<table>
  <tr>
    <td><img src="docs/screenshots/calendar-view.png" alt="Calendar View"/></td>
    <td><img src="docs/screenshots/chores-page.png" alt="Chores"/></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/shopping-list.png" alt="Shopping List"/></td>
    <td><img src="docs/screenshots/dark-mode.png" alt="Dark Mode"/></td>
  </tr>
</table>

## 🎯 Use Cases

- **Wall-mounted display** in kitchen or entryway
- **Tablet** (iPad, Android) on counter
- **Mobile** quick access on-the-go
- **Multiple displays** throughout home

## 🛠️ Tech Stack

- **Frontend:** React, Next.js 14, TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL
- **Deployment:** Docker
- **Integrations:** Google Calendar, Microsoft To Do, iCloud, Enphase, Sonos

## 📖 Documentation

- [Setup Guide](docs/SETUP_GUIDE.md) - Step-by-step installation
- [Customization Guide](docs/CUSTOMIZATION.md) - Change colors, fonts, layouts
- [API Integration Guide](docs/API_INTEGRATION.md) - Add new integrations
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Common issues and solutions
- [Architecture](docs/ARCHITECTURE.md) - Technical details

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Ways to Contribute
- 🐛 Report bugs
- 💡 Suggest features
- 🔧 Submit pull requests
- 📝 Improve documentation
- 🌍 Add translations
- 🔌 Build integrations

## 🗺️ Roadmap

### Version 1.0 (Current)
- ✅ Multi-calendar sync
- ✅ Tasks & chores
- ✅ Shopping lists
- ✅ Meal planning
- ✅ Solar monitoring
- ✅ Music control
- ✅ Seasonal themes
- ✅ Babysitter mode

### Version 2.0 (Planned)
- 🔜 iPad & mobile optimizations
- 🔜 Family location map
- 🔜 Bus/transit tracking
- 🔜 Smart home control
- 🔜 Voice assistant integration
- 🔜 Companion mobile app

### Version 3.0 (Future)
- 🔮 Multi-language support
- 🔮 Widget marketplace
- 🔮 Advanced automations
- 🔮 Third-party integrations

[View full roadmap →](https://github.com/[username]/homehive/projects)

## 💬 Community

- [GitHub Discussions](https://github.com/[username]/homehive/discussions) - Q&A, ideas
- [Discord](https://discord.gg/homehive) - Real-time chat (optional)
- [Issues](https://github.com/[username]/homehive/issues) - Bug reports

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for families who want to stay connected and organized

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=[username]/homehive&type=Date)](https://star-history.com/#[username]/homehive&Date)

---

**Made with ❤️ by the HomeHive community**
````

---

### CONTRIBUTING.md

````markdown
# Contributing to HomeHive

Thank you for your interest in contributing! HomeHive is built by families, for families.

## Ways to Contribute

### 🐛 Report Bugs
Found a bug? [Open an issue](https://github.com/[username]/homehive/issues/new?template=bug_report.md) with:
- Clear description
- Steps to reproduce
- Expected vs actual behavior
- Screenshots if applicable
- Your environment (OS, Docker version, etc.)

### 💡 Suggest Features
Have an idea? [Open a feature request](https://github.com/[username]/homehive/issues/new?template=feature_request.md) with:
- Use case description
- Why it would be useful
- Mockups or examples (if applicable)

### 🔧 Submit Code
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests if applicable
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### 📝 Improve Documentation
- Fix typos
- Clarify instructions
- Add examples
- Translate to other languages

### 🔌 Build Integrations
Want to add a new integration (e.g., Todoist, AnyList)? See [API_INTEGRATION.md](docs/API_INTEGRATION.md)

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/homehive.git
cd homehive

# Install dependencies
npm install

# Set up environment
cp .env.example .env.development
# Edit .env.development with test credentials

# Start development server
npm run dev

# Open http://localhost:3000
```

## Code Style

- TypeScript strict mode
- ESLint + Prettier
- Conventional commits format
- JSDoc comments on functions
- Inline comments for complex logic

Run linting: `npm run lint`
Run formatting: `npm run format`

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Pull Request Guidelines

- Keep PRs focused (one feature/fix per PR)
- Update documentation if needed
- Add tests for new features
- Ensure all tests pass
- Follow code style guidelines
- Describe changes clearly in PR description

## Code of Conduct

Be kind, respectful, and constructive. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Questions?

Ask in [GitHub Discussions](https://github.com/[username]/homehive/discussions) or [Discord](#).

Thank you for contributing! 🎉
````

---

### Issue Templates

**Bug Report Template** (`.github/ISSUE_TEMPLATE/bug_report.md`):
````markdown
---
name: Bug Report
about: Report a bug to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., Windows 11]
- Docker version: [e.g., 24.0.5]
- Browser: [e.g., Chrome 120]
- Dashboard version: [e.g., 1.0.0]

**Additional context**
Any other relevant information.
````

**Feature Request Template**:
````markdown
---
name: Feature Request
about: Suggest a new feature
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature related to a problem?**
Describe the problem.

**Describe the solution**
What you'd like to happen.

**Describe alternatives**
Other solutions you've considered.

**Use case**
Who would benefit and how?

**Additional context**
Mockups, examples, or references.
````

---

### CI/CD Workflows

**`.github/workflows/ci.yml`**:
```yaml
name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm test

  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build Docker image
        run: docker build -t homehive:test .
      - name: Test Docker image
        run: docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

---

## Repository README Enhancements

### Badges to Include
- Build status
- Test coverage
- Docker pulls
- License
- Version
- Contributors

### Sections to Add
- Demo video or GIF
- Feature comparison table (vs commercial alternatives)
- Hardware recommendations
- Performance benchmarks
- Sponsor/donation links (optional)

### User Documentation
- Setup guide (step-by-step with screenshots)
- Customization guide (colors, fonts, layouts)
- API integration guide (connecting calendars, etc.)
- Troubleshooting guide (common issues)
- FAQ

### Developer Documentation
- Architecture overview
- API documentation
- Contributing guidelines
- Code style guide
- Testing guide

### Community
- GitHub Discussions for Q&A
- Issues for bug reports
- Pull requests for contributions
- Discord/Slack for real-time help (optional)

---

## License & Open Source

**Recommended License:** MIT License

- Allows commercial use
- Allows modification and distribution
- Minimal restrictions
- Family-friendly and approachable

**Contributing:**
- Welcome contributions
- Code of conduct
- Pull request template
- Issue templates (bug, feature request)

---

## Success Metrics

### For Your Family
- ✅ Reduces calendar conflicts
- ✅ Increases chore completion rates
- ✅ Improves family communication
- ✅ Simplifies meal planning
- ✅ Centralizes home information

### For Open Source Community
- 📊 GitHub stars and forks
- 📊 Active contributors
- 📊 Community integrations/widgets
- 📊 User testimonials and showcases

---

## Summary

This family dashboard provides unique capabilities like solar monitoring, bus tracking, and smart home control. Built with TypeScript, React, and Next.js, it's:

- **Easy to use** for families (touch-optimized, beautiful UI)
- **Easy to customize** for non-coders (well-documented, configuration files)
- **Easy to extend** for developers (modular architecture, plugin system)
- **Privacy-focused** (local-first, encrypted credentials)
- **Open source** (MIT license, welcoming contributions)

**Version 1.0 delivers:**
- Multi-calendar sync with flexible mapping
- Tasks, chores, shopping, meals management
- Weather, clock, photos, birthdays
- Solar monitoring and music control
- Customizable layouts and seasonal themes
- Dark/light modes and away/privacy mode

**Future phases add:**
- Location tracking, bus tracking
- Smart home integration
- Voice assistants
- Mobile companion app

This requirements document provides everything Claude Code needs to build a production-ready family dashboard. Ready to hand off? 🚀

---

## Architectural Review & Recommendations (v19.1)

> **Review Date:** January 2026
> **Reviewed By:** Principal Engineer / Director of Architecture
> **Scope:** Complete codebase analysis, bottleneck identification, and structural improvements

---

### Executive Summary

The Prism codebase demonstrates solid foundational architecture with:
- Clean Next.js 14 App Router implementation
- Type-safe database layer using Drizzle ORM
- Proper security practices (bcrypt, parameterized queries, session management)
- Excellent inline documentation suitable for non-coders

**Current State:** ~40% of V1.0 features implemented with solid infrastructure.

**Key Findings:**
- 6 critical gaps requiring completion
- 4 architectural improvements needed
- 3 performance optimizations recommended

---

### 1. Critical Implementation Gaps

#### 1.1 Missing API Routes

The following features have database schemas but **no API routes**:

| Feature | Schema Ready | API Route | UI Component |
|---------|-------------|-----------|--------------|
| Chores | ✅ | ❌ | ❌ |
| Shopping Lists | ✅ | ❌ | ❌ |
| Meal Planning | ✅ | ❌ | ❌ |
| Maintenance | ✅ | ❌ | ❌ |
| Birthdays | ✅ | ❌ | ❌ |
| Photo Slideshow | ❌ | ❌ | ❌ |

**Priority:** These routes must be implemented before V1.0 release.

**Recommended Route Structure:**
```
/api/chores           - GET (list), POST (create)
/api/chores/[id]      - GET, PATCH, DELETE
/api/chores/[id]/complete - POST (mark complete, supports approval workflow)

/api/shopping-lists         - GET, POST
/api/shopping-lists/[id]    - GET, PATCH, DELETE
/api/shopping-items         - GET, POST
/api/shopping-items/[id]    - PATCH, DELETE

/api/meals            - GET, POST
/api/meals/[id]       - GET, PATCH, DELETE

/api/maintenance      - GET, POST
/api/maintenance/[id] - GET, PATCH, DELETE, POST /complete

/api/birthdays        - GET, POST
/api/birthdays/[id]   - GET, PATCH, DELETE
```

#### 1.2 Type Duplication

**Problem:** The `CalendarEvent` interface is defined in 3 places:
- `src/components/widgets/CalendarWidget.tsx:62`
- `src/app/calendar/CalendarView.tsx:72`
- API response inline in hooks

**Solution:** Create shared types in `src/types/calendar.ts`:
```typescript
// src/types/calendar.ts
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  color: string;
  calendarName: string;
  calendarId: string;
}

export interface CalendarEventResponse {
  // API response shape (startTime/endTime as ISO strings)
  ...
}
```

#### 1.3 Hook Dependency Bug

**File:** `src/lib/hooks/useCalendarEvents.ts:109`

**Problem:** `events.length` in useCallback dependency array can cause infinite re-renders:
```typescript
// BEFORE (problematic)
}, [daysToShow, useDemoFallback, events.length]);
```

**Solution:**
```typescript
// AFTER (fixed)
}, [daysToShow, useDemoFallback]);
```

#### 1.4 Missing Request Validation

**Problem:** API routes manually validate request bodies without schema validation.

**Solution:** Add Zod schemas for all API endpoints:
```typescript
// src/lib/validations/events.ts
import { z } from 'zod';

export const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  allDay: z.boolean().optional().default(false),
  calendarSourceId: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  // ...
});

// In route:
const result = createEventSchema.safeParse(body);
if (!result.success) {
  return NextResponse.json({ error: result.error.issues }, { status: 400 });
}
```

#### 1.5 Permission Enforcement Inconsistency

**Problem:** Permission system is defined in `src/types/user.ts` but not consistently enforced.

**Solution:** Create API middleware:
```typescript
// src/lib/middleware/withPermission.ts
export function withPermission(permission: Permission) {
  return async (request: NextRequest, handler: Handler) => {
    const session = await getSession(request);
    if (!session || !hasPermission(session.user, permission)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(request, session);
  };
}
```

#### 1.6 Testing Infrastructure Empty

**Problem:** `/tests` directory exists but contains no tests.

**Recommended Testing Strategy:**

| Type | Tool | Priority | Coverage Target |
|------|------|----------|-----------------|
| Unit | Jest | High | Utility functions, hooks |
| Integration | Jest + Supertest | High | API routes |
| E2E | Playwright | Medium | Critical user flows |

**Priority Tests:**
1. Authentication flow (PIN login, session management)
2. Calendar CRUD operations
3. Task completion workflow
4. Chore approval workflow (once implemented)

---

### 2. Architectural Improvements

#### 2.1 Centralize Demo Data

**Problem:** Demo data is defined in multiple components.

**Solution:** Create a demo data service:
```typescript
// src/lib/services/demo-data.ts
export function getDemoCalendarEvents(): CalendarEvent[] { ... }
export function getDemoTasks(): Task[] { ... }
export function getDemoMessages(): FamilyMessage[] { ... }

// Single source of truth for development/testing
```

#### 2.2 API Response Standardization

**Problem:** API responses have inconsistent structures.

**Solution:** Standardize all API responses:
```typescript
// Success response
{
  data: T,           // The actual data
  meta?: {           // Pagination info
    total: number,
    limit: number,
    offset: number
  }
}

// Error response
{
  error: string,
  code?: string,     // Machine-readable error code
  details?: object   // Validation errors, etc.
}
```

#### 2.3 Multi-Day Event Query Fix

**File:** `src/app/api/events/route.ts:112-116`

**Problem:** Current query only checks if `startTime` is within range, missing events that:
- Start before the range but end within it
- Span the entire range

**Solution:**
```typescript
// BEFORE
const conditions = [
  gte(events.startTime, startDate),
  lte(events.startTime, endDate),
];

// AFTER
import { or } from 'drizzle-orm';

const conditions = [
  or(
    // Event starts within range
    and(gte(events.startTime, startDate), lte(events.startTime, endDate)),
    // Event ends within range
    and(gte(events.endTime, startDate), lte(events.endTime, endDate)),
    // Event spans the entire range
    and(lte(events.startTime, startDate), gte(events.endTime, endDate))
  )
];
```

#### 2.4 Component Architecture Pattern

**Recommendation:** Adopt a consistent component structure:

```
components/
├── widgets/           # Dashboard widgets (self-contained)
│   ├── CalendarWidget/
│   │   ├── index.tsx           # Main export
│   │   ├── CalendarWidget.tsx  # Component logic
│   │   ├── DaySection.tsx      # Sub-components
│   │   ├── EventRow.tsx
│   │   └── types.ts            # Component-specific types
│   └── ...
├── features/          # Full-page feature components
│   ├── calendar/
│   ├── chores/
│   └── ...
├── ui/               # Primitive UI components (shadcn/ui)
└── layout/           # Layout components
```

---

### 3. Performance Optimizations

#### 3.1 Implement Redis Caching

**Status:** Redis is configured but unused.

**Recommended Cache Strategy:**

| Data Type | TTL | Cache Key Pattern |
|-----------|-----|-------------------|
| Calendar Events | 5 min | `events:{userId}:{dateRange}` |
| Weather | 30 min | `weather:{location}` |
| Family Members | 1 hour | `family:members` |
| Solar Data | 10 min | `solar:{systemId}` |

**Implementation:**
```typescript
// src/lib/cache/redis.ts
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

export async function getCached<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  return data ? JSON.parse(data) : null;
}

export async function setCache<T>(key: string, data: T, ttlSeconds: number): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
}

export async function invalidateCache(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length) await redis.del(...keys);
}
```

#### 3.2 Database Query Optimization

**Current Indexes (Good):**
- `events_start_time_idx`
- `events_calendar_source_idx`
- `tasks_assigned_to_idx`
- `tasks_due_date_idx`

**Recommended Additional Indexes:**
```sql
-- For message board queries (newest first)
CREATE INDEX family_messages_pinned_created_idx
ON family_messages (pinned DESC, created_at DESC);

-- For chore completion queries
CREATE INDEX chore_completions_date_idx
ON chore_completions (completed_at DESC);

-- For maintenance reminders (upcoming due)
CREATE INDEX maintenance_next_due_category_idx
ON maintenance_reminders (next_due, category);
```

#### 3.3 Frontend Bundle Optimization

**Recommendations:**
1. Enable Next.js bundle analyzer: `npm run analyze`
2. Lazy load view components in CalendarView
3. Consider route-based code splitting for features:
   ```typescript
   const ChoresPage = dynamic(() => import('@/components/features/chores'), {
     loading: () => <Skeleton />,
   });
   ```

---

### 4. Code Quality Improvements

#### 4.1 Consistent Error Handling

Create a centralized error handler:
```typescript
// src/lib/errors/api-error.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof APIError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }
  console.error('Unhandled error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

#### 4.2 Documentation Standards Enhancement

For non-coder customization, add `CUSTOMIZE:` comments consistently:
```typescript
/**
 * CUSTOMIZE: Family member colors
 * ============================================================================
 * To change a family member's color:
 * 1. Find their entry in the database (family_members table)
 * 2. Update the 'color' column to a new hex value
 *
 * Common colors:
 * - Blue:   #3B82F6
 * - Pink:   #EC4899
 * - Green:  #10B981
 * - Orange: #F59E0B
 * - Purple: #8B5CF6
 * ============================================================================
 */
```

#### 4.3 Environment Variable Validation

Add startup validation:
```typescript
// src/lib/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  OPENWEATHER_API_KEY: z.string().optional(),
  // ... all env vars
});

export const env = envSchema.parse(process.env);
```

---

### 5. Implementation Priority Matrix

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Fix hook dependency bug | Low | High |
| **P0** | Add missing API routes (chores, shopping, meals) | High | Critical |
| **P1** | Implement Redis caching | Medium | High |
| **P1** | Add Zod validation to API routes | Medium | High |
| **P1** | Centralize type definitions | Low | Medium |
| **P1** | Fix multi-day event query | Low | Medium |
| **P2** | Add permission middleware | Medium | Medium |
| **P2** | Implement unit tests | High | Medium |
| **P2** | Add E2E tests for critical flows | High | Medium |
| **P3** | Bundle optimization | Low | Low |
| **P3** | Component folder restructure | Medium | Low |

---

### 6. V1.0 Release Checklist

Before V1.0 release, the following must be complete:

**Core Features:**
- [ ] Calendar sync (Google OAuth working)
- [ ] Task management (CRUD + completion)
- [ ] Chore system (CRUD + approval workflow)
- [ ] Shopping lists (CRUD + categories)
- [ ] Meal planning (CRUD + weekly view)
- [ ] Family messages (CRUD + pinning)
- [ ] Maintenance reminders (CRUD + completion tracking)
- [ ] Birthday reminders (CRUD + notifications)
- [ ] Weather widget (working API integration)
- [ ] Clock widget (functional)

**Infrastructure:**
- [ ] All API routes implemented
- [ ] Input validation on all endpoints
- [ ] Error handling standardized
- [ ] Redis caching active
- [ ] Session management secure
- [ ] Rate limiting functional

**Quality:**
- [ ] Unit tests: >60% coverage
- [ ] E2E tests: Critical flows covered
- [ ] No TypeScript errors (`npm run type-check`)
- [ ] No ESLint warnings (`npm run lint`)
- [ ] Documentation reviewed

**Deployment:**
- [ ] Docker build successful
- [ ] Health check endpoint working
- [ ] Environment variables documented
- [ ] Setup guide tested on fresh install

---

### 7. Recommended Next Steps

1. **Immediate (This Sprint):**
   - Fix the hook dependency bug in `useCalendarEvents.ts`
   - Create shared types file for `CalendarEvent`
   - Add `/api/chores` routes (highest priority missing feature)

2. **Short-term (Next 2 Sprints):**
   - Complete all missing API routes
   - Add Zod validation to existing routes
   - Implement Redis caching for calendar/weather
   - Write unit tests for utility functions

3. **Medium-term (V1.0 Preparation):**
   - Build UI components for chores, shopping, meals
   - Add E2E tests for critical workflows
   - Performance audit and optimization
   - Documentation review

---

*This architectural review should be updated as the codebase evolves. Next review recommended after P0 and P1 items are complete.*

---

## Architectural Checkpoint Review (v20)

> **Review Date:** January 25, 2026
> **Reviewed By:** Claude Code (Opus 4.5)
> **Scope:** Pre-feature development checkpoint, alignment with updated requirements
> **Previous Review:** v19.1 (estimated ~40% complete)

---

### Executive Summary

**Current State:** ~75% of V1.0 core features implemented with solid infrastructure.

Significant progress has been made since the v19.1 review:
- All critical API routes now implemented (chores, shopping, meals, maintenance, birthdays)
- Zod validation schemas added to `src/lib/validations/index.ts`
- Modal components created for all major features
- Calendar integration functional with Google OAuth
- Database schema stable with proper indexes

**Key Findings:**
- 1 critical architectural gap (Navigation sidebar not implemented)
- 3 alignment issues with updated requirements
- 4 items ready for V1.0 (previously marked as gaps)
- Strong foundation for scalability

---

### 1. Progress Since v19.1 Review

#### Previously Critical Gaps - Now Resolved

| Feature | v19.1 Status | Current Status |
|---------|-------------|----------------|
| Chores API | ❌ Missing | ✅ Complete (`/api/chores`, `/api/chores/[id]`, `/api/chores/[id]/complete`) |
| Shopping API | ❌ Missing | ✅ Complete (`/api/shopping-lists`, `/api/shopping-items`) |
| Meals API | ❌ Missing | ✅ Complete (`/api/meals`, `/api/meals/[id]`) |
| Maintenance API | ❌ Missing | ✅ Complete (`/api/maintenance`, `/api/maintenance/[id]/complete`) |
| Birthdays API | ❌ Missing | ✅ Complete (`/api/birthdays`) |
| Zod Validation | ❌ Missing | ✅ Complete (`src/lib/validations/index.ts`) |
| Modal Components | ❌ Missing | ✅ Complete (AddTaskModal, AddChoreModal, AddShoppingItemModal, AddEventModal, AddMessageModal) |
| Type Centralization | ⚠️ Partial | ✅ Improved (`src/types/calendar.ts`, `src/types/user.ts`) |

#### Items Still Pending from v19.1

| Item | Status | Notes |
|------|--------|-------|
| Redis Caching | ⚠️ Configured, unused | Low priority - can defer post-V1.0 |
| Unit Tests | ❌ Not started | Should add before V1.0 |
| E2E Tests | ❌ Not started | Should add for critical flows |
| Permission Middleware | ⚠️ Types defined, not enforced | Medium priority |
| Multi-day Event Query Fix | ⚠️ Not fixed | Medium priority |

---

### 2. Alignment with Updated Requirements

The requirements document was updated with new architectural requirements (Application Structure & Navigation section). The current codebase has gaps:

#### 2.1 Navigation Sidebar - NOT IMPLEMENTED

**Requirement (lines 1507-1511):**
> - Position: Left vertical sidebar (persistent on desktop/tablet)
> - Visibility: Always visible on desktop (1920x1080); collapsible on tablet; bottom nav on mobile
> - Maximum Pages: 5 or fewer dedicated pages (plus dashboard home)

**Current State:**
- No sidebar component exists
- Navigation happens via widget "View All" buttons
- Settings accessed via header button
- Each page has a "Home" button to return

**Impact:** Medium - Functional but inconsistent with requirements
**Recommendation:** Implement `NavigationSidebar` component before V1.0

**Proposed Implementation:**
```
src/components/layout/
├── NavigationSidebar.tsx      # Desktop/tablet sidebar
├── MobileBottomNav.tsx        # Mobile bottom navigation
└── DashboardLayout.tsx        # Update to include sidebar
```

#### 2.2 Calendar Default Selection - PARTIALLY ALIGNED

**Requirement (lines 112-138):**
> - Default Calendar: When creating events, the default selection should be "Other" (or the user's personal calendar), NOT the Family calendar
> - Family Calendar: Available as a selection option, but not pre-selected by default

**Current State:**
- `AddEventModal.tsx` does not have a calendar source selector field
- Events are created without explicit calendar assignment
- No "Other" calendar source exists in seed data

**Impact:** Low - Events work but don't follow intended default
**Recommendation:**
1. Add `calendarSourceId` field to AddEventModal
2. Create "Other" calendar source in seed data as default
3. Update event creation to pre-select "Other"

#### 2.3 Per-User Filtering on Dedicated Pages - NOT IMPLEMENTED

**Requirement (line 1534):**
> - Per-user filtering/modals: Dedicated pages will have modals and filters broken out per family member

**Current State:**
- Dedicated pages (CalendarView, ChoresView, ShoppingView) show all items
- No per-user filtering UI exists
- Modals don't filter by logged-in user

**Impact:** Medium - Functional but not personalized
**Recommendation:** Add user filter dropdown/tabs to dedicated page headers

---

### 3. Scalability Assessment

#### 3.1 Database Layer - EXCELLENT

✅ **Strengths:**
- Drizzle ORM provides type-safe queries
- Proper indexes on frequently queried columns
- Connection pooling configured in `client.ts`
- UUID primary keys support distributed systems
- JSONB fields for flexible data (preferences, widgets)

⚠️ **Areas to Watch:**
- No soft deletes (hard deletes throughout)
- No audit logging (who changed what, when)
- Some queries lack pagination (could be issue at scale)

**Recommendation:** Add `deletedAt` column to key tables for soft deletes before production use with real family data.

#### 3.2 API Layer - GOOD

✅ **Strengths:**
- RESTful patterns consistently applied
- Zod validation on all endpoints
- Consistent error response format
- Proper HTTP status codes

⚠️ **Areas to Watch:**
- No rate limiting implemented
- No request logging/tracing
- No API versioning (`/api/v1/`)

**Recommendation:** Add rate limiting middleware before public deployment.

#### 3.3 Frontend Architecture - GOOD

✅ **Strengths:**
- Clean separation: widgets (compact) vs views (full-page)
- Hooks encapsulate data fetching logic
- Consistent component patterns
- TypeScript throughout

⚠️ **Areas to Watch:**
- No global state management (each widget manages own state)
- Potential for duplicate API calls if same data needed in multiple widgets
- No optimistic updates (UI waits for API response)

**Recommendation:** Consider React Query or SWR for data fetching to enable caching and optimistic updates.

#### 3.4 Deployment Infrastructure - EXCELLENT

✅ **Strengths:**
- Docker Compose for multi-service orchestration
- Health check endpoint (`/api/health`)
- Environment variable configuration
- PostgreSQL + optional Redis

---

### 4. Code Quality Assessment

#### 4.1 TypeScript Strictness - GOOD

```
// tsconfig.json has strict mode enabled
"strict": true,
"noImplicitAny": true,
"strictNullChecks": true
```

No `any` types found in recent code. Type definitions are comprehensive.

#### 4.2 Documentation - EXCELLENT

Every file has header comments explaining:
- What the file does
- Why it exists
- Usage examples
- CUSTOMIZE sections for non-coders

This is a significant strength for the open-source goal.

#### 4.3 Error Handling - GOOD

API routes have try/catch blocks with proper error responses. Frontend hooks expose `error` state for UI display.

Could improve: Centralized error boundary at app level.

---

### 5. V1.0 Readiness Checklist (Updated)

| Category | Item | Status |
|----------|------|--------|
| **Core Features** | | |
| | Calendar sync (Google OAuth) | ✅ Complete |
| | Task management (CRUD) | ✅ Complete |
| | Chore system (CRUD + complete) | ✅ Complete |
| | Shopping lists (CRUD) | ✅ Complete |
| | Meal planning (CRUD) | ✅ Complete |
| | Family messages (CRUD) | ✅ Complete |
| | Maintenance reminders (CRUD) | ✅ Complete |
| | Birthday reminders (CRUD) | ✅ Complete |
| | Weather widget | ✅ Complete |
| | Clock widget | ✅ Complete |
| **UI/UX** | | |
| | Dashboard widget grid | ✅ Complete |
| | Modal dialogs for all features | ✅ Complete |
| | Dedicated pages (calendar, tasks, chores, shopping, meals) | ✅ Complete |
| | Navigation sidebar | ❌ Not implemented |
| | Per-user filtering on pages | ❌ Not implemented |
| | Calendar source selector in event modal | ❌ Not implemented |
| **Infrastructure** | | |
| | All API routes | ✅ Complete |
| | Input validation | ✅ Complete |
| | Error handling | ✅ Complete |
| | Session management | ✅ Complete |
| | Redis caching | ⚠️ Configured, not active |
| | Rate limiting | ❌ Not implemented |
| **Quality** | | |
| | TypeScript strict | ✅ Complete |
| | ESLint clean | ✅ Complete |
| | Unit tests | ❌ Not started |
| | E2E tests | ❌ Not started |
| **Deployment** | | |
| | Docker build | ✅ Complete |
| | Health check | ✅ Complete |
| | Seed data | ✅ Complete |

**V1.0 Readiness: ~85%**

---

### 6. Implementation Priority for V1.0

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| **P0** | Implement NavigationSidebar component | Medium | High (requirements alignment) |
| **P0** | Add calendar source selector to AddEventModal | Low | Medium (requirements alignment) |
| **P1** | Add per-user filter tabs to dedicated pages | Medium | Medium (personalization) |
| **P1** | Create "Other" calendar as default in seed | Low | Low (requirements alignment) |
| **P1** | Fix multi-day event query bug | Low | Medium (correctness) |
| **P2** | Add rate limiting middleware | Medium | Medium (security) |
| **P2** | Write unit tests for validation schemas | Medium | Medium (quality) |
| **P2** | Write E2E tests for auth + CRUD flows | High | Medium (quality) |
| **P3** | Implement Redis caching | Medium | Low (performance) |
| **P3** | Add soft delete to key tables | Low | Low (data safety) |

---

### 7. Recommended Next Steps

**Immediate (Before V1.0):**
1. Create `NavigationSidebar` component with icons for: Home, Calendar, Tasks/Chores, Shopping, Settings
2. Update `DashboardLayout` to include sidebar on desktop, bottom nav on mobile
3. Add `calendarSourceId` field to `AddEventModal` with "Other" as default
4. Update seed data to include an "Other" calendar source

**Short-term (V1.0 Polish):**
5. Add user filter dropdown to CalendarView, ChoresView, ShoppingView headers
6. Fix multi-day event query in `/api/events`
7. Add basic rate limiting (100 requests/minute per IP)

**Post-V1.0:**
8. Implement Redis caching for weather and calendar
9. Add comprehensive test coverage
10. Consider React Query for optimized data fetching

---

### 8. Architectural Diagram (Current)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRISM ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         PRESENTATION LAYER                            │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │   │
│  │  │  Dashboard   │  │  Dedicated   │  │      Modal Dialogs       │   │   │
│  │  │   Widgets    │  │    Pages     │  │  (Add/Edit forms)        │   │   │
│  │  │ (8 widgets)  │  │ (5 pages)    │  │  (5 modals)              │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │   │
│  │              ↓              ↓                     ↓                   │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │                    REACT HOOKS                                 │   │   │
│  │  │  useCalendarEvents, useTasks, useChores, useShoppingLists,    │   │   │
│  │  │  useMeals, useMessages, useWeather, useCalendarSources        │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     ↓                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                           API LAYER                                   │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │              Next.js API Routes (/api/*)                    │     │   │
│  │  │  /events, /tasks, /chores, /shopping-*, /meals, /messages,  │     │   │
│  │  │  /maintenance, /birthdays, /family, /calendars, /weather    │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │              ↓                                      ↓                 │   │
│  │  ┌────────────────────┐              ┌───────────────────────────┐   │   │
│  │  │   Zod Validation   │              │   External APIs           │   │   │
│  │  │   (all schemas)    │              │   - Google Calendar       │   │   │
│  │  └────────────────────┘              │   - OpenWeatherMap        │   │   │
│  │                                       └───────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                     ↓                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         DATA LAYER                                    │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                    Drizzle ORM                               │     │   │
│  │  │  Type-safe queries, migrations, schema definitions          │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │                               ↓                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                   PostgreSQL                                 │     │   │
│  │  │  16 tables: users, events, tasks, chores, shopping_*,       │     │   │
│  │  │  meals, messages, maintenance_*, birthdays, settings, etc.  │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  │                                                                       │   │
│  │  ┌─────────────────────────────────────────────────────────────┐     │   │
│  │  │                    Redis (Optional)                          │     │   │
│  │  │  Configured but not actively used - for future caching      │     │   │
│  │  └─────────────────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 9. Conclusion

The Prism codebase is in strong shape for V1.0 release. The core functionality is complete and working. The main gaps are:

1. **Navigation UX** - Sidebar needs implementation to match requirements
2. **Calendar defaults** - "Other" calendar should be default, not Family
3. **Personalization** - Per-user filtering on dedicated pages

These are all achievable with moderate effort. The architecture is sound, scalable, and well-documented. The codebase follows best practices and is ready for open-source contribution.

**Recommendation:** Proceed with P0 items (navigation sidebar, calendar selector), then move to V1.0 release preparation.

---

*Next review recommended after navigation sidebar implementation is complete.*