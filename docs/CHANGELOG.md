# Changelog

All notable changes to Prism are documented in this file.

## [0.9.1] - 2026-02-09

### Added
- **Calendar hidden hours**: Configure time blocks to hide (e.g., 12am-6am) in Settings → Display
- **Calendar toggle button**: Clock icon in day/week views to show/hide configured time block
- **Grocery category drag-to-reorder**: Drag categories by grip icon to rearrange
- **Non-grocery list layout**: 2-column "List 1"/"List 2" layout matching grocery card style
- **Dashboard swipe prevention**: Prevents scrolling beyond screen bounds while allowing widget internal scroll

### Fixed
- Shopping list type now persists correctly (grocery vs hardware)
- "All Done!" celebration animation properly auto-dismisses
- Two-week vertical view Saturday row no longer cut off
- Non-grocery lists now use consistent card styling

## [0.9.0] - 2026-02-07

### Added
- **Mobile PWA**: Installable app with service worker, manifest, and app icons
- **Bottom navigation**: Mobile and portrait tablet navigation bars
- **Swipe navigation**: Swipe left/right on calendar views to navigate
- **Responsive font sizing**: 16px phones, 18px desktop, 20-24px tablets
- **Shopping celebration**: Animation when all items checked off
- **Shopping mode**: Full-screen mobile shopping experience
- **Calendar auto-scaling**: Views fit available space without scrolling

### Changed
- Removed Chores and Goals from mobile navigation (kiosk-focused)
- Calendar forced to day view on mobile devices
- SideNav hidden on mobile (bottom nav only)

## [0.8.0] - 2026-02-06

### Added
- **Microsoft To-Do integration**: Bidirectional task sync with OAuth
- **Shopping list sync**: MS To-Do integration for shopping items
- **Recipe system**: Full CRUD, URL import, Paprika import
- **Recipe scaling**: Adjust servings with smart fraction handling
- **Add ingredients to shopping list**: From recipe detail modal
- **Meal-recipe linking**: Select recipes when planning meals
- **Background auto-sync**: Tasks sync every 5 minutes on dashboard/screensaver
- **SVG favicon**: New prism icon design
- **Task list management**: Edit names, delete lists, change external connections

### Changed
- Task integration UI redesigned with per-list connect buttons
- Recipe categories/cuisine filter dropdowns
- Ingredient strikethrough toggle in recipe modal

## [0.7.0] - 2026-02-06

### Added
- **Calendar event colors**: Color picker with user profile color default
- **Hide calendars from Add Event**: Configurable per calendar in settings
- **Calendar alias/rename**: Edit display names in settings
- **24-hour week view**: Shows all hours instead of 6am-10pm
- **Overlapping events**: Cycle through horizontal positions
- **Login prompts**: All create actions now require authentication first

### Changed
- Portrait navigation icons increased 1.4x
- Week view shows all-day events in scrollable header
- Removed "+n more" event truncation

## [0.6.0] - 2026-02-06

### Added
- **Wallpaper rotation**: Configurable interval with "never" option
- **Screensaver photo interval**: Configurable in settings
- **Auto-sync re-enabled**: Calendar syncs every 10 minutes
- **Wallpaper fallback**: Uses all photos if none tagged for wallpaper

### Fixed
- Wallpaper only shows on dashboard and screensaver
- Dashboard wallpaper no longer blocked by solid background
- Shopping cache invalidation on item changes
- Tasks cache invalidation on changes
- Points cache invalidation on chore changes

## [0.5.0] - 2026-02-05

### Added
- **Points & Goals system**: Full implementation with waterfall allocation
- **Goal redemption**: Parents can redeem goals for children
- **PointsWidget**: Dashboard widget with per-child progress
- **Goals page**: View, create, edit, delete goals with progress tracking
- **Chore completion history**: View recent completions with approval status
- **Layout import/export**: Share layouts via clipboard JSON

### Changed
- Logo in SideNav: Pixel dissolve design
- Screensaver templates repositioned to hug top borders
- Goals cache invalidation on chore complete/approve

### Fixed
- Chore period boundaries (weekly resets on Sundays)
- Pending chores display in dashboard
- Widget color settings now persist
- Completed goals visibility in light/dark modes

## [0.4.0] - 2026-02-05

### Added
- **Security hardening**: Transactions on concurrent mutations
- **Magic byte validation**: JPEG/PNG/WebP verification on uploads
- **Per-user rate limiting**: Redis-based with graceful fallback

### Fixed
- `requireRole()` authorization gaps in chores/messages/tasks
- Race condition in family member deletion
- Missing author ownership check in messages PATCH

## [0.3.0] - 2026-02-05

### Added
- **Lazy-loaded widgets**: 7 non-default widgets load on demand
- **Conditional modal rendering**: Modals only mount when open

### Changed
- Split 6 oversized components into custom hooks
- All component functions now under 250 lines
- Removed dead `getDemoEvents()` function

## [0.2.0] - 2026-02-05

### Added
- **Database indexes**: 7 new indexes for query performance
- **Consolidated shopping API**: `?includeItems=true` parameter
- **Unique birthday index**: For batch upsert operations

### Fixed
- N+1 query in calendar groups (batch insert)
- N+1 query in birthday sync (batch upsert)
- FK cascade rules on 16 nullable user columns

## [0.1.0] - 2026-02-05

### Added
- **Redis caching**: GET endpoints with mutation invalidation
- **FamilyContext**: Replaces 9 duplicate fetch calls
- **Visibility-based polling**: Pauses when tab hidden

### Fixed
- COUNT query bugs in tasks and messages routes
- Polling intervals reduced (60s→300s/120s)

### Changed
- Brand renamed from "Prism" to "Prism"
