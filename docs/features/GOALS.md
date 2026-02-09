# Points & Goals System

## Overview
Children earn points from completing chores, which can be redeemed for goals set by parents.

## Points

### Earning Points
- Complete assigned chores
- Points awarded after parent approval (if required)
- Point value set per chore

### Point Counters
- Per-child tracking
- Weekly, monthly, yearly, all-time totals
- Pending approval points shown separately

### Points API
- `GET /api/points` - Per-child summaries
- Returns: totalEarned, totalSpent, available, pendingApproval

## Goals

### Goal Properties
- Name (required)
- Description
- Point cost
- Emoji icon
- Priority (for ordering)
- Active status
- Recurring (with period: weekly/monthly/yearly)

### Goal Types
- **One-time**: Accumulate points until redeemed
- **Recurring**: Reset each period, progress from current period only

### Waterfall Allocation
Points fill goals in priority order:
1. Sort goals by priority
2. For each goal, allocate available points
3. Recurring goals only count current period points
4. Non-recurring goals accumulate overflow

## Goals Page

### Per-Child Sections
- Child name with color indicator
- Available points display
- Goal progress cards

### Goal Cards
- Emoji + name
- Point cost
- Progress bar per child
- Recurring badge (if applicable)
- Checkmark when achieved

### Parent Controls
- Add/edit/delete goals
- Priority reorder (up/down buttons)
- Redeem button for achieved goals
- Reset for non-recurring goals

## PointsWidget

### Dashboard Display
- Lazy-loaded widget
- Per-child weekly counters
- Goal progress bars
- Checkmarks for achieved goals

### Configuration
- Registered as 'points' in widgetRegistry
- minW: 2, minH: 3, defaultW: 3, defaultH: 5

## Permissions

### canManageGoals
- Parent: true
- Child: false
- Guest: false

### Operations
- View goals: All roles
- Create/edit/delete goals: Parents only
- Redeem goals: Parents only

## Cache Invalidation

### Affected Caches
- `goals:*` - On goal CRUD
- `points:*` - On chore complete/approve

### Trigger Points
- Chore completion invalidates goals cache
- Chore approval invalidates goals cache
- Goal redemption invalidates both

## Files
- `src/app/goals/GoalsView.tsx` - Main page
- `src/app/goals/page.tsx` - Page wrapper
- `src/lib/hooks/useGoals.ts` - Goals data hook
- `src/lib/hooks/usePoints.ts` - Points data hook
- `src/lib/utils/pointWaterfall.ts` - Allocation logic
- `src/components/widgets/PointsWidget.tsx` - Dashboard widget
- `src/app/api/goals/route.ts` - CRUD endpoints
- `src/app/api/goals/[id]/redeem/route.ts` - Redemption
- `src/app/api/goals/reorder/route.ts` - Priority reorder
- `src/app/api/points/route.ts` - Point summaries

## Seed Data
Default goals created by seed:
- Weekly Allowance (50 pts, recurring weekly)
- Movie Night (75 pts)
- Ice Cream Trip (100 pts)
