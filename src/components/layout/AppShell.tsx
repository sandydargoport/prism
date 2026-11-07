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

import { WhatsNew } from './WhatsNew';
import * as React from 'react';
import { Dock } from './Dock';
import { MobileFab } from './MobileFab';
import { WallpaperBackground } from './WallpaperBackground';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useAutoHideUI } from '@/lib/hooks/useAutoHideUI';
import { useInactivityRedirect } from '@/lib/hooks/useInactivityRedirect';
import { useNoRubberBand } from '@/lib/hooks/useNoRubberBand';

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
  /**
   * The wall (#922): in landscape on a larger screen, the rail gives way to
   * the dock, hidden at rest behind a Menu word. Portrait and phones keep
   * their own navigation for now (#924).
   */
  dock?: 'wall';
  /** This screen's jobs, for the dock's More panel. */
  screenJobs?: React.ReactNode;
  /** The phone menu's Cards and Reorder; off when the page has no cards (Simple's Today). */
  cardTools?: boolean;
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
  dock,
  screenJobs,
  cardTools = true,
}: AppShellProps) {
  const isMobile = useIsMobile();
  // Every phone page: no drag past the ends, none at all on a page that fits.
  useNoRubberBand(isMobile);
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

  // One navigation everywhere (#924): the wall's dock on a dashboard on a
  // larger screen, in either orientation; the dock on screen everywhere else,
  // phones included. The rail and the portrait bar are gone.
  const wallDock = dock === 'wall' && !isMobile;
  const pageDockShown = !hideNav && !wallDock && !measureHideNav;
  const showMobileNav = isMobile;

  return (
    <div
      className={cn('relative min-h-(--app-vh,100vh)', !showWallpaper && 'bg-background')}
      // The dock's height (68px, its 1rem gap and the safe area), for the page
      // to reserve and for anything else fixed at the foot to sit above (#923).
      style={pageDockShown ? ({ '--nav-bottom': 'calc(68px + 1.5rem + env(safe-area-inset-bottom, 0px))' } as React.CSSProperties) : undefined}
    >
      {/* WALLPAPER BACKGROUND (only on dashboard/screensaver) */}
      {showWallpaper && <WallpaperBackground />}

      {/* THE DOCK ON EVERY OTHER PAGE (#923) */}
      {pageDockShown && <Dock mode="page" user={user} onLogin={onLogin} onLogout={onLogout} />}

      {/* THE DOCK ON THE WALL (#922) */}
      {!hideNav && wallDock && !measureHideNav && (
        <Dock mode="wall" user={user} onLogin={onLogin} onLogout={onLogout} screenJobs={screenJobs} />
      )}

      {/* MAIN CONTENT AREA */}
      <main
        className={cn(
          'min-h-(--app-vh,100vh)',
          // Snap margin/padding when nav hides — animating layout properties causes
          // layout reflow on every frame, which is expensive on weak CPUs (Atom).
          // The nav itself slides smoothly via GPU-composited transform; the content
          // just needs to reflow once when the class changes.
          pageDockShown && 'pb-(--nav-bottom)',
          className
        )}
        // Height of the dock (68px plus its 1rem gap and the safe area).
        // Full-height pages size themselves with `h-page`, which subtracts it,
        // so nothing sits under the dock and a list's last row can always
        // scroll clear (#923).

      >
        {children}
      </main>

      {/* MOBILE FAB - the phone's own tools (cards, reorder, scan) */}
      {!hideNav && showMobileNav && (
        <MobileFab user={user} onLogin={onLogin} onLogout={onLogout} uiHidden={uiHidden || measureHideNav} cardTools={cardTools} />
      )}

      {/* Once per screen after an update (#1032). */}
      <WhatsNew />
    </div>
  );
}
