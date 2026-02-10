/**
 * Portrait Bottom Navigation
 *
 * A bottom navigation bar for portrait mode on web (tablets/desktop).
 * Shows all navigation items in a horizontally scrollable row, centered.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Calendar,
  CheckSquare,
  ClipboardList,
  ShoppingCart,
  UtensilsCrossed,
  ChefHat,
  MessageSquare,
  ImageIcon,
  Settings,
  Trophy,
  Baby,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface PortraitNavProps {
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
    color?: string;
  } | null;
  onLogin?: () => void;
  onLogout?: () => void;
}

const navItems: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Calendar', href: '/calendar', icon: Calendar },
  { label: 'Tasks', href: '/tasks', icon: CheckSquare },
  { label: 'Chores', href: '/chores', icon: ClipboardList },
  { label: 'Goals', href: '/goals', icon: Trophy },
  { label: 'Shopping', href: '/shopping', icon: ShoppingCart },
  { label: 'Meals', href: '/meals', icon: UtensilsCrossed },
  { label: 'Recipes', href: '/recipes', icon: ChefHat },
  { label: 'Messages', href: '/messages', icon: MessageSquare },
  { label: 'Photos', href: '/photos', icon: ImageIcon },
  { label: 'Babysitter', href: '/babysitter', icon: Baby },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function PortraitNav({ user, onLogin, onLogout }: PortraitNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border z-40 safe-area-bottom">
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
          onClick={user ? onLogout : onLogin}
          className={cn(
            'flex flex-col items-center gap-1 py-2 px-4 min-w-[72px] shrink-0 transition-colors',
            'text-muted-foreground hover:text-foreground'
          )}
          aria-label={user ? 'Log out' : 'Log in'}
        >
          {user ? (
            <>
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ backgroundColor: user.color || '#6B7280' }}
              >
                {user.avatarUrl?.startsWith('emoji:') ? (
                  <span className="text-base">{user.avatarUrl.slice(6)}</span>
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
              <span className="text-xs font-medium truncate max-w-[72px]">{user.name}</span>
            </>
          ) : (
            <>
              <User className="h-7 w-7" />
              <span className="text-xs font-medium">Login</span>
            </>
          )}
        </button>
      </div>
    </nav>
  );
}
