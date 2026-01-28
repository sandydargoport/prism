/**
 * ============================================================================
 * PRISM - App Shell Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
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
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { SideNav } from './SideNav';
import { cn } from '@/lib/utils';

/**
 * APP SHELL PROPS
 * ============================================================================
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
  /** Hide the side nav (for login/auth pages) */
  hideNav?: boolean;
  /** Additional CSS classes for main content area */
  className?: string;
}

/**
 * APP SHELL COMPONENT
 * ============================================================================
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
 * ============================================================================
 */
export function AppShell({
  children,
  user,
  onLogout,
  hideNav = false,
  className,
}: AppShellProps) {
  return (
    <div className="relative min-h-screen bg-background">
      {/* ==================================================================== */}
      {/* SIDE NAVIGATION */}
      {/* Only rendered if hideNav is false */}
      {/* ==================================================================== */}
      {!hideNav && <SideNav user={user} onLogout={onLogout} />}

      {/* ==================================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* Fixed margin for collapsed nav - nav expands as overlay on hover */}
      {/* ==================================================================== */}
      <main
        className={cn(
          // Base styles
          'min-h-screen',
          // Fixed left margin for collapsed nav (64px = 16 * 4 = md:ml-16)
          // Nav expands as overlay, doesn't push content
          !hideNav && 'md:ml-16',
          className
        )}
      >
        {children}
      </main>
    </div>
  );
}
