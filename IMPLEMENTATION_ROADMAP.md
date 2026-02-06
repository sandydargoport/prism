# Prism Implementation Roadmap

> **Purpose:** Step-by-step implementation guide for completing V1.0 and beyond
> **Created:** January 2026
> **For:** Claude Sonnet execution
> **Reference:** See `docs/requirements/INDEX.md` for segmented requirements, or `prism-requirements_v19.md` for full specifications

---

## How to Use This Document

Work through phases in order. Each task includes:
- **Files:** What to create or modify
- **Pattern:** Existing code to follow as template
- **Acceptance:** How to verify completion
- **Dependencies:** What must be done first

Mark tasks complete with `[x]` as you finish them.

---

## Phase 1: Critical Bug Fixes — COMPLETE

- [x] Task 1.1: Fix useCalendarEvents Hook Dependency Bug
- [x] Task 1.2: Fix Multi-Day Event Query

---

## Phase 2: Shared Types & Validation — COMPLETE

- [x] Task 2.1: Create Shared Calendar Types (`src/types/calendar.ts`)
- [x] Task 2.2: Update CalendarWidget to Use Shared Types
- [x] Task 2.3: Update CalendarView to Use Shared Types
- [x] Task 2.4: Update useCalendarEvents to Use Shared Types
- [x] Task 2.5: Create Zod Validation Schemas (`src/lib/validations/index.ts`)
- [x] Task 2.6: Add Validation to Events API Route

---

## Phase 3: Missing API Routes — COMPLETE

- [x] Task 3.1: Create Chores API Route (`/api/chores`)
- [x] Task 3.2: Create Chores [id] API Route (`/api/chores/[id]`)
- [x] Task 3.3: Create Chore Completion Route (`/api/chores/[id]/complete`)
- [x] Task 3.4: Create Shopping Lists API Route (`/api/shopping-lists`)
- [x] Task 3.5: Create Shopping Lists [id] Route (`/api/shopping-lists/[id]`)
- [x] Task 3.6: Create Shopping Items API Route (`/api/shopping-items`)
- [x] Task 3.7: Create Shopping Items [id] Route (`/api/shopping-items/[id]`)
- [x] Task 3.8: Create Meals API Route (`/api/meals`)
- [x] Task 3.9: Create Meals [id] Route (`/api/meals/[id]`)
- [x] Task 3.10: Create Maintenance API Route (`/api/maintenance`)
- [x] Task 3.11: Create Maintenance [id] Route (`/api/maintenance/[id]`)
- [x] Task 3.12: Create Birthdays API Route (`/api/birthdays`)
- [x] Task 3.13: Create Birthdays [id] Route (`/api/birthdays/[id]`)

---

## Phase 4: Hooks for New Features — COMPLETE

- [x] Task 4.1: Create useChores Hook
- [x] Task 4.2: Create useShoppingLists Hook
- [x] Task 4.3: Create useMeals Hook
- [x] Task 4.4: Update Hooks Index

---

## Phase 5: UI Components — COMPLETE

- [x] Task 5.1: Create ChoresWidget
- [x] Task 5.2: Create ShoppingWidget
- [x] Task 5.3: Create MealsWidget
- [x] Task 5.4: Update Widgets Index
- [x] Task 5.5: Add New Widgets to Dashboard

---

## Phase 6: Full Page Views — COMPLETE

- [x] Task 6.1: Create Chores Page
- [x] Task 6.2: Create Shopping Page
- [x] Task 6.3: Create Meals Page

---

## Phase 7: Caching & Performance — COMPLETE

- [x] Task 7.1: Implement Redis Cache Helper
- [x] Task 7.2: Add Caching to Weather API
- [x] Task 7.3: Add Caching to Events API

---

## Phase 8: Testing — DEFERRED

> Testing infrastructure deferred to post-V1.0. Core functionality prioritized first.

- [ ] Task 8.1: Set Up Jest Configuration
- [ ] Task 8.2: Write Validation Schema Tests
- [ ] Task 8.3: Write Hook Tests
- [ ] Task 8.4: Set Up Playwright
- [ ] Task 8.5: Write E2E Tests for Critical Flows

---

## Phase 8.5: Birthdays & Milestones — COMPLETE

> Added after initial roadmap. Birthday tracking and milestone features implemented.

- [x] Birthday API routes (CRUD)
- [x] Birthday widget with countdown and age calculation
- [x] Birthday dedicated page with upcoming/all views
- [x] useBirthdays hook
- [x] Family member birthday sync from user records

---

## Phase 9: Layout Customization & Dashboard Editing

> **Ref:** `docs/requirements/14-layouts.md`, `docs/requirements/21-data-architecture.md` (layouts table)
> **Prerequisite:** DB `layouts` table already exists in schema

### Task 9.1: Create Layout API Routes
- **File to Create:** `src/app/api/layouts/route.ts`
- **File to Create:** `src/app/api/layouts/[id]/route.ts`
- **Features:** CRUD for saved layouts, set default, per-display support
- **Pattern:** Follow existing API route patterns (tasks, chores)
- **Acceptance:** Can create, read, update, delete layout configurations

