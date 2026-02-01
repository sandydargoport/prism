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
  Sparkles,
  ShoppingCart,
  UtensilsCrossed,
  MessageSquare,
  ImageIcon,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  { label: 'Chores', href: '/chores', icon: Sparkles },
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
export function SideNav({ user, onLogout, className }: SideNavProps) {
  // Get current pathname for active state
  const pathname = usePathname();
  const { requireAuth, setActiveUser } = useAuth();

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
      {/* ====================================================================== */}
      {/* MOBILE HAMBURGER BUTTON */}
      {/* Shows on small screens to open the mobile menu */}
      {/* ====================================================================== */}
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

      {/* ====================================================================== */}
      {/* MOBILE OVERLAY */}
      {/* Dark overlay behind mobile menu */}
      {/* ====================================================================== */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ====================================================================== */}
      {/* SIDE NAVIGATION */}
      {/* Main navigation component - expands as overlay on hover */}
      {/* ====================================================================== */}
      <aside
        className={cn(
          // Base styles
          'group fixed left-0 top-0 z-40 h-screen',
          'bg-card border-r border-border',
          'flex flex-col',
          'transition-all duration-300 ease-in-out',
          // Default to collapsed width
          'w-16',
          // On hover, expand to full width (as overlay, doesn't push content)
          'hover:w-60',
          // Shadow when expanded to show it's overlaying
          'hover:shadow-xl',
          // Mobile: slide in from left
          'max-md:transform',
          mobileMenuOpen ? 'max-md:translate-x-0' : 'max-md:-translate-x-full',
          // When mobile menu is open, use full width for easier touch
          'max-md:w-60',
          className
        )}
      >
        {/* ================================================================== */}
        {/* HEADER WITH LOGO */}
        {/* ================================================================== */}
        <div className="flex items-center h-16 px-4 border-b border-border justify-center group-hover:justify-start">
          {/* Logo/Brand - show K when collapsed, Prism when expanded */}
          <Link
            href="/"
            className="font-bold text-xl text-primary"
          >
            <span className="group-hover:hidden">K</span>
            <span className="hidden group-hover:inline">Prism</span>
          </Link>
        </div>

        {/* ================================================================== */}
        {/* NAVIGATION LINKS */}
        {/* ================================================================== */}
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
                      // Base styles
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                      'text-sm font-medium',
                      'transition-colors duration-200',
                      'touch-target',
                      // Active state
                      active
                        ? 'bg-seasonal-accent text-seasonal-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      // Center icon when collapsed
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

        {/* ================================================================== */}
        {/* FOOTER WITH USER INFO */}
        {/* ================================================================== */}
        <div className="border-t border-border p-4">
          {/* User section */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={cn(
                    'flex items-center gap-3 w-full p-2 rounded-lg',
                    'hover:bg-accent transition-colors',
                    'touch-target',
                    'justify-center group-hover:justify-start'
                  )}
                >
                  <UserAvatar
                    name={user.name}
                    imageUrl={user.avatarUrl}
                    color={user.color}
                    size="md"
                  />
                  <div className="hidden group-hover:flex flex-col items-start flex-1 min-w-0">
                    <span className="text-sm font-medium truncate w-full">
                      {user.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      View profile
                    </span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                {onLogout && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      Logout
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            // No user logged in - clickable to trigger login
            <button
              onClick={async () => {
                const authedUser = await requireAuth('Login', 'Select your profile and enter your PIN');
                if (authedUser) {
                  setActiveUser(authedUser);
                }
              }}
              className={cn(
                'flex items-center gap-3 w-full p-2 rounded-lg',
                'hover:bg-accent transition-colors',
                'touch-target',
                'justify-center group-hover:justify-start'
              )}
            >
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <LogOut className="h-4 w-4 text-muted-foreground rotate-180" />
              </div>
              <span className="hidden group-hover:inline text-sm text-muted-foreground">
                Login
              </span>
            </button>
          )}
        </div>
      </aside>
    </>
  );
}
