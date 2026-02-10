/**
 *
 * Provides a custom scrollable container with styled scrollbars.
 * Used when content might overflow its container (task lists, messages, etc.).
 *
 * WHY CUSTOM SCROLLBARS:
 * - Consistent appearance across browsers
 * - Better touch scrolling on touchscreens
 * - Styled to match our design system
 * - Can be hidden when not needed
 *
 * FEATURES:
 * - Custom styled scrollbar
 * - Smooth scrolling
 * - Works with mouse and touch
 * - Accessible (keyboard navigation works)
 *
 * USAGE:
 *   <ScrollArea className="h-72">
 *     <div>Long content that scrolls...</div>
 *   </ScrollArea>
 *
 */

'use client';

import * as React from 'react';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { cn } from '@/lib/utils';


/**
 * SCROLL AREA
 * The main scrollable container.
 * Content that exceeds the container height will be scrollable.
 *
 * @example
 * <ScrollArea className="h-[300px]">
 *   <div className="space-y-4">
 *     {items.map(item => <Item key={item.id} />)}
 *   </div>
 * </ScrollArea>
 */
const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root>
>(({ className, children, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn(
      // Contain the scrollable area
      'relative overflow-hidden',
      className
    )}
    {...props}
  >
    {/*
      VIEWPORT
      The actual scrollable container.
      Content goes inside here.
    */}
    <ScrollAreaPrimitive.Viewport
      className={cn(
        // Fill the container
        'h-full w-full',
        // Round corners to match parent
        'rounded-[inherit]'
      )}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>

    {/* Vertical scrollbar */}
    <ScrollBar />

    {/* Corner piece (where scrollbars meet) */}
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;


/**
 * SCROLL BAR
 * The custom styled scrollbar.
 * Can be vertical or horizontal.
 *
 * STYLING:
 * - Thin by default (8px)
 * - Expands on hover
 * - Subtle colors that don't distract
 * - Rounded thumb
 */
const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = 'vertical', ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      // Flex container for the thumb
      'flex touch-none select-none transition-colors',
      // Orientation-specific styles
      orientation === 'vertical' && [
        // Vertical: positioned on the right
        'h-full w-2.5 border-l border-l-transparent p-[1px]',
      ],
      orientation === 'horizontal' && [
        // Horizontal: positioned on the bottom
        'h-2.5 flex-col border-t border-t-transparent p-[1px]',
      ],
      className
    )}
    {...props}
  >
    {/*
      THUMB
      The draggable part of the scrollbar.
      Size is automatically calculated based on content.
    */}
    <ScrollAreaPrimitive.ScrollAreaThumb
      className={cn(
        // Appearance
        'relative rounded-full bg-border',
        // Expand on interaction
        'hover:bg-muted-foreground/50',
        // Fill available space
        'flex-1'
      )}
    />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;


export { ScrollArea, ScrollBar };