### Task 9.2: Create useLayouts Hook
- **File to Create:** `src/lib/hooks/useLayouts.ts`
- **Features:** Fetch layouts, save layout, load layout, reset to default
- **Pattern:** Follow useTasks hook
- **Acceptance:** Hook manages layout state, persists to API

### Task 9.3: Integrate react-grid-layout
- **File to Modify:** `package.json` (add dependency)
- **File to Create:** `src/components/layout/GridLayout.tsx`
- **Features:** Drag-and-drop widget positioning, resize handles, grid snap
- **Acceptance:** Widgets can be dragged and resized on dashboard

### Task 9.4: Create Layout Editor UI
- **File to Create:** `src/components/layout/LayoutEditor.tsx`
- **File to Create:** `src/components/layout/WidgetPicker.tsx`
- **Features:** Edit mode toggle, save/load/reset buttons, widget add/remove panel
- **Acceptance:** Parents can enter edit mode, rearrange widgets, save custom layouts

### Task 9.5: Pre-built Layout Templates
- **File to Create:** `src/lib/constants/layoutTemplates.ts`
- **Features:** Family Central (default), Task Master, Photo Frame, Command Center, Clean & Simple
- **Acceptance:** Users can select from pre-built templates

---

## Phase 10: Photo Slideshow & Gallery

> **Ref:** `docs/requirements/09-photos.md`, `docs/requirements/21-data-architecture.md` (iCloud/OneDrive APIs)

### Task 10.1: Photo Sources Integration
- **Files:** `src/lib/integrations/icloud-photos.ts`, `src/lib/integrations/google-photos.ts`
- **Features:** Authenticate with iCloud/Google Photos, list albums, fetch photos
- **Acceptance:** Can connect to photo sources and retrieve photo metadata

### Task 10.2: Photo Cache/Storage System
- **File to Create:** `src/lib/cache/photos.ts`
- **File to Create:** `src/app/api/photos/route.ts`
- **Features:** Local photo cache, download and resize, cache management
- **Acceptance:** Photos are cached locally for fast slideshow display

### Task 10.3: Slideshow Widget
- **File to Create:** `src/components/widgets/PhotoWidget.tsx`
- **Features:** Transition effects (fade, slide, zoom), configurable duration, shuffle/chronological, favorites
- **Acceptance:** Widget cycles through photos with smooth transitions

### Task 10.4: Screensaver/Idle Mode
- **File to Modify:** `src/lib/hooks/useIdleDetection.ts`
- **Features:** Full-screen slideshow on idle, wake on touch/motion, configurable timeout
- **Acceptance:** Dashboard enters photo screensaver after idle timeout

### Task 10.5: Photo Upload
- **File to Create:** `src/app/api/photos/upload/route.ts`
- **Features:** Drag-and-drop upload, mobile upload via QR code link
- **Acceptance:** Parents can upload photos directly

---

## Phase 11: Away/Travel Mode

> **Ref:** `docs/requirements/12-away-mode.md`

### Task 11.1: Away Mode State & API
- **File to Create:** `src/app/api/away-mode/route.ts`
- **File to Create:** `src/lib/hooks/useAwayMode.ts`
- **Features:** Toggle away mode, scheduled activation, PIN to exit
- **Acceptance:** Away mode state persists and is queryable

### Task 11.2: Privacy Screen
- **File to Modify:** `src/components/dashboard/Dashboard.tsx`
- **Features:** Hide calendars, tasks, chores, messages, locations; show only clock, weather, photos
- **Acceptance:** Sensitive information hidden when away mode active

### Task 11.3: Away Mode Exit
- **Features:** PIN entry to disable, auto-disable on schedule end
- **Acceptance:** Only parents can exit away mode via PIN

---

## Phase 12: Seasonal Themes & Animations

> **Ref:** `docs/requirements/13-themes.md`, `docs/requirements/18-animations.md`

### Task 12.1: Monthly Theme CSS/Assets
- **Files to Create:** `src/styles/themes/seasonal/january.css` through `december.css`
- **Features:** 12 monthly color schemes, background images, icon sets
- **Acceptance:** Each month has distinct visual theme

### Task 12.2: Theme Auto-Switching
- **File to Modify:** `src/components/themes/ThemeProvider.tsx`
- **Features:** Auto-switch on 1st of month, manual override, theme intensity control (subtle/full)
- **Acceptance:** Themes switch automatically and can be overridden

### Task 12.3: Achievement Animations
- **File to Create:** `src/components/animations/AchievementAnimation.tsx`
- **Features:** Chore completion confetti, all-chores-done trophy, birthday balloons, solar milestones
- **Acceptance:** Animations trigger on relevant events

### Task 12.4: Monthly Transition Animations
- **File to Create:** `src/components/animations/MonthlyTransition.tsx`
- **Features:** January confetti, February hearts, September falling leaves, December snowflakes, etc.
- **Acceptance:** Transition animation plays once on theme change

