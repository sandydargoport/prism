/**
 * ============================================================================
 * PRISM - Dashboard Grid Layout
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides the main grid layout for organizing widgets on the dashboard.
 * Widgets are arranged in a responsive CSS grid.
 *
 * GRID SYSTEM:
 * The dashboard uses a 4-column grid (on desktop) that adapts to screen size:
 * - Desktop (1920x1080): 4 columns
 * - Tablet: 2-3 columns
 * - Mobile: 1-2 columns
 *
 * WIDGET SIZES:
 * Widgets can span multiple columns/rows:
 * - small:  1x1 (single cell)
 * - medium: 1x2 (one column, two rows)
 * - large:  2x2 (two columns, two rows)
 * - wide:   2x1 (two columns, one row)
 * - tall:   1x3 (one column, three rows)
 *
 * USAGE:
 *   <DashboardGrid>
 *     <ClockWidget />
 *     <WeatherWidget />
 *     <CalendarWidget />
 *     <TasksWidget />
 *   </DashboardGrid>
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';


/**
 * DASHBOARD GRID PROPS
 * ============================================================================
 */
export interface DashboardGridProps {
  /** Widget components to arrange in the grid */
  children: React.ReactNode;
  /** Number of columns (default: 4) */
  columns?: 2 | 3 | 4;
  /** Gap between widgets in pixels */
  gap?: number;
  /** Additional CSS classes */
  className?: string;
}


/**
 * DASHBOARD GRID COMPONENT
 * ============================================================================
 * The main container that arranges widgets in a responsive grid.
 *
 * RESPONSIVE BEHAVIOR:
 * - On large screens: Shows full grid (default 4 columns)
 * - On tablets: Reduces to 2-3 columns
 * - On mobile: Single column stack
 *
 * GRID SIZING:
 * - Uses CSS Grid with auto-fill for rows
 * - Each row is 200px by default (configurable)
 * - Widgets can span multiple cells using grid-column/grid-row
 *
 * @example Basic usage
 * <DashboardGrid>
 *   <ClockWidget />
 *   <WeatherWidget />
 *   <CalendarWidget />
 * </DashboardGrid>
 *
 * @example Custom columns
 * <DashboardGrid columns={3}>
 *   {widgets}
 * </DashboardGrid>
 * ============================================================================
 */
export function DashboardGrid({
  children,
  columns = 4,
  gap = 16,
  className,
}: DashboardGridProps) {
  // Column configuration based on prop
  const columnClasses = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div
      className={cn(
        // Grid layout
        'grid',
        columnClasses[columns],
        // Auto-fill rows with minimum height
        'auto-rows-[200px]',
        // Full height of container
        'h-full w-full',
        // Padding around the grid
        'p-4',
        className
      )}
      style={{ gap: `${gap}px` }}
    >
      {children}
    </div>
  );
}


/**
 * DASHBOARD LAYOUT
 * ============================================================================
 * Full-page layout component that includes the dashboard grid
 * along with any header/navigation elements.
 *
 * STRUCTURE:
 * ┌────────────────────────────────────────┐
 * │  Header (optional)                      │
 * ├────────────────────────────────────────┤
 * │                                         │
 * │         Dashboard Grid                  │
 * │         (Widgets here)                  │
 * │                                         │
 * └────────────────────────────────────────┘
 *
 * @example
 * <DashboardLayout>
 *   <DashboardGrid>
 *     <ClockWidget />
 *     <WeatherWidget />
 *   </DashboardGrid>
 * </DashboardLayout>
 * ============================================================================
 */
export function DashboardLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Full viewport
        'min-h-screen w-full',
        // Background
        'bg-background',
        // Flex column for header + content
        'flex flex-col',
        className
      )}
    >
      {/* Main content area */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
}


/**
 * DASHBOARD HEADER PROPS
 * ============================================================================
 */
export interface DashboardHeaderProps {
  /** Current user info (if logged in) */
  user?: {
    name: string;
    avatarUrl?: string;
    color?: string;
  };
  /** Greeting text (e.g., "Good morning") */
  greeting?: string;
  /** Show settings button */
  showSettings?: boolean;
  /** Callback when settings button is clicked */
  onSettingsClick?: () => void;
  /** Callback when user avatar is clicked (for logout/switch user) */
  onUserClick?: () => void;
  /** Callback when edit layout button is clicked (parents only) */
  onEditClick?: () => void;
}


/**
 * DASHBOARD HEADER
 * ============================================================================
 * Optional header bar for the dashboard.
 * Shows app name, greeting, user info, and quick actions.
 *
 * NOTE: For a wall-mounted display, you might want to hide this
 * to maximize space for widgets. It's optional.
 *
 * @example Basic
 * <DashboardHeader />
 *
 * @example With user
 * <DashboardHeader
 *   user={{ name: 'Alex', color: '#3B82F6' }}
 *   greeting="Good morning"
 *   onUserClick={() => logout()}
 * />
 * ============================================================================
 */
export function DashboardHeader({
  user,
  greeting,
  showSettings = true,
  onSettingsClick,
  onUserClick,
  onEditClick,
}: DashboardHeaderProps) {
  return (
    <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Left side: Logo and greeting */}
        <div className="flex items-center gap-4">
          {/* App name / Logo */}
          <span className="text-xl font-bold text-primary">Prism</span>

          {/* Greeting */}
          {greeting && (
            <span className="text-muted-foreground">
              {greeting}
              {user && (
                <span className="font-medium text-foreground">, {user.name}</span>
              )}
              {!user && (
                <span className="font-medium text-foreground">, family</span>
              )}
            </span>
          )}
        </div>

        {/* Right side: User and settings */}
        <div className="flex items-center gap-2">
          {/* User avatar - show guest icon when not logged in */}
          <button
            onClick={onUserClick}
            className="flex items-center gap-2 p-1.5 rounded-full hover:bg-accent transition-colors"
            aria-label={user ? 'Switch user' : 'Log in'}
          >
            {user ? (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white"
                style={{ backgroundColor: user.color || '#6B7280' }}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted border-2 border-dashed border-muted-foreground/50">
                <GuestIcon />
              </div>
            )}
          </button>

          {/* Edit layout button */}
          {onEditClick && (
            <button
              onClick={onEditClick}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              aria-label="Edit layout"
            >
              <GridEditIcon />
            </button>
          )}

          {/* Settings button */}
          {showSettings && (
            <button
              onClick={onSettingsClick}
              className="p-2 rounded-md hover:bg-accent transition-colors"
              aria-label="Settings"
            >
              <SettingsIcon />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

/**
 * Guest icon for when no user is logged in
 */
function GuestIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}


/**
 * Grid edit icon for layout customization
 */
function GridEditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

/**
 * Simple settings icon (inline SVG to avoid importing lucide for just this)
 */
function SettingsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
