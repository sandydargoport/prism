/**
 * ============================================================================
 * PRISM - Progress Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides an accessible progress bar for showing completion percentage.
 * Used for shopping list progress, chore completion tracking, etc.
 *
 * ACCESSIBILITY:
 * - Proper ARIA attributes (role="progressbar", aria-valuenow, etc.)
 * - Works with screen readers
 * - Announces progress updates
 *
 * VISUAL DESIGN:
 * - Horizontal bar that fills from left to right
 * - Smooth animations
 * - Customizable colors via CSS variables
 *
 * USAGE:
 *   <Progress value={50} />  // 50% complete
 *   <Progress value={75} className="h-2" />  // Custom height
 *   <Progress value={100} />  // Fully complete
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import * as ProgressPrimitive from '@radix-ui/react-progress';
import { cn } from '@/lib/utils';

/**
 * PROGRESS COMPONENT
 * ============================================================================
 * An accessible progress bar built on Radix UI primitives.
 *
 * PROPS:
 * - value: Number from 0-100 representing percentage complete
 *
 * @example Basic usage
 * <Progress value={50} />
 *
 * @example Custom styling
 * <Progress
 *   value={75}
 *   className="h-4 bg-muted"  // Taller with custom background
 * />
 *
 * @example Full completion
 * const checked = 8;
 * const total = 10;
 * const progress = (checked / total) * 100;
 * <Progress value={progress} />
 * ============================================================================
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      // Container styling
      'relative h-2 w-full',
      // Background
      'overflow-hidden rounded-full bg-primary/20',
      className
    )}
    {...props}
  >
    {/*
      PROGRESS INDICATOR
      The filled portion that shows progress.
      Width is controlled by the 'value' prop (0-100).
    */}
    <ProgressPrimitive.Indicator
      className={cn(
        // Fills container height
        'h-full w-full',
        // Flex to handle content
        'flex-1',
        // Color
        'bg-primary',
        // Smooth animation when value changes
        'transition-all duration-300 ease-in-out'
      )}
      style={{
        // Transform from 0% to 100% based on value
        // translateX(-100%) = fully hidden (0%)
        // translateX(0%) = fully visible (100%)
        transform: `translateX(-${100 - (value || 0)}%)`,
      }}
    />
  </ProgressPrimitive.Root>
));

Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
