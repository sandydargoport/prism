/**
 *
 * Provides the main application shell that wraps all pages.
 * Includes the side navigation and adjusts the main content area accordingly.
 *
 * LAYOUT STRUCTURE:
 * ┌──────────┬───────────────────────────────┐
 * │          │                               │
 * │          │                               │
 * │   Side   │       Main Content            │
 * │   Nav    │       (children)              │
 * │          │                               │
 * │          │                               │
 * └──────────┴───────────────────────────────┘
 *
 * USAGE:
 *   <AppShell user={currentUser} onLogout={handleLogout}>
 *     <YourPageContent />
 *   </AppShell>
 *
 */

'use client';

import * as React from 'react';
import { SideNav } from './SideNav';
import { MobileNav } from './MobileNav';
import { PortraitNav } from './PortraitNav';
import { WallpaperBackground } from './WallpaperBackground';
import { cn } from '@/lib/utils';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';

/**
 * APP SHELL PROPS
 */
export interface AppShellProps {
  /** Page content */
  children: React.ReactNode;
  /** Current user information */
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  /** Callback when logout is clicked */
  onLogout?: () => void;
  /** Callback when login is clicked */
  onLogin?: () => void;
  /** Hide the side nav (for login/auth pages) */
  hideNav?: boolean;
  /** Show wallpaper background (only for dashboard/screensaver) */
  showWallpaper?: boolean;
  /** Additional CSS classes for main content area */
  className?: string;
}

/**
 * APP SHELL COMPONENT
 * The main application layout component.
 *
 * RESPONSIVE BEHAVIOR:
 * - Desktop: Side nav always visible in collapsed state, content uses fixed margin
 * - Mobile: Side nav hidden by default, accessible via hamburger
 *
 * NOTE: Content does NOT resize when hovering/clicking nav items.
 * Only the hamburger menu toggle controls whether nav is permanently expanded.
 *
 * NAVIGATION VISIBILITY:
 * Set hideNav={true} for pages that shouldn't show navigation (like login).
 *
 * @example Basic usage
 * <AppShell user={currentUser}>
 *   <Dashboard />
 * </AppShell>
 *
 * @example Without navigation (login page)
 * <AppShell hideNav>
 *   <LoginPage />
 * </AppShell>
 */
export function AppShell({
  children,
  user,
  onLogout,
  onLogin,
  hideNav = false,
  showWallpaper = false,
  className,
}: AppShellProps) {
  const orientation = useOrientation();
  const isMobile = useIsMobile();

  // Determine which nav to show:
  // - Mobile (small screens): MobileNav (simplified)
  // - Larger screens in landscape: SideNav
  // - Larger screens in portrait: PortraitNav (bottom drawer)
  const showSideNav = !isMobile && orientation === 'landscape';
  const showPortraitNav = !isMobile && orientation === 'portrait';
  const showMobileNav = isMobile;

  return (
    <div className={cn('relative min-h-screen', !showWallpaper && 'bg-background')}>
      {/* WALLPAPER BACKGROUND (only on dashboard/screensaver) */}
      {showWallpaper && <WallpaperBackground />}

      {/* SIDE NAVIGATION - landscape mode on larger screens */}
      {!hideNav && showSideNav && (
        <SideNav user={user} onLogout={onLogout} onLogin={onLogin} />
      )}

      {/* MAIN CONTENT AREA */}
      <main
        className={cn(
          'min-h-screen relative z-10',
          // Left margin only when SideNav is visible (landscape on larger screens)
          !hideNav && showSideNav && 'ml-16',
          // Bottom padding when bottom nav is visible (portrait or mobile)
          !hideNav && showPortraitNav && 'pb-24',
          !hideNav && showMobileNav && 'pb-16',
          className
        )}
      >
        {children}
      </main>

      {/* PORTRAIT BOTTOM NAVIGATION - portrait mode on larger screens */}
      {!hideNav && showPortraitNav && <PortraitNav user={user} onLogin={onLogin} onLogout={onLogout} />}

      {/* MOBILE BOTTOM NAVIGATION - small screens only */}
      {!hideNav && showMobileNav && <MobileNav user={user} onLogin={onLogin} onLogout={onLogout} />}
    </div>
  );
}
