/**
 * ============================================================================
 * PRISM - Switch Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides an accessible toggle switch for on/off states.
 * Used for enabling/disabling chores, settings toggles, etc.
 *
 * ACCESSIBILITY:
 * - Full keyboard support (Space/Enter to toggle)
 * - Proper ARIA attributes
 * - Focus visible states
 * - Works with screen readers
 *
 * TOUCH OPTIMIZATION:
 * - Large touch target
 * - Clear visual feedback on interaction
 * - Smooth animations
 *
 * USAGE:
 *   <Switch />
 *   <Switch checked={true} />
 *   <Switch onCheckedChange={(checked) => console.log(checked)} />
 *
 *   // With label
 *   <div className="flex items-center gap-2">
 *     <Switch id="notifications" />
 *     <label htmlFor="notifications">Enable notifications</label>
 *   </div>
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';
import { cn } from '@/lib/utils';

/**
 * SWITCH COMPONENT
 * ============================================================================
 * An accessible toggle switch built on Radix UI primitives.
 *
 * STATES:
 * - Unchecked: Track is grey, thumb is on the left
 * - Checked: Track is primary color, thumb is on the right
 *
 * @example Basic usage
 * <Switch />
 *
 * @example Controlled
 * const [enabled, setEnabled] = useState(false);
 * <Switch
 *   checked={enabled}
 *   onCheckedChange={setEnabled}
 * />
 *
 * @example With label (accessible)
 * <div className="flex items-center gap-2">
 *   <Switch id="wifi" />
 *   <label htmlFor="wifi">Enable WiFi</label>
 * </div>
 * ============================================================================
 */
const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={cn(
      // Size (width x height for the track)
      'peer inline-flex h-6 w-11',
      // Shape
      'rounded-full',
      // Border
      'border-2 border-transparent',
      // Focus state
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
      // Disabled state
      'disabled:cursor-not-allowed disabled:opacity-50',
      // Default state (unchecked)
      'bg-input',
      // Checked state
      'data-[state=checked]:bg-primary',
      // Transitions
      'transition-colors',
      // Touch optimization
      'cursor-pointer touch-action-manipulation',
      // Shrink prevention
      'shrink-0',
      className
    )}
    {...props}
    ref={ref}
  >
    {/*
      SWITCH THUMB
      The circular button that slides left/right.
      Radix handles the position based on state.
    */}
    <SwitchPrimitives.Thumb
      className={cn(
        // Size
        'pointer-events-none block h-5 w-5',
        // Shape
        'rounded-full',
        // Color
        'bg-background',
        // Shadow
        'shadow-lg',
        // Initial position (left side when unchecked)
        'translate-x-0',
        // Checked position (right side)
        'data-[state=checked]:translate-x-5',
        // Transitions (smooth slide)
        'transition-transform ring-0'
      )}
    />
  </SwitchPrimitives.Root>
));

Switch.displayName = SwitchPrimitives.Root.displayName;

export { Switch };
