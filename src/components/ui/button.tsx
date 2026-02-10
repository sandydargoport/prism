/**
 *
 * Provides a reusable, accessible button component with multiple variants.
 * This is one of the most-used components in any application.
 *
 * DESIGN PHILOSOPHY:
 * - Touch-friendly: Minimum 44px height for easy tapping
 * - Accessible: Proper focus states, ARIA support
 * - Flexible: Multiple sizes and variants for different contexts
 * - Consistent: Uses our design tokens (colors, spacing, radius)
 *
 * VARIANTS EXPLAINED:
 * - default: Primary action buttons (main CTAs)
 * - secondary: Less prominent actions
 * - destructive: Delete, remove, cancel actions (red)
 * - outline: Bordered buttons for secondary actions
 * - ghost: Minimal buttons for toolbars, icon buttons
 * - link: Text-only buttons that look like links
 *
 * USAGE:
 *   <Button>Click me</Button>
 *   <Button variant="destructive">Delete</Button>
 *   <Button size="lg" disabled>Loading...</Button>
 *
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';


/**
 * BUTTON VARIANTS
 * Uses class-variance-authority (cva) to manage variant styles.
 *
 * cva creates a function that returns the right classes based on props.
 * This is cleaner than writing complex conditional class logic.
 *
 * STRUCTURE:
 * cva(baseClasses, { variants: { variantName: { value: classes } } })
 */
const buttonVariants = cva(
  // BASE CLASSES - Applied to ALL buttons
  [
    // Layout
    'inline-flex items-center justify-center gap-2',
    // Typography
    'text-sm font-medium whitespace-nowrap',
    // Shape
    'rounded-md',
    // Transitions (smooth hover/focus effects)
    'transition-colors duration-200',
    // Focus state (accessibility)
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    // Disabled state
    'disabled:pointer-events-none disabled:opacity-50',
    // Touch optimization
    'touch-action-manipulation',
    // Icon sizing (when icons are children)
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      /**
       * VARIANT - Visual style of the button
       */
      variant: {
        // Primary action - most prominent
        default:
          'bg-primary text-primary-foreground shadow hover:bg-primary/90 active:bg-primary/80',

        // Destructive action - delete, remove, etc.
        destructive:
          'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 active:bg-destructive/80',

        // Secondary action - less prominent than default
        secondary:
          'bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 active:bg-secondary/70',

        // Outlined button - bordered, transparent background
        outline:
          'border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground active:bg-accent/80',

        // Ghost button - minimal, for toolbars and icon buttons
        ghost:
          'hover:bg-accent hover:text-accent-foreground active:bg-accent/80',

        // Link button - looks like a text link
        link:
          'text-primary underline-offset-4 hover:underline',
      },

      /**
       * SIZE - Dimensions of the button
       * All sizes meet touch target guidelines (minimum 44px)
       */
      size: {
        // Default size - good for most uses
        default: 'h-10 px-4 py-2',

        // Small size - for compact UIs (still touch-friendly at 36px)
        sm: 'h-9 rounded-md px-3 text-xs',

        // Large size - for primary CTAs, easier to tap
        lg: 'h-12 rounded-md px-8 text-base',

        // Icon button - square, for icon-only buttons
        icon: 'h-10 w-10',

        // Touch-optimized - extra large for wall-mounted displays
        touch: 'h-14 px-6 text-base',
      },
    },

    // DEFAULT VALUES - Used when props aren't specified
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);


/**
 * BUTTON PROPS
 * Combines:
 * - Standard HTML button attributes
 * - Our custom variant props
 * - asChild prop for composition
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /**
   * When true, the button renders its child as the root element.
   * Useful for wrapping other components (like Link) with button styles.
   *
   * @example
   * <Button asChild>
   *   <Link href="/home">Go Home</Link>
   * </Button>
   */
  asChild?: boolean;
}


/**
 * BUTTON COMPONENT
 * The main button component used throughout the application.
 *
 * FEATURES:
 * - Multiple visual variants
 * - Multiple sizes
 * - Proper accessibility (focus, disabled states)
 * - Touch-optimized
 * - Composable with asChild
 *
 * @example Basic usage
 * <Button>Click me</Button>
 *
 * @example With variant and size
 * <Button variant="outline" size="lg">
 *   Large Outline Button
 * </Button>
 *
 * @example As a link
 * <Button asChild variant="link">
 *   <Link href="/about">Learn More</Link>
 * </Button>
 *
 * @example With icon
 * <Button>
 *   <PlusIcon /> Add Item
 * </Button>
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    // If asChild is true, render the child element with button styles
    // Otherwise, render a <button> element
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);

// Display name for React DevTools
Button.displayName = 'Button';

// Export component and variants for use elsewhere
export { Button, buttonVariants };
