'use client';

/**
 * The dock (#922): one labelled row of pages, More for the rest and for this
 * screen's jobs, and Sign in. On the wall it is out of the way: a small
 * "Menu" word at rest, the dock on any touch, gone again after ten seconds.
 *
 * Solid, with no blur, so it costs nothing on a slow tablet, and one row at
 * 1280x800. It is drawn over the page, so nothing on the page moves when it
 * comes and goes.
 */
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HelpCircle, LogIn, LogOut, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_NAV_ITEMS, type NavItem } from '@/lib/constants/navItems';
import { dockLayout } from '@/lib/constants/dock';
import { useHiddenPages } from '@/lib/hooks/useHiddenPages';
import { scopedHref, isNavActive, RETURN_PARAM } from '@/lib/utils/dashboardScope';
import { useReturnSlug } from '@/lib/hooks/useReturnSlug';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/** How long the wall's dock stays after the last touch. */
export const DOCK_WALL_MS = 10_000;

export interface DockProps {
  /** 'wall': hidden at rest behind a Menu word; 'page': always on screen. */
  mode: 'wall' | 'page';
  user?: { id: string; name: string; color?: string } | null;
  onLogin?: () => void;
  onLogout?: () => void;
  /** This screen's jobs (Edit layout, Reload, Screensaver...), shown in More. */
  screenJobs?: React.ReactNode;
}

export function Dock({ mode, user, onLogin, onLogout, screenJobs }: DockProps) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const returnSlug = useReturnSlug();
  const search = returnSlug ? { get: (k: string) => (k === RETURN_PARAM ? returnSlug : null) } : null;
  const { filterNavItems } = useHiddenPages();
  const { dock, more } = dockLayout(filterNavItems(ALL_NAV_ITEMS));
  const [moreOpen, setMoreOpen] = React.useState(false);

  // The wall: any touch shows the dock; it goes after ten quiet seconds.
  const [shown, setShown] = React.useState(mode === 'page');
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (mode !== 'wall') return;
    const wake = () => {
      setShown(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setShown(false), DOCK_WALL_MS);
    };
    window.addEventListener('pointerdown', wake, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', wake);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [mode]);
  const visible = mode === 'page' || shown || moreOpen;

  const label = (item: NavItem) => t(item.i18nKey, { defaultValue: item.label });
  const link = (item: NavItem, inMore = false) => {
    const active = isNavActive(item.href, pathname, search);
    const Icon = item.icon;
    return (
      <Link
        key={item.href}
        href={scopedHref(item.href, pathname, search)}
        onClick={() => setMoreOpen(false)}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex min-h-[56px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-full px-3 text-caption font-medium transition-colors',
          inMore ? 'min-h-[64px] rounded-2xl text-foreground hover:bg-muted' : 'text-white/85 hover:bg-white/10',
          active && (inMore ? 'bg-muted' : 'bg-white/15 text-white'),
        )}
        data-dock-item={item.href}
      >
        <Icon className="h-5 w-5" />
        <span className="whitespace-nowrap">{label(item)}</span>
      </Link>
    );
  };

  return (
    <>
      {mode === 'wall' && !visible && (
        <button
          type="button"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex min-h-[44px] -translate-x-1/2 items-center px-5 text-body font-medium text-white/80 [text-shadow:var(--ds-idle-text-shadow)]"
          onClick={() => setShown(true)}
          data-dock-menu
        >
          {t('nav.menu', { defaultValue: 'Menu' })}
        </button>
      )}

      <nav
        aria-label={t('nav.label', { defaultValue: 'Pages' })}
        className={cn(
          'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[rgb(22_17_13)] p-1.5 shadow-2xl transition-[opacity,transform] duration-200',
          visible ? 'opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
        )}
        aria-hidden={!visible || undefined}
        data-dock
        data-dock-mode={mode}
      >
        {dock.map((item) => link(item))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="flex min-h-[56px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-full px-3 text-caption font-medium text-white/85 hover:bg-white/10"
          data-dock-more
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>{t('nav.more', { defaultValue: 'More' })}</span>
        </button>
        <button
          type="button"
          onClick={user ? onLogout : onLogin}
          className="flex min-h-[56px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-full px-3 text-caption font-medium text-white/85 hover:bg-white/10"
          data-dock-sign
        >
          {user ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          <span className="max-w-[6rem] truncate">{user ? user.name : t('nav.signIn', { defaultValue: 'Sign in' })}</span>
        </button>
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-2xl" data-dock-more-panel>
          <DialogTitle>{t('nav.more', { defaultValue: 'More' })}</DialogTitle>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {more.map((item) => link(item, true))}
            <Link
              href="/help"
              onClick={() => setMoreOpen(false)}
              className="flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-2xl px-3 text-caption font-medium text-foreground hover:bg-muted"
              data-dock-item="/help"
            >
              <HelpCircle className="h-5 w-5" />
              <span>{t('nav.help', { defaultValue: 'Help' })}</span>
            </Link>
          </div>
          {screenJobs && (
            <div className="flex flex-col gap-2 border-t border-border pt-4" data-dock-screen-jobs>
              <p className="m-0 text-caption font-medium text-muted-foreground">{t('nav.thisScreen', { defaultValue: 'This screen' })}</p>
              <div className="flex flex-wrap items-center gap-2">{screenJobs}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