---

## Phase 13: Solar Panel Monitoring

> **Ref:** `docs/requirements/15-solar.md`, `docs/requirements/21-data-architecture.md` (Enphase API)

### Task 13.1: Enphase Enlighten API Integration
- **File to Create:** `src/lib/integrations/enphase.ts`
- **Features:** Authenticate, get system summary, current production, energy stats
- **Acceptance:** Can fetch real-time and historical solar data

### Task 13.2: Solar Widget
- **File to Create:** `src/components/widgets/SolarWidget.tsx`
- **Features:** Current production (kW), today's kWh, week/month/YTD totals, system status
- **Acceptance:** Widget displays real-time solar production data

### Task 13.3: Solar Details Page
- **File to Create:** `src/app/solar/page.tsx`
- **Features:** Production graph (Recharts), weather correlation, savings calculator, environmental impact (CO2, trees)
- **Acceptance:** Detailed solar analytics page with charts

---

## Phase 14: Sonos/Music Control

> **Ref:** `docs/requirements/16-sonos.md`, `docs/requirements/21-data-architecture.md` (Sonos API)

### Task 14.1: Sonos API Integration
- **File to Create:** `src/lib/integrations/sonos.ts`
- **Features:** OAuth auth, discover speakers, get groups, playback state, play/pause/skip/volume
- **Acceptance:** Can control Sonos speakers from dashboard

### Task 14.2: Now Playing Widget
- **File to Create:** `src/components/widgets/MusicWidget.tsx`
- **Features:** Album art, artist/song/source, playback controls, per-room volume
- **Acceptance:** Widget shows what's playing and allows control

### Task 14.3: Music Control Page
- **File to Create:** `src/app/music/page.tsx`
- **Features:** Room selection, speaker grouping/ungrouping, favorites, browse sources
- **Acceptance:** Full music control page with multi-room support

---

## Phase 15: Babysitter Info Screen

> **Ref:** `docs/requirements/17-babysitter.md`

### Task 15.1: Babysitter Data API
- **File to Create:** `src/app/api/babysitter/route.ts`
- **Features:** CRUD for emergency contacts, house info, kids info, house rules
- **Acceptance:** Can store and retrieve babysitter info

### Task 15.2: Babysitter Display
- **File to Create:** `src/app/babysitter/page.tsx`
- **Features:** Emergency contacts, WiFi QR code, bedtimes, dietary info, house rules
- **Acceptance:** Clean, readable babysitter info screen

### Task 15.3: Babysitter Mode & Access Control
- **Features:** Quick access button on main screen, no auth required by default, optional PIN for sensitive info, printable PDF export
- **Acceptance:** Babysitter can access info without logging in

---

## Future Phases (Post V1.5)

> These features are documented in `docs/requirements/19-location-bus-smarthome.md` and `docs/requirements/29-future-roadmap.md`

### Phase 16: Family Location Map
- Apple Find My / Life360 integration
- Interactive map with family member locations
- Geofencing alerts
- Privacy controls (opt-in, limited history)

### Phase 17: Bus Tracking
- FirstView app integration (reverse engineering required)
- Bus ETA widget
- Proximity alerts
- Route display on map

### Phase 18: Smart Home Control
- Homebridge / Home Assistant integration
- Device control (lights, switches, outlets)
- Temperature/humidity monitoring
- Scene triggering

### Phase 19: Voice Assistant Integration
- Alexa skill for shopping list
- Voice-to-text for messages
- "Alexa, enable away mode"

### Phase 20: Mobile Companion App
- React Native or PWA
- Push notifications
- Quick actions (add items, check chores)
- Location sharing

### Phase 21: Template Gallery
- `shared_templates` DB table (layout JSON, name, description, thumbnail, author, type: dashboard/screensaver, created_at, likes)
- Browse/preview page with grid of template cards showing mini-preview of widget positions
- One-click "Apply" to import a template into your dashboard or screensaver
- "Share" button in layout editor to publish current layout to the gallery
- Category filtering (minimal, family board, kitchen, info-heavy, etc.)
- Prerequisites: layout import/export (already implemented in Phase 5)

---

## Completion Checklist (V1.0 — Phases 1–7)

- [x] All API routes return proper responses
- [x] No TypeScript errors (`npm run type-check`)
- [x] All hooks work correctly
- [x] All widgets display properly
- [x] Full pages are functional
- [x] Caching is active
- [x] Docker build succeeds

---

## Notes for Execution

1. **Run tests frequently** — After each task, verify no regressions
2. **Follow existing patterns** — The codebase has consistent style, maintain it
3. **Keep documentation** — Add JSDoc comments matching existing style
4. **Commit often** — One commit per task or logical group
5. **Ask if unclear** — Reference `docs/requirements/INDEX.md` to find relevant section
6. **Requirements are segmented** — Load only the section you need from `docs/requirements/`

---

*Last Updated: January 2026*
