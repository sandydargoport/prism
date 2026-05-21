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
import { MobileFab } from './MobileFab';
import { PortraitNav } from './PortraitNav';
import { WallpaperBackground } from './WallpaperBackground';
import { cn } from '@/lib/utils';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useAutoHideUI } from '@/lib/hooks/useAutoHideUI';
import { useInactivityRedirect } from '@/lib/hooks/useInactivityRedirect';

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
  /** Callback when user wants to switch between family members */
  onSwitchUser?: () => void;
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
  onSwitchUser,
  hideNav = false,
  showWallpaper = false,
  className,
}: AppShellProps) {
  const orientation = useOrientation();
  const isMobile = useIsMobile();
  const { uiHidden } = useAutoHideUI();
  useInactivityRedirect();
  const [measureHideNav, setMeasureHideNav] = React.useState(false);

  // Listen for measure mode toggle from LayoutEditor
  React.useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      // Support both old boolean format and new {active, hideNav} format
      if (typeof d === 'boolean') {
        setMeasureHideNav(d);
      } else {
        setMeasureHideNav(d.active && d.hideNav);
      }
    };
    window.addEventListener('prism:measure-mode', handler);
    return () => window.removeEventListener('prism:measure-mode', handler);
  }, []);

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
        <SideNav user={user} onLogout={onLogout} onLogin={onLogin} onSwitchUser={onSwitchUser} uiHidden={uiHidden || measureHideNav} />
      )}

      {/* MAIN CONTENT AREA */}
      <main
        className={cn(
          'min-h-screen',
          // Snap margin/padding when nav hides — animating layout properties causes
          // layout reflow on every frame, which is expensive on weak CPUs (Atom).
          // The nav itself slides smoothly via GPU-composited transform; the content
          // just needs to reflow once when the class changes.
          !hideNav && showSideNav && !measureHideNav && !uiHidden && 'ml-16',
          !hideNav && showPortraitNav && !measureHideNav && !uiHidden && 'pb-24',
          className
        )}
      >
        {children}
      </main>

      {/* PORTRAIT BOTTOM NAVIGATION - portrait mode on larger screens */}
      {!hideNav && showPortraitNav && (
        <PortraitNav user={user} onLogin={onLogin} onLogout={onLogout} onSwitchUser={onSwitchUser} uiHidden={uiHidden || measureHideNav} />
      )}

      {/* MOBILE FAB - small screens only */}
      {!hideNav && showMobileNav && (
        <MobileFab user={user} onLogin={onLogin} onLogout={onLogout} onSwitchUser={onSwitchUser} uiHidden={uiHidden || measureHideNav} />
      )}
    </div>
  );
}
