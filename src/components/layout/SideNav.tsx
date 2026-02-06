/**
 * ============================================================================
 * PRISM - Side Navigation Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Provides a persistent side navigation bar that appears on all pages.
 * The nav includes links to all main sections and user profile controls.
 *
 * FEATURES:
 * - Collapsible design (icons only or expanded with text)
 * - Active page highlighting
 * - User avatar with logout option at bottom
 * - Touch-optimized for tablets
 * - Remembers collapsed/expanded state
 * - Smooth transitions
 *
 * USAGE:
 *   <SideNav
 *     currentPath="/calendar"
 *     user={currentUser}
 *     onLogout={() => handleLogout()}
 *   />
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  CheckSquare,
  ClipboardList,
  ShoppingCart,
  UtensilsCrossed,
  MessageSquare,
  ImageIcon,
  Settings,
  Trophy,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * SIDE NAV PROPS
 * ============================================================================
 */
export interface SideNavProps {
  /** Current user information */
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  /** Callback when logout is clicked */
  onLogout?: () => void;
  /** Callback when login is clicked (when no user) */
  onLogin?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * NAV ITEM CONFIGURATION
 * ============================================================================
 * Defines all navigation items with their icons, labels, and routes.
 * ============================================================================
 */
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Chores', href: '/chores', icon: ClipboardList },
  { label: 'Goals', href: '/goals', icon: Trophy },
  { label: 'Shopping', href: '/shopping', icon: ShoppingCart },
  { label: 'Meals', href: '/meals', icon: UtensilsCrossed },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Photos', href: '/photos', icon: ImageIcon },
  { label: 'Settings', href: '/settings', icon: Settings },
];

/**
 * SIDE NAV COMPONENT
 * ============================================================================
 * The main side navigation component.
 *
 * RESPONSIVE BEHAVIOR:
 * - Desktop: Always visible, can collapse/expand
 * - Mobile: Hidden by default, shows via hamburger menu
 *
 * STATE MANAGEMENT:
 * - Collapsed state saved to localStorage
 * - Mobile menu state tracked separately
 *
 * @example
 * <SideNav
 *   user={currentUser}
 *   onLogout={() => setCurrentUser(null)}
 * />
 * ============================================================================
 */
export function SideNav({ user, onLogout, onLogin, className }: SideNavProps) {
  // Get current pathname for active state
  const pathname = usePathname();

  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Check if a nav item is active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* MOBILE HAMBURGER BUTTON */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </Button>

      {/* MOBILE OVERLAY */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* SIDE NAVIGATION */}
      <aside
        className={cn(
          'group fixed left-0 top-0 z-40 h-screen',
          'bg-card/85 backdrop-blur-sm border-r border-border',
          'flex flex-col',
          'transition-all duration-300 ease-in-out',
          'w-16',
          'hover:w-60',
          'hover:shadow-xl',
          'max-md:transform',
          mobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
          'max-md:w-60',
          className
        )}
      >
        {/* HEADER WITH LOGO */}
        <div className="flex items-center h-16 px-2 border-b border-border justify-center group-hover:justify-start">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0 overflow-hidden">
              <PrismIcon />
            </div>
            <span className="hidden group-hover:inline font-semibold text-lg">Prism</span>
          </Link>
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                      'text-sm font-medium',
                      'transition-colors duration-200',
                      'touch-target',
                      active
                        ? 'bg-seasonal-accent text-seasonal-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      'justify-center group-hover:justify-start'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    <span className="hidden group-hover:inline whitespace-nowrap">
                      {item.label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* USER AVATAR AT BOTTOM */}
        <div className="border-t border-border p-2">
          <button
            onClick={user ? onLogout : onLogin}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg w-full',
              'text-sm font-medium',
              'transition-colors duration-200',
              'touch-target',
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              'justify-center group-hover:justify-start'
            )}
            aria-label={user ? 'Log out' : 'Log in'}
          >
            {user ? (
              <>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0"
                  style={{ backgroundColor: user.color || '#6B7280' }}
                >
                  {user.avatarUrl?.startsWith('emoji:') ? (
                    <span className="text-lg">{user.avatarUrl.slice(6)}</span>
                  ) : user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                <span className="hidden group-hover:inline whitespace-nowrap truncate">
                  {user.name}
                </span>
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted border-2 border-dashed border-muted-foreground/50 flex-shrink-0">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted-foreground"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <span className="hidden group-hover:inline whitespace-nowrap text-muted-foreground">
                  Log in
                </span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function PrismIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="drop-shadow-sm"
    >
      {/* Icosidodecahedron-inspired gem shape with facets */}
      {/* Main center facet */}
      <path
        d="M12 4L7 9L12 14L17 9L12 4Z"
        className="fill-slate-600 dark:fill-slate-200 stroke-slate-800 dark:stroke-white"
        strokeWidth="0.5"
      />
      {/* Left facet */}
      <path
        d="M7 9L4 13L9 18L12 14L7 9Z"
        className="fill-slate-700 dark:fill-slate-300 stroke-slate-800 dark:stroke-white"
        strokeWidth="0.5"
      />
      {/* Right facet */}
      <path
        d="M17 9L20 13L15 18L12 14L17 9Z"
        className="fill-slate-500 dark:fill-slate-100 stroke-slate-800 dark:stroke-white"
        strokeWidth="0.5"
      />
      {/* Bottom facet */}
      <path
        d="M12 14L9 18L12 21L15 18L12 14Z"
        className="fill-slate-600 dark:fill-slate-200 stroke-slate-800 dark:stroke-white"
        strokeWidth="0.5"
      />
      {/* Light beam entering */}
      <path
        d="M1 7L6 10"
        className="stroke-slate-500 dark:stroke-white/60"
        strokeWidth="1"
        strokeLinecap="round"
      />
      {/* Rainbow spectrum rays */}
      <path d="M18 10L23 6" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 12L23 9" stroke="#F97316" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19.5 14L23 12" stroke="#EAB308" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M19 16L23 15" stroke="#22C55E" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 18L22 18" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 19.5L21 21" stroke="#8B5CF6" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
