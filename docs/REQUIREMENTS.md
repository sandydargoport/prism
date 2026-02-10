# Prism - Product Requirements

> Family dashboard for managing calendars, tasks, chores, shopping, meals, and more.

## Table of Contents
- [Core Architecture](#core-architecture)
- [Calendar System](#calendar-system)
- [Tasks System](#tasks-system)
- [Chores & Points System](#chores--points-system)
- [Shopping Lists](#shopping-lists)
- [Meals & Recipes](#meals--recipes)
- [Photos & Wallpaper](#photos--wallpaper)
- [Dashboard & Widgets](#dashboard--widgets)
- [Mobile PWA](#mobile-pwa)
- [External Integrations](#external-integrations)
- [Security & Authentication](#security--authentication)
- [Away Mode & Babysitter Info](#away-mode--babysitter-info)
- [Infrastructure](#infrastructure)

---

## Core Architecture

### Stack
- **Frontend**: Next.js 15 (App Router), React, TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **Database**: PostgreSQL with Drizzle ORM
- **Cache**: Redis for sessions and API caching
- **Layout**: react-grid-layout for dashboard customization
- **Deployment**: Docker Compose (prism-app, prism-db, prism-redis, prism-backup)

### Authentication
- PIN-based login with bcrypt hashing
- Role-based access control (parent, child, guest)
- Sessions stored in Redis with configurable durations
- `requireAuth()` and `requireRole()` helpers for route protection

### Performance Optimizations
- Redis caching on GET endpoints with invalidation on mutations
- Database indexes on frequently queried columns
- Lazy-loaded widgets via React.lazy() + Suspense
- Visibility-based polling (pauses when tab hidden)
- N+1 query fixes via batch operations

---

## Calendar System

### Features
- **Multiple Views**: Day, Week, Two-Week, Month, Three-Month
- **Calendar Groups**: User-specific and custom groupings
- **Google Calendar Sync**: OAuth integration with bidirectional sync
- **Birthday Sync**: Extracts birthdays from Google Contacts calendar

### View Behaviors
- **Day View**: Side-by-side columns per calendar group
- **Week View**: 7-column grid with all 24 hours displayed
- **Two-Week View**: Portrait shows 2 columns x 7 rows; Landscape shows 7 columns x 2 rows
- **Month View**: Traditional calendar grid with scrollable day cells
- **Three-Month View**: Three-column overview

### Touch/Mobile Features
- Swipe left/right to navigate between periods
- Auto-scaling hours to fit available space (no scrolling needed)
- Hidden hours feature: Configure time blocks to hide (e.g., 12am-6am) via Settings → Display
- Clock toggle button in day/week views to show/hide configured time block

### Event Features
- Color picker with presets + user's profile color as default
- Configure which calendars appear in "Add Event" modal
- Alias/rename calendar sources in settings
- Overlapping events cycle through horizontal positions

---

## Tasks System

### Features
- Task lists with color coding
- Priority levels (high, medium, low)
- Due dates and completion tracking
- List assignment and filtering

### Microsoft To-Do Integration
- OAuth authentication with `Tasks.ReadWrite` scope
- Bidirectional sync with conflict resolution (newest wins)
- Per-list sync control
- Multiple Prism lists can connect to different MS To-Do lists
- Background auto-sync every 5 minutes on dashboard/screensaver

### UI Features
- List filter dropdown in header
- List tags displayed on tasks
- "None" filter option for unassigned tasks
- Edit/delete icons visible in both light and dark modes

---

## Chores & Points System

### Chores
- Categories: cleaning, laundry, dishes, yard, pets, trash, other
- Frequencies: daily, weekly, biweekly, monthly, quarterly, semi-annually, annually, custom
- Custom start day for reset periods (e.g., weekly resets on Sunday)
- Point values per chore
- Approval workflow for children's completions

### Points System
- Points earned from approved chore completions
- Per-child tracking: weekly, monthly, yearly, all-time counters
- Pending approval tracking

### Goals System
- Goals with point costs, emojis, and descriptions
- Priority ordering with drag-to-reorder
- Recurring goals (weekly/monthly/yearly) vs one-time goals
- Waterfall allocation: points fill goals in priority order
- Goal redemption with reset functionality

### Chore History
- `/api/chores/completions` endpoint
- History toggle in ChoresView
- Shows who completed, when, points, approval status

### Group by Person View
- Grid layout dividing screen by user with independent scrolling per section
- Default view for both Chores and Tasks pages
- Edit button on items to open edit modal
- Plane celebration animation when user completes all their items
  - Prop plane with trailing banner displays "Way to go, {userName}!"

---

## Shopping Lists

### List Types
- **Grocery**: 6-category grid (produce, bakery, meat, dairy, frozen, pantry)
- **Hardware/Other**: 2-column layout ("List 1" and "List 2")

### Features
- Drag-to-reorder grocery categories (persisted in localStorage)
- Notebook-paper styling with lined rows
- +1/-1/+5 row controls per category
- Inline text input for quick item addition
- Tap to strikethrough (no checkboxes)
- Progress bar showing checked/total items
- Celebration animation when all items checked

### Shopping Mode
- Full-screen mobile mode via maximize button
- Compact header with list name, progress badge, progress bar
- Hides list tabs and filters for maximum space

### Microsoft To-Do Integration
- Same OAuth as tasks (Graph API)
- Bidirectional sync for shopping items as MS To-Do tasks
- Per-list sync control

---

## Meals & Recipes

### Meal Planning
- Weekly view organized by day and meal type
- Link meals to saved recipes
- Auto-fill meal details from linked recipe

### Recipe System
- Full CRUD with name, description, ingredients, instructions
- Prep time, cook time, servings, cuisine, category
- Favorite and "times made" tracking
- Image URLs

### Recipe Import
- **URL Import**: Parses schema.org Recipe JSON-LD (~80% of recipe sites)
- **Paprika Import**: Parses Paprika HTML export format

### Recipe Features
- Search and filter by cuisine/category
- Favorites filter
- Ingredient scaling with smart fractions
- Add scaled ingredients to shopping list
- Ingredient strikethrough toggle while cooking
- Maximize modal for full-screen viewing

---

## Photos & Wallpaper

### Photo Management
- Upload photos with usage tags (wallpaper, gallery, screensaver)
- Photo lightbox with navigation
- Pinned photo selection for wallpaper/screensaver

### Wallpaper
- Rotating background on dashboard (configurable interval)
- Auto-match photos to screen orientation option
- Fallback to all photos if no wallpaper-tagged photos exist
- "Never" option for static wallpaper

### Screensaver
- Activates after configurable inactivity period
- Photo rotation interval (5s to 1hr or never)
- Template layouts for different widget arrangements

---

## Dashboard & Widgets

### Layout System
- Draggable, resizable widgets via react-grid-layout
- 12-column grid system
- Per-widget color customization with opacity
- Layout import/export via clipboard JSON

### Available Widgets
- Calendar, Tasks, Chores, Shopping, Meals
- Messages, Weather, Clock, Birthdays
- Points/Goals, Photos

### Screensaver Editor
- Separate layout for screensaver mode
- Template presets (minimal, photoFrame, infoPanel, familyBoard, kitchen, commandCenter)
- Screen size guides for different displays

### Display Behavior
- Dashboard prevents swiping beyond screen bounds
- Widgets can still scroll internally
- Wallpaper only shows on dashboard and screensaver

---

## Mobile PWA

### Installation
- Web manifest enables "Add to Home Screen"
- Service worker caches assets with network-first API caching
- App icons (192x192, 512x512)
- Shortcuts for Shopping, Tasks, Messages

### Navigation
- **Mobile (phones)**: Bottom MobileNav with simplified items
- **Portrait (tablets)**: Bottom PortraitNav with expandable drawer
- **Landscape**: Collapsible SideNav on left

### Mobile-Specific Behavior
- Calendar forced to day view on mobile
- Removed Calendar, Recipes, Photos, Settings from mobile nav
- Home button hidden on mobile (redundant with bottom nav)
- Login accessible via person icon in all nav styles

### Responsive Font Sizes
- Phones: 16px base
- Desktop (mouse): 18px base
- Tablets (touch, 768px+): 20px
- Large tablets (1024px+): 22px
- Kiosks (1400px+): 24px

---

## External Integrations

### Microsoft Graph API
- Shared OAuth flow for calendar, tasks, and shopping
- Token encryption at rest (AES-256-GCM)
- Automatic token refresh
- Separate scopes for calendar vs tasks

### Provider Architecture
- `TaskProvider` interface for extensibility
- Microsoft To-Do implementation complete
- Todoist and Apple Reminders planned for future

---

## Security & Authentication

### Route Protection
- `requireAuth()` for authentication check
- `requireRole(auth, 'permission')` for RBAC
- Display-only mode via `getDisplayAuth()` for unauthenticated viewing

### Database Security
- Transactions on concurrent mutations
- FK cascade rules for referential integrity
- Magic byte validation on file uploads (JPEG/PNG/WebP)

### Rate Limiting
- Per-user Redis-based rate limiting
- Configurable limits per endpoint type
- Graceful fallback when Redis unavailable

### Permissions
- `canApproveChores`, `canDeleteAnyMessage`, `canDeleteTasks`
- `canManageGoals`, `canManageRecipes`, `canManageIntegrations`
- `canToggleAwayMode` (parent only)
- Role-based defaults (parent has all, child has limited, guest has minimal)

---

## Away Mode & Babysitter Info

### Away Mode
Privacy screen that hides sensitive information when family is away.

**Features**:
- Hides calendar, tasks, chores, messages from view
- Shows only clock, weather, and photo slideshow
- Parent PIN required to exit
- Toggle via moon icon in dashboard header
- Persists across page refreshes (server-side state in settings table)

**Components**:
- `AwayModeOverlay`: Full-screen overlay (z-index 9998, below screensaver)
- `ExitAwayModeModal`: Parent-only PIN prompt
- `AwayModeToggle`: Dashboard header button

**API**:
- `GET /api/away-mode`: Returns current state (no auth required)
- `POST /api/away-mode`: Toggle state (requires parent + `canToggleAwayMode`)

### Babysitter Mode
Full-screen overlay that displays babysitter info prominently.

**Features**:
- Shows all babysitter info sections (emergency contacts, house info, children, rules)
- Clock and weather in header bar
- Blue/purple gradient background
- Tap anywhere to show exit prompt
- Parent PIN required to exit
- Toggle via baby icon in dashboard header

**Components**:
- `BabysitterModeOverlay`: Full-screen overlay (z-index 9997, below away mode)
- `ExitBabysitterModeModal`: Parent-only PIN prompt
- `BabysitterModeToggle`: Dashboard header button

**API**:
- `GET /api/babysitter-mode`: Returns current state (no auth required)
- `POST /api/babysitter-mode`: Toggle state (requires parent + `canToggleAwayMode`)

**Z-Index Layering**:
- Screensaver: 9999
- Away Mode: 9998
- Babysitter Mode: 9997
- PIN Modal: 10001
- Exit Modals: 10000

### Babysitter Info
Public information page for babysitters and caregivers.

**Access**:
- `/babysitter` page viewable without authentication
- Sensitive items require parent PIN to view
- Print-friendly layout via print button

**Section Types**:
- **Emergency Contacts**: Name, relationship, phone (with call links), primary flag
- **House Information**: Label/value pairs (WiFi password, address, etc.)
- **Children**: Name, age, allergies, medications, bedtime, notes
- **House Rules**: Rule text with importance level (high/medium/low)

**Features**:
- Sensitive items can be PIN-protected
- Per-section item ordering
- Settings page for CRUD operations
- Print button for clean printable layout

**Database**:
- `babysitter_info` table with section, sortOrder, content (jsonb), isSensitive

**API**:
- `GET /api/babysitter-info`: List all items (sensitive content filtered unless `?includeSensitive=true`)
- `POST /api/babysitter-info`: Create item (parent + `canModifySettings`)
- `PATCH /api/babysitter-info/[id]`: Update item
- `DELETE /api/babysitter-info/[id]`: Delete item
- `POST /api/babysitter-info/reorder`: Reorder items within section

---

## Infrastructure

### Automated Backups
- `prism-backup` container with pg_dump + rclone
- Daily backups at 3 AM + immediate backup on container start
- 7-day local retention with automatic cleanup
- Optional off-site sync to OneDrive/S3/etc via rclone

### Backup Scripts
- `scripts/backup.sh`: Creates compressed database dump
- `scripts/backup-scheduler.sh`: Manages backup schedule
- `scripts/restore.sh`: Restores from backup with safety confirmation

### Disaster Recovery
Key files to back up separately (not in database):
- `.env`: DB_PASSWORD, ENCRYPTION_KEY, OAuth secrets
- `config/rclone.conf`: OneDrive OAuth tokens
- `uploads/`: User-uploaded files (avatars, photos)
- `data/photos/`: Synced photos
