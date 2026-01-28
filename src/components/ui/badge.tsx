/**
 * ============================================================================
 * PRISM - Badge Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides small status indicators and labels.
 * Used for showing categories, statuses, counts, etc.
 *
 * COMMON USES:
 * - Task priority indicators (High, Medium, Low)
 * - Chore status (Pending, Approved)
 * - Calendar event categories
 * - Notification counts
 *
 * VARIANTS:
 * - default: Primary colored badge
 * - secondary: Muted, less prominent
 * - destructive: Red, for warnings/errors
 * - outline: Bordered, transparent background
 *
 * USAGE:
 *   <Badge>New</Badge>
 *   <Badge variant="destructive">Overdue</Badge>
 *   <Badge variant="outline">Category</Badge>
 *
 * ============================================================================
 */

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';


/**
 * BADGE VARIANTS
 * ============================================================================
 * Defines the visual styles for different badge types.
 * ============================================================================
 */
const badgeVariants = cva(
  // BASE CLASSES - Applied to all badges
  [
    // Layout
    'inline-flex items-center',
    // Shape
    'rounded-full',
    // Padding
    'px-2.5 py-0.5',
    // Typography
    'text-xs font-semibold',
    // Transitions
    'transition-colors',
    // Focus (for interactive badges)
    'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  ],
  {
    variants: {
      variant: {
        // Default - primary color
        default:
          'bg-primary text-primary-foreground hover:bg-primary/80',

        // Secondary - muted, subtle
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',

        // Destructive - red, for warnings
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/80',

        // Outline - bordered, transparent background
        outline:
          'border border-input bg-background text-foreground',

        // Success - green, for completed items
        success:
          'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',

        // Warning - yellow/orange, for attention needed
        warning:
          'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);


/**
 * BADGE PROPS
 * ============================================================================
 */
export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}


/**
 * BADGE COMPONENT
 * ============================================================================
 * A small label for displaying status, category, or count.
 *
 * @example Basic usage
 * <Badge>New</Badge>
 *
 * @example Priority badges
 * <Badge variant="destructive">High Priority</Badge>
 * <Badge variant="warning">Medium</Badge>
 * <Badge variant="secondary">Low</Badge>
 *
 * @example Status badges
 * <Badge variant="success">Completed</Badge>
 * <Badge variant="outline">Pending</Badge>
 * ============================================================================
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
