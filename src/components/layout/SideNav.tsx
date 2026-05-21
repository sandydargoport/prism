/**
 *
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
 */

'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrismIcon } from '@/components/ui/PrismIcon';
import { ALL_NAV_ITEMS } from '@/lib/constants/navItems';
import { useHiddenPages } from '@/lib/hooks/useHiddenPages';

/**
 * SIDE NAV PROPS
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
  /** Callback when user wants to switch between family members */
  onSwitchUser?: () => void;
  /** Whether auto-hide has hidden the UI */
  uiHidden?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SIDE NAV COMPONENT
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
 */
export function SideNav({ user, onLogout, onLogin, onSwitchUser, uiHidden, className }: SideNavProps) {
  // Get current pathname for active state
  const pathname = usePathname();
  const { filterNavItems } = useHiddenPages();
  const navItems = filterNavItems(ALL_NAV_ITEMS);
  const [expanded, setExpanded] = React.useState(false);
  const asideRef = React.useRef<HTMLElement>(null);

  // Close drawer when clicking outside
  React.useEffect(() => {
    if (!expanded) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [expanded]);

  // Collapse on navigation
  React.useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  // Check if a nav item is active
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  // Toggle drawer on tap in blank area — skip if clicking a link or button
  const handleAsideClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) return;
    setExpanded(prev => !prev);
  };

  return (
    <>
      {/* SIDE NAVIGATION - visibility controlled by AppShell based on orientation */}
      <aside
        ref={asideRef}
        onClick={handleAsideClick}
        className={cn(
          'fixed left-0 top-0 z-40 h-screen',
          'bg-card/95',
          'flex flex-col',
          'transition-[transform,opacity,width] duration-300 ease-in-out',
          expanded ? 'w-60 shadow-xl' : 'w-16',
          uiHidden ? '-translate-x-full opacity-0 delay-100' : 'translate-x-0 opacity-100 delay-0',
          className
        )}
      >
        {/* HEADER WITH LOGO */}
        <div className={cn('flex items-center h-12 [@media(pointer:coarse)]:h-16 px-2', expanded ? 'justify-start' : 'justify-center')}>
          <Link href="/" className="flex items-center gap-2" aria-label="Prism home">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden">
              <PrismIcon size={24} />
            </div>
            {expanded && <span className="font-semibold text-lg">Prism</span>}
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
                    aria-label={item.label}
                    className={cn(
                      'flex items-center gap-3 px-3 py-1.5 [@media(pointer:coarse)]:py-2.5 rounded-lg',
                      'text-sm font-medium',
                      'transition-colors duration-200',
                      'touch-target',
                      active
                        ? 'bg-seasonal-accent text-seasonal-accent-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      expanded ? 'justify-start' : 'justify-center'
                    )}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {expanded && <span className="whitespace-nowrap">
                      {item.label}
                    </span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* HELP LINK */}
        <div className={cn('px-2 pb-1', expanded ? 'text-left' : 'text-center')}>
          <Link
            href="/help"
            aria-label="Help"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors',
              expanded ? 'justify-start' : 'justify-center'
            )}
          >
            <HelpCircle className="h-4 w-4 flex-shrink-0" />
            {expanded && <span>Help</span>}
          </Link>
        </div>

        {/* USER AVATAR AT BOTTOM */}
        <div className="p-2">
          <button
            onClick={user ? onSwitchUser || onLogout : onLogin}
            className={cn(
              'flex items-center gap-3 px-3 py-1.5 [@media(pointer:coarse)]:py-2.5 rounded-lg w-full',
              'text-sm font-medium',
              'transition-colors duration-200',
              'touch-target',
              'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              expanded ? 'justify-start' : 'justify-center'
            )}
            aria-label={user ? 'Switch user' : 'Log in'}
          >
            {user ? (
              <>
                <div
                  className="relative w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0"
                  style={{ backgroundColor: user.color || '#6B7280' }}
                >
                  {user.avatarUrl?.startsWith('emoji:') ? (
                    <span className="text-lg">{user.avatarUrl.slice(6)}</span>
                  ) : user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.name}
                      fill
                      unoptimized
                      className="rounded-full object-cover"
                    />
                  ) : (
                    user.name.charAt(0).toUpperCase()
                  )}
                </div>
                {expanded && <span className="whitespace-nowrap truncate">
                  {user.name}
                </span>}
              </>
            ) : (
              <>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500/10 border-2 border-dashed border-red-500 flex-shrink-0">
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
                    className="text-red-500"
                  >
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                {expanded && <span className="whitespace-nowrap text-red-500">
                  Log in
                </span>}
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

