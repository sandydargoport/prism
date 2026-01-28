/**
 * ============================================================================
 * PRISM - Widget Container Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides a standardized container for dashboard widgets.
 * All widgets (Clock, Weather, Calendar, Tasks, etc.) use this as their shell.
 *
 * FEATURES:
 * - Consistent styling across all widgets
 * - Header with title and optional actions
 * - Loading and error states
 * - Expandable to full screen
 * - Touch-friendly interactions
 *
 * DESIGN PHILOSOPHY:
 * - Widgets should feel like "cards" on a dashboard
 * - Each widget can show its own loading/error states
 * - Optional header for widgets that need titles
 * - Content area fills available space
 *
 * USAGE:
 *   <WidgetContainer title="Weather" icon={<CloudIcon />}>
 *     <WeatherContent />
 *   </WidgetContainer>
 *
 *   <WidgetContainer
 *     title="Tasks"
 *     actions={<Button size="icon"><PlusIcon /></Button>}
 *     loading={isLoading}
 *   >
 *     <TaskList tasks={tasks} />
 *   </WidgetContainer>
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';


/**
 * WIDGET SIZE
 * ============================================================================
 * Widgets can be different sizes on the dashboard grid.
 * These map to grid column/row spans.
 * ============================================================================
 */
export type WidgetSize = 'small' | 'medium' | 'large' | 'wide' | 'tall';


/**
 * WIDGET CONTAINER PROPS
 * ============================================================================
 */
export interface WidgetContainerProps {
  /** Widget title (shown in header) */
  title?: string;
  /** URL to navigate to when title is clicked */
  titleHref?: string;
  /** Icon to show before title */
  icon?: React.ReactNode;
  /** Action buttons for the header (e.g., add, refresh) */
  actions?: React.ReactNode;
  /** Widget content */
  children: React.ReactNode;
  /** Whether the widget is loading data */
  loading?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Size variant for grid layout */
  size?: WidgetSize;
  /** Whether to show the header */
  showHeader?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Click handler for the entire widget */
  onClick?: () => void;
}


/**
 * WIDGET CONTAINER COMPONENT
 * ============================================================================
 * The main container component for all dashboard widgets.
 *
 * @example Basic widget
 * <WidgetContainer title="Clock">
 *   <ClockDisplay />
 * </WidgetContainer>
 *
 * @example Widget with actions
 * <WidgetContainer
 *   title="Tasks"
 *   icon={<CheckSquareIcon />}
 *   actions={
 *     <Button size="icon" variant="ghost">
 *       <PlusIcon />
 *     </Button>
 *   }
 * >
 *   <TaskList />
 * </WidgetContainer>
 *
 * @example Loading state
 * <WidgetContainer title="Weather" loading={true}>
 *   <WeatherContent />
 * </WidgetContainer>
 * ============================================================================
 */
export function WidgetContainer({
  title,
  titleHref,
  icon,
  actions,
  children,
  loading = false,
  error = null,
  size = 'medium',
  showHeader = true,
  className,
  onClick,
}: WidgetContainerProps) {
  // Size classes for the grid
  const sizeClasses: Record<WidgetSize, string> = {
    small: 'col-span-1 row-span-1',
    medium: 'col-span-1 row-span-2',
    large: 'col-span-2 row-span-2',
    wide: 'col-span-2 row-span-1',
    tall: 'col-span-1 row-span-3',
  };

  return (
    <Card
      className={cn(
        // Grid sizing
        sizeClasses[size],
        // Full height within grid cell
        'h-full',
        // Flex column layout
        'flex flex-col',
        // Interactive cursor if clickable
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        // Overflow handling
        'overflow-hidden',
        className
      )}
      onClick={onClick}
    >
      {/* WIDGET HEADER */}
      {showHeader && title && (
        <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            {/* Icon */}
            {icon && (
              <span className="text-muted-foreground">
                {icon}
              </span>
            )}
            {/* Title - clickable link if titleHref provided */}
            {titleHref ? (
              <Link href={titleHref} className="hover:underline">
                <CardTitle className="text-base font-medium">
                  {title}
                </CardTitle>
              </Link>
            ) : (
              <CardTitle className="text-base font-medium">
                {title}
              </CardTitle>
            )}
          </div>
          {/* Action buttons */}
          {actions && (
            <div className="flex items-center gap-1">
              {actions}
            </div>
          )}
        </CardHeader>
      )}

      {/* WIDGET CONTENT */}
      <CardContent
        className={cn(
          // Fill remaining space
          'flex-1',
          // Overflow handling
          'overflow-hidden',
          // Remove padding if no header
          !showHeader && 'pt-4'
        )}
      >
        {/* Loading State */}
        {loading && (
          <WidgetLoading />
        )}

        {/* Error State */}
        {error && !loading && (
          <WidgetError message={error} />
        )}

        {/* Normal Content */}
        {!loading && !error && children}
      </CardContent>
    </Card>
  );
}


/**
 * WIDGET LOADING
 * ============================================================================
 * Loading indicator shown while widget data is being fetched.
 * Uses a skeleton/shimmer effect for a polished feel.
 * ============================================================================
 */
function WidgetLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="space-y-3 w-full">
        {/* Skeleton lines */}
        <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
        <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
      </div>
    </div>
  );
}


/**
 * WIDGET ERROR
 * ============================================================================
 * Error state shown when widget fails to load.
 * Shows a friendly message and suggests retry.
 * ============================================================================
 */
function WidgetError({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center p-4">
      <div className="text-destructive text-4xl mb-2">⚠️</div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}


/**
 * WIDGET EMPTY
 * ============================================================================
 * Empty state shown when widget has no data.
 * Can be used inside widgets for their empty states.
 *
 * @example
 * {tasks.length === 0 ? (
 *   <WidgetEmpty
 *     icon={<CheckCircleIcon />}
 *     message="No tasks for today"
 *     action={<Button>Add Task</Button>}
 *   />
 * ) : (
 *   <TaskList tasks={tasks} />
 * )}
 * ============================================================================
 */
export function WidgetEmpty({
  icon,
  message,
  action,
}: {
  icon?: React.ReactNode;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center text-center p-4 gap-3">
      {icon && (
        <div className="text-muted-foreground text-4xl">
          {icon}
        </div>
      )}
      <p className="text-sm text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}
