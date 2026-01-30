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
