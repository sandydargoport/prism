/**
 * ============================================================================
 * PRISM - Checkbox Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides an accessible checkbox component for binary choices.
 * Used for task completion, chore tracking, shopping list items, etc.
 *
 * ACCESSIBILITY:
 * - Full keyboard support (Space to toggle)
 * - Proper ARIA attributes
 * - Focus visible states
 * - Works with screen readers
 *
 * TOUCH OPTIMIZATION:
 * - 24x24px visual size (larger than typical 16x16)
 * - Touch target extends beyond visual bounds
 * - Clear visual feedback on interaction
 *
 * USAGE:
 *   <Checkbox />
 *   <Checkbox checked={true} />
 *   <Checkbox onCheckedChange={(checked) => console.log(checked)} />
 *
 *   // With label
 *   <div className="flex items-center gap-2">
 *     <Checkbox id="task1" />
 *     <label htmlFor="task1">Complete the task</label>
 *   </div>
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';


/**
 * CHECKBOX COMPONENT
 * ============================================================================
 * An accessible checkbox built on Radix UI primitives.
 *
 * RADIX UI:
 * Radix provides unstyled, accessible primitives.
 * We add our styles while keeping all the accessibility features.
 *
 * STATES:
 * - Unchecked: Empty box
 * - Checked: Box with checkmark
 * - Indeterminate: Box with dash (for "select all" scenarios)
 *
 * @example Basic usage
 * <Checkbox />
 *
 * @example Controlled
 * const [checked, setChecked] = useState(false);
 * <Checkbox
 *   checked={checked}
 *   onCheckedChange={setChecked}
 * />
 *
 * @example With label (accessible)
 * <div className="flex items-center gap-2">
 *   <Checkbox id="terms" />
 *   <label htmlFor="terms">Accept terms</label>
 * </div>
 * ============================================================================
 */
const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      // Size (larger than typical for touch)
      'h-6 w-6',
      // Shape
      'rounded-md',
      // Border
      'border-2 border-primary',
      // Focus state
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      // Disabled state
      'disabled:cursor-not-allowed disabled:opacity-50',
      // Checked state (filled background)
      'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
      // Indeterminate state
      'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
      // Transitions
      'transition-colors duration-150',
      // Flex for centering the check icon
      'flex items-center justify-center',
      // Touch target (extends clickable area)
      'touch-action-manipulation',
      // Shrink prevention
      'shrink-0',
      className
    )}
    {...props}
  >
    {/*
      CHECKBOX INDICATOR
      The checkmark icon that appears when checked.
      Radix handles showing/hiding based on state.
    */}
    <CheckboxPrimitive.Indicator
      className={cn(
        // Fill available space
        'flex items-center justify-center',
        // Text color (inherited from parent)
        'text-current'
      )}
    >
      <Check className="h-4 w-4" strokeWidth={3} />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));

Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
