# Side Navigation Implementation

This document describes the side navigation system implemented for the Prism family dashboard.

## Overview

The side navigation provides persistent navigation across all pages of the Prism application, with the exception of the login/PIN pad screen. It includes:

- Links to all main sections (Dashboard, Calendar, Tasks, Chores, Shopping, Meals, Messages, Settings)
- User avatar with profile dropdown
- Collapsible design (icons only or full width with labels)
- Mobile-responsive with hamburger menu
- Persistent state (remembers collapsed/expanded preference)

## Architecture

### Components

#### 1. `SideNav.tsx`
The main side navigation component that renders the vertical navigation bar.

**Location:** `src/components/layout/SideNav.tsx`

**Props:**
```typescript
interface SideNavProps {
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  onLogout?: () => void;
  className?: string;
}
```

**Features:**
- Desktop: Fixed sidebar (64px collapsed, 240px expanded)
- Mobile: Slide-in overlay with hamburger toggle
- Active page highlighting based on current route
- localStorage persistence for collapsed state
- User dropdown with Settings link and Logout option

#### 2. `AppShell.tsx`
A wrapper component that combines the side navigation with main content area.

**Location:** `src/components/layout/AppShell.tsx`

**Props:**
```typescript
interface AppShellProps {
  children: React.ReactNode;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  onLogout?: () => void;
  hideNav?: boolean;
  className?: string;
}
```

**Features:**
- Automatically adjusts content area margin for side nav
- Can hide navigation entirely (for login screens)
- Responsive layout that adapts to screen size

#### 3. `PageWrapper.tsx`
A convenience wrapper for pages that need the AppShell with navigation.

**Location:** `src/components/layout/PageWrapper.tsx`

**Props:**
```typescript
interface PageWrapperProps {
  children: React.ReactNode;
  hideNav?: boolean;
  className?: string;
}
```

**Features:**
- Manages user state from localStorage
- Provides logout functionality
- Simplifies page integration

## Usage

### In Dashboard Component (with custom auth)

The main dashboard has its own auth flow, so it manages the user state and wraps itself with AppShell:

```tsx
import { AppShell } from '@/components/layout/AppShell';

export function Dashboard({ requireAuth }: DashboardProps) {
  const [currentUser, setCurrentUser] = useState<FamilyMember | null>(null);

  // If not authenticated, hide nav
  if (requireAuth && !currentUser) {
    return (
      <AppShell hideNav>
        <PinPad onSuccess={(member) => setCurrentUser(member)} />
      </AppShell>
    );
  }

  // Show dashboard with nav
  return (
    <AppShell
      user={currentUser}
      onLogout={() => setCurrentUser(null)}
    >
      <DashboardLayout>
        {/* Dashboard content */}
      </DashboardLayout>
    </AppShell>
  );
}
```

### In Other Pages (using PageWrapper)

For other pages like Calendar, Tasks, etc., use the PageWrapper:

```tsx
import { PageWrapper } from '@/components/layout';

export function CalendarView() {
  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* Calendar content */}
      </div>
    </PageWrapper>
  );
}
```

### Hiding Navigation

For special pages that shouldn't show navigation (like standalone login):

```tsx
<PageWrapper hideNav>
  <LoginPage />
</PageWrapper>
```

## Navigation Items

The navigation includes the following routes:

| Label | Route | Icon | Description |
|-------|-------|------|-------------|
| Dashboard | `/` | Home | Main dashboard with widgets |
| Calendar | `/calendar` | Calendar | Full calendar view |
| Tasks | `/tasks` | CheckSquare | Task management |
| Chores | `/chores` | Sparkles | Household chores |
| Shopping | `/shopping` | ShoppingCart | Shopping lists |
| Meals | `/meals` | UtensilsCrossed | Meal planning |
| Messages | `/messages` | MessageSquare | Family messages |
| Settings | `/settings` | Settings | App settings |

## Styling

### Desktop
- Collapsed width: `64px` (icons only)
- Expanded width: `240px` (icons + labels)
- Transition duration: `300ms`
- Position: Fixed left side

### Mobile (< md breakpoint)
- Hidden by default
- Slide-in overlay when hamburger clicked
- Full width overlay with backdrop
- Hamburger button fixed at top-left

### Theme Integration
- Uses CSS variables from `globals.css`
- Colors: `bg-card`, `border-border`, `text-muted-foreground`
- Active state: `bg-primary`, `text-primary-foreground`
- Hover state: `bg-accent`

## State Management

### Collapsed State (Desktop)
Stored in localStorage as `sideNavCollapsed`:
```typescript
localStorage.setItem('sideNavCollapsed', 'true' | 'false');
```

### Mobile Menu State
Managed in component state, automatically closes on route change.

### User State
- Dashboard: Managed by Dashboard component with PIN auth
- Other pages: Loaded from localStorage in PageWrapper

## Accessibility

- Proper ARIA labels on icon-only buttons
- Keyboard navigation support
- Focus states visible
- Screen reader friendly
- Touch-friendly targets (minimum 44px)

## Responsive Breakpoints

- `max-md`: Mobile (< 768px) - Hamburger menu
- `md`: Tablet/Desktop (>= 768px) - Persistent sidebar

## Integration Notes

### Files Modified

1. **`src/components/layout/index.ts`**
   - Added exports for SideNav, AppShell, and PageWrapper

2. **`src/components/dashboard/Dashboard.tsx`**
   - Wrapped with AppShell
   - Passes user state and logout handler
   - Shows/hides nav based on auth state

3. **View Components** (CalendarView, TasksView, ChoresView, ShoppingView, MealsView, SettingsView)
   - Each wrapped with PageWrapper
   - Automatically includes side navigation

## Future Enhancements

Potential improvements:

1. **Notification badges** on nav items
2. **Quick actions** dropdown for common tasks
3. **Keyboard shortcuts** for navigation
4. **Navigation search** for quick jumps
5. **Breadcrumb trail** in header
6. **Recently viewed pages** section
7. **Pinned/favorite pages** reordering

## Testing

To verify the implementation:

1. **Navigation Links**
   - Click each nav item
   - Verify active state highlights current page
   - Check that navigation persists across pages

2. **Collapse/Expand**
   - Click collapse button (desktop)
   - Verify state persists on refresh
   - Check smooth transition animation

3. **Mobile Menu**
   - Resize to mobile width
   - Click hamburger to open
   - Click outside or on link to close
   - Verify backdrop overlay

4. **User Dropdown**
   - Click user avatar
   - Verify Settings link works
   - Verify Logout redirects to home

5. **Auth Flow**
   - Visit home page
   - Complete PIN authentication
   - Verify nav appears after auth
   - Logout and verify nav hides

## Troubleshooting

### Navigation not showing
- Check that `hideNav` prop is not set to `true`
- Verify AppShell or PageWrapper is wrapping the page
- Check that page is not the PIN pad screen

### Active state not highlighting
- Ensure using Next.js `<Link>` component
- Check pathname matching logic in SideNav
- Verify route matches expected format

### Mobile menu not working
- Check that hamburger button is rendering
- Verify z-index stacking context
- Test viewport width detection

### Collapsed state not persisting
- Check localStorage is enabled
- Verify key name matches: `sideNavCollapsed`
- Check for console errors on load
