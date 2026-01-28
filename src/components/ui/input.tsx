/**
 * ============================================================================
 * PRISM - Input Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides a styled text input component for forms.
 * Used for entering text, numbers, dates, etc.
 *
 * FEATURES:
 * - Touch-friendly height (44px minimum)
 * - Clear focus states for accessibility
 * - Consistent styling with other form elements
 * - Supports all standard input types
 *
 * USAGE:
 *   <Input placeholder="Enter your name" />
 *   <Input type="email" value={email} onChange={handleChange} />
 *   <Input type="password" />
 *
 * ============================================================================
 */

import * as React from 'react';
import { cn } from '@/lib/utils';


/**
 * INPUT PROPS
 * ============================================================================
 * Extends standard HTML input attributes.
 * No additional props needed - we just style the native input.
 * ============================================================================
 */
export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;


/**
 * INPUT COMPONENT
 * ============================================================================
 * A styled text input that works with all standard input types.
 *
 * STYLING NOTES:
 * - Height is 44px (touch-friendly)
 * - Uses theme colors for consistency
 * - Focus ring matches our design system
 * - Disabled state is visually distinct
 *
 * @example Basic text input
 * <Input placeholder="Your name" />
 *
 * @example Controlled input
 * <Input
 *   type="email"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 * />
 *
 * @example With label
 * <label>
 *   Email
 *   <Input type="email" />
 * </label>
 * ============================================================================
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Layout
          'flex w-full',
          // Height (touch-friendly - 44px)
          'h-11',
          // Padding
          'px-3 py-2',
          // Border and background
          'border border-input bg-background',
          // Shape
          'rounded-md',
          // Typography
          'text-base',
          // Placeholder styling
          'placeholder:text-muted-foreground',
          // Focus state
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          // Disabled state
          'disabled:cursor-not-allowed disabled:opacity-50',
          // File input specific styling
          'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground',
          // Remove default appearance (for consistency across browsers)
          'appearance-none',
          // Touch optimization
          'touch-action-manipulation',
          // Custom classes
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

export { Input };
