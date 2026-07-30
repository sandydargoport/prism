/**
 *
 * Provides a single, consistent "nothing here yet" presentation used across
 * the app's primary list pages (tasks, chores, shopping, meals, recipes,
 * wishes, goals, messages, photos, etc).
 *
 * Before this component existed, every page grew its own slightly-different
 * empty state: different icon opacities, different padding, different text
 * sizes. EmptyState replaces all of those with one canonical look so a
 * brand-new user sees the same "nothing here yet" everywhere.
 *
 * USAGE:
 *   <EmptyState
 *     icon={<CheckSquare />}
 *     title="No tasks found"
 *     action={<Button variant="outline" size="sm" onClick={...}>Add your first task</Button>}
 *   />
 *
 * DESIGN NOTES:
 * - Centered, muted, generous padding by default (matches the most common
 *   existing pattern across pages).
 * - `size="sm"` shrinks padding/typography for tight spaces (e.g. a single
 *   column in a per-person grid) while keeping the same visual language.
 * - Composable: pass any icon element, any action (usually a <Button/>).
 *
 */

import * as React from 'react';
import { cn } from '@/lib/utils';


export interface EmptyStateProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * Icon element, e.g. `<CheckSquare />`. Do not pass sizing/color classes —
   * EmptyState sizes and mutes it consistently.
   */
  icon?: React.ReactNode;
  /** Primary message, e.g. "No tasks found". */
  title: React.ReactNode;
  /** Optional secondary line with more detail or a hint. */
  description?: React.ReactNode;
  /** Optional call to action, usually a <Button/> (e.g. "Add your first task"). */
  action?: React.ReactNode;
  /**
   * `default` — generous padding, for a page's main empty state.
   * `sm` — compact padding, for embedded/per-item empty states (e.g. one
   * column of a per-person grid).
   */
  size?: 'default' | 'sm';
}

/**
 * EMPTY STATE
 * The canonical "nothing here yet" block.
 *
 * @example Basic usage
 * <EmptyState icon={<ClipboardList />} title="No chores found" />
 *
 * @example With description and action
 * <EmptyState
 *   icon={<ImageIcon />}
 *   title="No photos yet"
 *   description="Click Upload to add photos, or connect OneDrive in Settings."
 * />
 *
 * @example Compact, for tight embedded spaces
 * <EmptyState size="sm" title="No wishes yet" />
 */
const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon, title, description, action, size = 'default', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // Layout. Default size fills + vertically-centers within its container
        // (so it lands in a consistent spot on every page, regardless of
        // orientation); the compact 'sm' variant stays inline for embedded use.
        'flex flex-col items-center justify-center text-center text-muted-foreground',
        size === 'sm' ? 'py-4' : 'min-h-full flex-1 py-12',
        className
      )}
      {...props}
    >
      {icon && (
        <div
          className={cn(
            'opacity-40',
            size === 'sm'
              ? 'mb-2 [&>svg]:h-6 [&>svg]:w-6'
              : 'mb-3 [&>svg]:h-12 [&>svg]:w-12'
          )}
        >
          {icon}
        </div>
      )}
      <p className={cn(size === 'sm' ? 'text-xs' : 'text-base font-medium')}>{title}</p>
      {description && (
        <p className={cn('mt-1 text-muted-foreground', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
);
EmptyState.displayName = 'EmptyState';


export { EmptyState };
