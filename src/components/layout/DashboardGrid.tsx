/**
 *
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
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';


/**
 * DASHBOARD GRID PROPS
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
        // Transparent background to allow wallpaper to show through
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
 */
export interface DashboardHeaderProps {
  /** Callback when edit layout button is clicked (parents only) */
  onEditClick?: () => void;
  /** Callback when screensaver button is clicked */
  onScreensaverClick?: () => void;
}


/**
 * DASHBOARD HEADER
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
 */
export function DashboardHeader({
  onEditClick,
  onScreensaverClick,
}: DashboardHeaderProps) {
  return (
    <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-2">
      <div className="flex items-center justify-end gap-2">
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

        {/* Screensaver button */}
        {onScreensaverClick && (
          <button
            onMouseDown={(e) => { e.stopPropagation(); }}
            onClick={(e) => { e.stopPropagation(); onScreensaverClick(); }}
            className="p-2 rounded-md hover:bg-accent transition-colors"
            aria-label="Start screensaver"
          >
            <ScreensaverIcon />
          </button>
        )}

      </div>
    </header>
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
 * Screensaver icon (monitor with play triangle)
 */
function ScreensaverIcon() {
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
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <polygon points="10,7 10,13 15,10" fill="currentColor" stroke="none" />
    </svg>
  );
}

