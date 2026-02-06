/**
 * ============================================================================
 * PRISM - Page Wrapper Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * A client component wrapper that adds the AppShell to pages.
 * This allows pages to easily integrate the side navigation.
 *
 * USAGE:
 *   'use client';
 *
 *   export function MyPageView() {
 *     return (
 *       <PageWrapper>
 *         <YourPageContent />
 *       </PageWrapper>
 *     );
 *   }
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { AppShell } from './AppShell';
import { useAuth } from '@/components/providers';
import { cn } from '@/lib/utils';

/**
 * PAGE WRAPPER PROPS
 * ============================================================================
 */
export interface PageWrapperProps {
  /** Page content */
  children: React.ReactNode;
  /** Hide the side nav (for special pages) */
  hideNav?: boolean;
  /** Show wallpaper background (default false - only for dashboard/screensaver) */
  showWallpaper?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * PAGE WRAPPER COMPONENT
 * ============================================================================
 * Wraps page content with the AppShell.
 *
 * Uses the AuthProvider context to get current user state.
 *
 * @example
 * <PageWrapper>
 *   <CalendarView />
 * </PageWrapper>
 * ============================================================================
 */
export function PageWrapper({
  children,
  hideNav = false,
  showWallpaper = false,
  className,
}: PageWrapperProps) {
  // Get auth state from context
  const { activeUser, requireAuth, clearActiveUser } = useAuth();

  return (
    <AppShell
      user={activeUser ? {
        id: activeUser.id,
        name: activeUser.name,
        avatarUrl: activeUser.avatarUrl,
        color: activeUser.color,
      } : undefined}
      onLogout={activeUser ? clearActiveUser : undefined}
      onLogin={() => requireAuth('Login', 'Select your profile')}
      hideNav={hideNav}
      showWallpaper={showWallpaper}
      className={cn(className)}
    >
      {children}
    </AppShell>
  );
}
