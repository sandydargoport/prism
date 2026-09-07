/**
 *
 * Provides card components for containing and organizing content.
 * Cards are the primary container for widgets on the dashboard.
 *
 * COMPONENT STRUCTURE:
 * Card components are composable - mix and match as needed:
 *
 *   <Card>
 *     <CardHeader>
 *       <CardTitle>Title</CardTitle>
 *       <CardDescription>Subtitle</CardDescription>
 *     </CardHeader>
 *     <CardContent>
 *       Main content goes here
 *     </CardContent>
 *     <CardFooter>
 *       Actions or metadata
 *     </CardFooter>
 *   </Card>
 *
 * DESIGN NOTES:
 * - Uses subtle shadows for depth without being distracting
 * - Rounded corners for a friendly feel
 * - Consistent padding throughout
 * - Works in both light and dark modes
 *
 */

import * as React from 'react';
import { cn } from '@/lib/utils';


/**
 * CARD
 * The main container component. Provides background, border, and shadow.
 *
 * @example
 * <Card>
 *   <CardContent>Simple card with just content</CardContent>
 * </Card>
 */
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Background and border
      'bg-card/85 backdrop-blur-sm text-card-foreground',
      // Border and rounding come from the active theme rather than a fixed
      // utility. A theme that wants a square, heavily outlined look has to
      // reach the surface people actually see, and on a dashboard that is
      // the card.
      'border-border border-[length:var(--border-width,1px)]',
      'rounded-[var(--radius,0.5rem)]',
      // Depth comes from the theme too. A flat look is not "a card with a
      // smaller shadow" — it is the difference between reading as software and
      // reading as a board on a wall, which is most of what separates a
      // dashboard from a wall display.
      'shadow-[var(--surface-shadow)]',
      // Allow custom classes to override
      className
    )}
    {...props}
  />
));
Card.displayName = 'Card';


/**
 * CARD HEADER
 * Container for the card's title and description.
 * Includes consistent padding and spacing.
 *
 * @example
 * <CardHeader>
 *   <CardTitle>Weather</CardTitle>
 *   <CardDescription>Current conditions</CardDescription>
 * </CardHeader>
 */
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Flex column for title + description
      'flex flex-col space-y-1.5',
      // Padding
      'p-[calc(1rem*var(--density,1))] pb-0',
      className
    )}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';


/**
 * CARD TITLE
 * The main heading for the card.
 * Uses semantic heading element for accessibility.
 *
 * @example
 * <CardTitle>Today's Tasks</CardTitle>
 */
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      // Typography
      'text-lg font-semibold leading-none tracking-tight',
      className
    )}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';


/**
 * CARD DESCRIPTION
 * Secondary text below the title.
 * Uses muted color for visual hierarchy.
 *
 * @example
 * <CardDescription>5 tasks remaining</CardDescription>
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn(
      // Typography
      'text-sm text-muted-foreground',
      className
    )}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';


/**
 * CARD CONTENT
 * Main content area of the card.
 * Most of your content goes here.
 *
 * @example
 * <CardContent>
 *   <p>Your content here...</p>
 * </CardContent>
 */
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Padding (top padding is smaller because header has padding)
      'p-[calc(1rem*var(--density,1))] pt-2',
      className
    )}
    {...props}
  />
));
CardContent.displayName = 'CardContent';


/**
 * CARD FOOTER
 * Bottom section for actions or metadata.
 * Items are aligned horizontally by default.
 *
 * @example
 * <CardFooter>
 *   <Button>Save</Button>
 *   <Button variant="outline">Cancel</Button>
 * </CardFooter>
 */
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Flex row with spacing
      'flex items-center gap-2',
      // Padding
      'p-[calc(1rem*var(--density,1))] pt-0',
      className
    )}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';


// Export all components
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
};
