'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Plus,
  Home,
  Sun,
  Moon,
  Monitor,
  User,
  LayoutGrid,
  ArrowUpDown,
  Eye,
  EyeOff,
  ScanLine,
  Rows3,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/components/providers/ThemeProvider';
import { loadHiddenCards, saveHiddenCards } from '@/components/dashboard/useMobileCardOrder';
import { useMobileLayout } from '@/lib/hooks/useMobileLayout';

export interface MobileFabProps {
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

const ALL_CARDS: { id: string; label: string }[] = [
  { id: 'weather', label: 'Weather' },
  { id: 'clock', label: 'Clock' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'busTracking', label: 'Bus Tracker' },
  { id: 'chores', label: 'Chores' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'meals', label: 'Meals' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'messages', label: 'Messages' },
  { id: 'birthdays', label: 'Birthdays' },
  { id: 'points', label: 'Goals' },
  { id: 'wishes', label: 'Wishes' },
  { id: 'photos', label: 'Photos' },
];

export function MobileFab({ user, onLogin, onLogout, uiHidden }: MobileFabProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [showCards, setShowCards] = useState(false);
  const [hiddenCards, setHiddenCards] = useState<string[]>([]);
  const [reorderMode, setReorderMode] = useState(false);
  const { theme, setTheme } = useTheme();
  const { layout, setLayout } = useMobileLayout();

  useEffect(() => {
    setHiddenCards(loadHiddenCards());
  }, []);

  const toggleReorderMode = useCallback(() => {
    const next = !reorderMode;
    setReorderMode(next);
    setIsOpen(false);
    window.dispatchEvent(new CustomEvent('prism:mobile-reorder', { detail: { active: next } }));
  }, [reorderMode]);

  const toggleCard = useCallback((cardId: string) => {
    setHiddenCards((prev) => {
      const next = prev.includes(cardId)
        ? prev.filter((id) => id !== cardId)
        : [...prev, cardId];
      saveHiddenCards(next);
      return next;
    });
  }, []);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const themeLabel = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'Auto';

  const isDashboard = pathname === '/' || pathname?.startsWith('/d/');
  const isShopping = pathname === '/shopping';

  const actions = [
    {
      key: 'home',
      icon: <Home className="h-5 w-5" />,
      label: 'Home',
      onClick: () => setIsOpen(false),
      href: '/',
    },
    ...(isShopping ? [
      {
        key: 'scan',
        icon: <ScanLine className="h-5 w-5" />,
        label: 'Scan Barcode',
        onClick: () => {
          setIsOpen(false);
          window.dispatchEvent(new CustomEvent('prism:open-barcode-scanner'));
        },
      },
    ] : []),
    ...(isDashboard ? [
      {
        key: 'reorder',
        icon: <ArrowUpDown className="h-5 w-5" />,
        label: reorderMode ? 'Done' : 'Reorder',
        onClick: toggleReorderMode,
      },
      {
        key: 'settings',
        icon: <LayoutGrid className="h-5 w-5" />,
        label: 'Settings',
        onClick: () => { setIsOpen(false); setShowCards(true); },
      },
    ] : []),
    {
      key: 'auth',
      icon: user ? (
        <div
          className="relative h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: user.color || '#6B7280' }}
        >
          {user.avatarUrl?.startsWith('emoji:') ? (
            <span className="text-sm">{user.avatarUrl.slice(6)}</span>
          ) : user.avatarUrl ? (
            <Image src={user.avatarUrl} alt={user.name} fill unoptimized className="rounded-full object-cover" />
          ) : (
            user.name.charAt(0).toUpperCase()
          )}
        </div>
      ) : (
        <User className="h-5 w-5 text-red-500" />
      ),
      label: user ? 'Switch' : 'Login',
      onClick: () => {
        setIsOpen(false);
        if (user) onSwitchUser?.();
        else onLogin?.();
      },
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {(isOpen || showCards) && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => { setIsOpen(false); setShowCards(false); }}
        />
      )}

      {/* Cards settings panel */}
      {showCards && (
        <div className="fixed inset-x-4 bottom-24 z-50 bg-card rounded-2xl shadow-2xl border border-border p-4 max-h-[60vh] overflow-y-auto safe-area-bottom animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-base">Dashboard Cards</h3>
            <button
              onClick={() => { setShowCards(false); window.location.reload(); }}
              className="text-sm text-primary font-medium"
            >
              Done
            </button>
          </div>
          {/* Theme toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border mb-2">
            <span className="text-sm font-medium">Theme</span>
            <button
              onClick={cycleTheme}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ThemeIcon className="h-4 w-4" />
              <span>{themeLabel}</span>
            </button>
          </div>
          {/* Layout toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border mb-3">
            <span className="text-sm font-medium">Layout</span>
            <div className="flex items-center border rounded-md overflow-hidden text-xs">
              <button
                onClick={() => setLayout('rows')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                  layout === 'rows' ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <Rows3 className="h-3.5 w-3.5" />
                Rows
              </button>
              <button
                onClick={() => setLayout('tiles')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 border-l transition-colors',
                  layout === 'tiles' ? 'bg-secondary text-secondary-foreground font-medium' : 'text-muted-foreground hover:bg-accent'
                )}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Tiles
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Toggle which cards appear on your mobile dashboard.
          </p>
          <div className="space-y-1">
            {ALL_CARDS.map((card) => {
              const isHidden = hiddenCards.includes(card.id);
              return (
                <button
                  key={card.id}
                  onClick={() => toggleCard(card.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
                >
                  <span className={cn('text-sm font-medium', isHidden && 'text-muted-foreground')}>
                    {card.label}
                  </span>
                  {isHidden ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action items */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 flex flex-col-reverse items-end gap-3 safe-area-bottom">
          {actions.map((action, i) => {
            const content = (
              <div
                className="flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2"
                style={{ animationDelay: `${i * 50}ms`, animationFillMode: 'both' }}
              >
                <span className="text-sm font-medium text-foreground bg-card/95 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md border border-border">
                  {action.label}
                </span>
                <div className="w-11 h-11 rounded-full bg-card shadow-lg border border-border flex items-center justify-center text-foreground">
                  {action.icon}
                </div>
              </div>
            );

            if ('href' in action && action.href) {
              return (
                <Link key={action.key} href={action.href} onClick={action.onClick}>
                  {content}
                </Link>
              );
            }
            return (
              <button key={action.key} onClick={action.onClick}>
                {content}
              </button>
            );
          })}
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => { if (showCards) { setShowCards(false); } else { setIsOpen(!isOpen); } }}
        className={cn(
          'fixed right-6 z-50 w-14 h-14 rounded-full',
          'bg-primary text-primary-foreground shadow-lg',
          'flex items-center justify-center',
          'transition-all duration-300 ease-in-out',
          'active:scale-95',
          (isOpen || showCards) && 'rotate-45 bg-muted text-muted-foreground',
          reorderMode && !isOpen && 'bg-amber-500 text-white',
          uiHidden && !isOpen && !showCards && 'translate-y-24 opacity-0'
        )}
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <Plus className="h-6 w-6" />
      </button>
    </>
  );
}
