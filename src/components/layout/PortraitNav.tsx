/**
 * Portrait Bottom Navigation
 *
 * A bottom navigation bar for portrait mode on web (tablets/desktop).
 * Shows all navigation items in a horizontally scrollable row, centered.
 */

'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_NAV_ITEMS } from '@/lib/constants/navItems';
import { useHiddenPages } from '@/lib/hooks/useHiddenPages';

export interface PortraitNavProps {
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  onLogin?: () => void;
  onLogout?: () => void;
  onSwitchUser?: () => void;
  uiHidden?: boolean;
}

export function PortraitNav({ user, onLogin, onLogout, onSwitchUser, uiHidden }: PortraitNavProps) {
  const pathname = usePathname();
  const { filterNavItems } = useHiddenPages();
  const navItems = filterNavItems(ALL_NAV_ITEMS);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className={cn(
      'fixed bottom-0 left-0 right-0 bg-card/95 border-t border-border z-40 safe-area-bottom',
      'transition-[transform,opacity] duration-300 ease-in-out',
      uiHidden ? 'translate-y-full opacity-0 delay-100' : 'translate-y-0 opacity-100 delay-0'
    )}>
      <div className="flex items-center justify-center h-20 overflow-x-auto scrollbar-none px-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 py-2 px-4 min-w-[72px] shrink-0 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className={cn('h-7 w-7', active && 'stroke-[2.5]')} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}

        {/* User/Login button */}
        <button
          onClick={user ? onSwitchUser || onLogout : onLogin}
          className={cn(
            'flex flex-col items-center gap-1 py-2 px-4 min-w-[72px] shrink-0 transition-colors',
            'text-muted-foreground hover:text-foreground'
          )}
          aria-label={user ? 'Switch user' : 'Log in'}
        >
          {user ? (
            <>
              <div
                className="relative h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: user.color || '#6B7280' }}
              >
                {user.avatarUrl?.startsWith('emoji:') ? (
                  <span className="text-base">{user.avatarUrl.slice(6)}</span>
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
              <span className="text-xs font-medium truncate max-w-[72px]">{user.name}</span>
            </>
          ) : (
            <>
              <User className="h-7 w-7 text-red-500" />
              <span className="text-xs font-medium text-red-500">Login</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
