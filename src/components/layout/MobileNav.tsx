/**
 * Mobile Bottom Navigation
 *
 * A thumb-friendly bottom navigation bar for mobile PWA use.
 * Shows only on mobile screens (hidden on md: and up).
 * Excludes Dashboard and Screensaver since these are desktop-focused.
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShoppingCart,
  CheckSquare,
  ClipboardList,
  MessageSquare,
  MoreHorizontal,
  UtensilsCrossed,
  Trophy,
  X,
  Sun,
  Moon,
  Monitor,
  User,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/providers/ThemeProvider';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface MobileNavProps {
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  onLogin?: () => void;
  onLogout?: () => void;
}

// Primary items shown in bottom bar (most used for companion app)
// Note: Chores and Goals removed from mobile - these are kiosk-focused features
const primaryItems: NavItem[] = [
  { label: 'Shopping', href: '/shopping', icon: ShoppingCart },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Meals', href: '/meals', icon: UtensilsCrossed },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
];

// Secondary items shown in "More" menu (empty now, but kept for future use)
const secondaryItems: NavItem[] = [];

export function MobileNav({ user, onLogin, onLogout }: MobileNavProps) {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const { theme, setTheme } = useTheme();

  // Check if current path is in secondary items
  const isSecondaryActive = secondaryItems.some(item => pathname === item.href);

  // Cycle through themes: light → dark → system → light
  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const themeLabel = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto';

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More menu panel */}
      {showMore && (
        <div className="fixed bottom-16 left-0 right-0 bg-card border-t border-border z-50 animate-in slide-in-from-bottom-4">
          <div className="grid grid-cols-3 gap-1 p-2">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className={cn(
                    'flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
                </Link>
              );
            })}
            {/* Theme toggle */}
            <button
              onClick={cycleTheme}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-colors text-muted-foreground hover:bg-accent"
            >
              <ThemeIcon className="h-5 w-5" />
              <span className="text-xs">{themeLabel}</span>
            </button>
            {/* Login/Logout button */}
            <button
              onClick={() => {
                setShowMore(false);
                user ? onLogout?.() : onLogin?.();
              }}
              className="flex flex-col items-center gap-1 py-3 px-2 rounded-lg transition-colors text-muted-foreground hover:bg-accent"
            >
              {user ? (
                <>
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: user.color || '#6B7280' }}
                  >
                    {user.avatarUrl?.startsWith('emoji:') ? (
                      <span className="text-sm">{user.avatarUrl.slice(6)}</span>
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
                  <span className="text-xs">Logout</span>
                </>
              ) : (
                <>
                  <User className="h-5 w-5" />
                  <span className="text-xs">Login</span>
                </>
              )}
            </button>
          </div>
          <button
            onClick={() => setShowMore(false)}
            className="w-full py-3 text-center text-sm text-muted-foreground border-t border-border hover:bg-accent"
          >
            <X className="h-4 w-4 inline mr-1" />
            Close
          </button>
        </div>
      )}

      {/* Bottom navigation bar - visibility controlled by AppShell */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('h-6 w-6', isActive && 'stroke-[2.5]')} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 px-3 min-w-[64px] transition-colors',
              (showMore || isSecondaryActive)
                ? 'text-primary'
                : 'text-muted-foreground'
            )}
          >
            <MoreHorizontal className={cn('h-6 w-6', (showMore || isSecondaryActive) && 'stroke-[2.5]')} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
