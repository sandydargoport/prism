/**
 * ============================================================================
 * PRISM - Avatar Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Displays user profile pictures with fallback initials.
 * Used throughout the app to identify family members.
 *
 * FEATURES:
 * - Shows profile image if available
 * - Falls back to initials if no image
 * - Falls back to a generic icon if no initials
 * - Multiple sizes for different contexts
 * - Customizable colors per family member
 *
 * USAGE:
 *   // With image
 *   <Avatar>
 *     <AvatarImage src="/avatars/alex.jpg" alt="Alex" />
 *     <AvatarFallback>E</AvatarFallback>
 *   </Avatar>
 *
 *   // With custom color fallback
 *   <Avatar>
 *     <AvatarFallback style={{ backgroundColor: '#3B82F6' }}>
 *       K
 *     </AvatarFallback>
 *   </Avatar>
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cn } from '@/lib/utils';


/**
 * AVATAR
 * ============================================================================
 * The root container for the avatar.
 * Sets the size and shape.
 * ============================================================================
 */
const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn(
      // Size (default 40x40)
      'h-10 w-10',
      // Shape (circle)
      'rounded-full',
      // Flex for centering fallback content
      'relative flex shrink-0 overflow-hidden',
      className
    )}
    {...props}
  />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;


/**
 * AVATAR IMAGE
 * ============================================================================
 * The profile picture.
 * Automatically shows/hides based on load status.
 * ============================================================================
 */
const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn(
      // Fill the container
      'aspect-square h-full w-full',
      // Cover to maintain aspect ratio
      'object-cover',
      className
    )}
    {...props}
  />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;


/**
 * AVATAR FALLBACK
 * ============================================================================
 * Shown when there's no image or it fails to load.
 * Usually displays initials or an icon.
 *
 * RADIX BEHAVIOR:
 * - Hidden while image is loading
 * - Shows after a short delay if image fails
 * - This prevents flickering during normal image loads
 * ============================================================================
 */
const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      // Fill the container
      'flex h-full w-full items-center justify-center',
      // Shape
      'rounded-full',
      // Default background (can be overridden with style prop)
      'bg-muted',
      // Text styling
      'text-sm font-medium',
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;


// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Get initials from a name
 *
 * @param name - Full name (e.g., "Alex Smith")
 * @returns Initials (e.g., "ES")
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}


/**
 * USER AVATAR
 * ============================================================================
 * A convenience component that handles the common case of showing
 * a user's avatar with their image or initials.
 *
 * @example
 * <UserAvatar
 *   name="Alex"
 *   imageUrl="/avatars/alex.jpg"
 *   color="#3B82F6"
 *   size="lg"
 * />
 * ============================================================================
 */
interface UserAvatarProps {
  /** User's name (used for fallback initials and alt text) */
  name: string;
  /** URL to the user's avatar image */
  imageUrl?: string | null;
  /** Background color for the fallback (hex format) */
  color?: string;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

export function UserAvatar({
  name,
  imageUrl,
  color,
  size = 'md',
  className,
}: UserAvatarProps) {
  const initials = getInitials(name);

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      {imageUrl && (
        <AvatarImage src={imageUrl} alt={name} />
      )}
      <AvatarFallback
        style={color ? { backgroundColor: color, color: 'white' } : undefined}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}


export { Avatar, AvatarImage, AvatarFallback };
