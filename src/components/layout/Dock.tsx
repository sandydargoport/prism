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
import { dockLayout, DOCK_SIZE_NARROW } from '@/lib/constants/dock';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useCalmIdle } from '@/components/screensaver/calmMode';
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
  const { filterNavItems, dockPages } = useHiddenPages();
  // A phone has room for five pages and More; Sign in moves into More (#924).
  const narrow = useIsMobile();
  const { dock, more } = dockLayout(filterNavItems(ALL_NAV_ITEMS), dockPages ?? undefined, narrow ? DOCK_SIZE_NARROW : undefined);
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
  // The wall's Menu word fades with the rest when the display goes idle (#926).
  const calm = useCalmIdle();

  // The dashboard is "Home" on the dock, as on the wall's design.
  const label = (item: NavItem) => (item.href === '/' ? t('nav.home', { defaultValue: 'Home' }) : t(item.i18nKey, { defaultValue: item.label }));
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
          cn('flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-full text-caption font-medium transition-colors', inMore ? 'min-w-[64px] px-3' : narrow ? 'min-w-[44px] flex-1 px-0.5' : 'min-w-[64px] px-3'),
          inMore ? 'min-h-[64px] rounded-2xl text-foreground hover:bg-muted' : 'text-white/85 hover:bg-white/10',
          active && (inMore ? 'bg-muted' : 'bg-white/15 text-white'),
        )}
        data-dock-item={item.href}
      >
        <Icon className="h-5 w-5" />
        <span className={cn('whitespace-nowrap', narrow && !inMore && 'max-w-full truncate')}>{label(item)}</span>
      </Link>
    );
  };

  return (
    <>
      {mode === 'wall' && !visible && !calm && (
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
          'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-center rounded-full bg-[rgb(22_17_13)] shadow-2xl transition-[opacity,transform] duration-200',
          // A phone: the full width less a margin, each item an equal share.
          narrow ? 'inset-x-2 justify-between p-1' : 'left-1/2 -translate-x-1/2 gap-1 p-1.5',
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
          className={cn('flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-full text-caption font-medium text-white/85 hover:bg-white/10', narrow ? 'min-w-[44px] flex-1 px-0.5' : 'min-w-[64px] px-3')}
          data-dock-more
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>{t('nav.more', { defaultValue: 'More' })}</span>
        </button>
        {!narrow && <button
          type="button"
          onClick={user ? onLogout : onLogin}
          className="flex min-h-[56px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-full px-3 text-caption font-medium text-white/85 hover:bg-white/10"
          data-dock-sign
        >
          {user ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          <span className="max-w-[6rem] truncate">{user ? user.name : t('nav.signIn', { defaultValue: 'Sign in' })}</span>
        </button>}
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-2xl" data-dock-more-panel>
          <DialogTitle>{t('nav.more', { defaultValue: 'More' })}</DialogTitle>
          {/* Five a row on a wall, so pages and this screen's jobs fit as one set of tiles (#1006). */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" data-dock-more-grid>
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
          {narrow && (
            <button
              type="button"
              onClick={() => { setMoreOpen(false); (user ? onLogout : onLogin)?.(); }}
              className="flex min-h-[52px] items-center justify-center gap-2 rounded-full border-[1.5px] border-foreground/30 px-5 text-body"
              data-dock-sign
            >
              {user ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
              {user ? user.name : t('nav.signIn', { defaultValue: 'Sign in' })}
            </button>
          )}
          {screenJobs && (
            <div className="flex flex-col gap-2 border-t border-border pt-4" data-dock-screen-jobs>
              <p className="m-0 text-caption font-medium text-muted-foreground">{t('nav.thisScreen', { defaultValue: 'This screen' })}</p>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" data-dock-jobs-grid>{screenJobs}</div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
