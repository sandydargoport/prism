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
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HelpCircle, LogIn, LogOut, MonitorCog, MoreHorizontal, Vote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_NAV_ITEMS, type NavItem } from '@/lib/constants/navItems';
import { dockLayout, DOCK_SIZE_NARROW, MORE_TILE } from '@/lib/constants/dock';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useCalmIdle } from '@/components/screensaver/calmMode';
import { useHiddenPages } from '@/lib/hooks/useHiddenPages';
import { scopedHref, isNavActive, RETURN_PARAM } from '@/lib/utils/dashboardScope';
import { useReturnSlug } from '@/lib/hooks/useReturnSlug';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/components/providers/AuthProvider';
import { ScreenJobs } from './DashboardGrid';
import { editLink } from '@/components/dashboard/useDashboardLayout';
import { FeedbackCard } from '@/components/feedback/FeedbackCard';
import { isReferendumOpen } from '@/lib/feedback/referendum';
import { phoneEditPlace, SCREENS_LIST } from '@/lib/displays/editPlace';

/** How long the wall's dock stays after the last touch. */
export const DOCK_WALL_MS = 10_000;
/** How long the Menu tab stays full before it shrinks to a nub (#989). */
export const MENU_NUB_MS = 8_000;
/** How close to the screen's edge a page swipe starts, how far and how fast it goes (#1087). */
const EDGE_PX = 24;
const SWIPE_PX = 60;
const SWIPE_MS = 700;
/**
 * The More panel's groups, in order (#1257): this screen first on a wall,
 * last on a phone. A phone also has Screens, its way into a screen's editor
 * (#1353), before Prism.
 */
const GROUPS_WALL = ['screen', 'pages', 'prism'] as const;
const GROUPS_NARROW = ['pages', 'screens', 'prism', 'screen'] as const;
/**
 * Each group in More is a panel of its own, so the three read apart at a
 * glance: this screen's jobs on a faint tint of the accent (they act on the
 * screen in hand), the pages on a faint grey, Prism's own on a plain border.
 */
const GROUP_PANEL: Record<(typeof GROUPS_NARROW)[number], string> = {
  screen: 'border-primary/25 bg-primary/[0.06]',
  screens: 'border-primary/25 bg-primary/[0.06]',
  pages: 'border-border bg-muted/50',
  prism: 'border-border',
};

export interface DockProps {
  /** 'wall': hidden at rest behind a Menu word; 'page': always on screen. */
  mode: 'wall' | 'page';
  user?: { id: string; name: string; color?: string } | null;
  onLogin?: () => void;
  onLogout?: () => void;
  /**
   * This screen's jobs (Edit layout, Reload, Screensaver...), shown in More.
   * Left out, More has the jobs every page can do (#1257).
   */
  screenJobs?: React.ReactNode;
}

/** Where Edit layout goes from a page: this screen's dashboard, with the editor open (#1257). */
export function screenEditHref(pathname: string | null | undefined, search?: { get(k: string): string | null } | null): string {
  return editLink(scopedHref('/', pathname, search));
}

/**
 * This screen's jobs on a page that brings none of its own (#1257). Edit
 * layout goes to the screen's dashboard with the editor open; the screensaver
 * starts here, since it lives over every page; Reload, Away and Babysitter act
 * in place. A phone has neither Edit layout nor a screensaver (#1036), and a
 * signed-in child no Edit layout.
 */
function PageScreenJobs({ narrow, editHref, close }: { narrow: boolean; editHref: string; close: () => void }) {
  const { activeUser, requireAuth } = useAuth();
  const router = useRouter();
  const edit = async () => {
    close();
    const user = activeUser ?? await requireAuth('Sign in to edit', "Enter a parent's PIN to edit the dashboard layout.", { parentsOnly: true });
    if (!user || user.role !== 'parent') return;
    router.push(editHref);
  };
  return (
    <ScreenJobs
      labelled
      onEditClick={narrow || (activeUser && activeUser.role !== 'parent') ? undefined : () => { void edit(); }}
      onScreensaverClick={narrow ? undefined : () => { close(); window.dispatchEvent(new Event('prism:screensaver')); }}
    />
  );
}

/**
 * A phone's way into the editor (#1353): from a phone you edit a screen,
 * never the phone. A parent only, asked for as Edit layout on the wall asks.
 */
function PhoneEditScreen({ close }: { close: () => void }) {
  const t = useTranslations('common');
  const { activeUser, requireAuth } = useAuth();
  const router = useRouter();
  const open = async () => {
    close();
    const user = activeUser ?? await requireAuth('Sign in to edit', "Enter a parent's PIN to edit a screen.", { parentsOnly: true });
    if (!user || user.role !== 'parent') return;
    const res = await fetch('/api/displays').catch(() => null);
    if (!res?.ok) { router.push(SCREENS_LIST); return; }
    const screens = ((await res.json()).displays ?? []) as Array<{ id: string }>;
    let defaultId: string | null = null;
    if (screens.length === 0) {
      const r = await fetch('/api/layouts').catch(() => null);
      const list = (r?.ok ? (await r.json()).layouts : null) as Array<{ id: string; isDefault?: boolean }> | null;
      defaultId = (list?.find((l) => l.isDefault) ?? list?.[0])?.id ?? null;
    }
    router.push(phoneEditPlace(screens, defaultId));
  };
  return (
    <button type="button" onClick={() => { void open(); }} className={MORE_TILE} data-screen-job="edit-a-screen">
      <MonitorCog className="h-5 w-5" />
      <span className="whitespace-nowrap">{t('nav.editAScreen', { defaultValue: 'Edit a screen' })}</span>
    </button>
  );
}

export function Dock({ mode, user, onLogin, onLogout, screenJobs }: DockProps) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const returnSlug = useReturnSlug();
  const search = returnSlug ? { get: (k: string) => (k === RETURN_PARAM ? returnSlug : null) } : null;
  const { filterNavItems, dockPages } = useHiddenPages();
  // A phone has room for five pages and More; Sign in moves into More (#924).
  const narrow = useIsMobile();
  // A signed-in child has no way into the editor, so no Screens group (#1353).
  const { activeUser } = useAuth();
  const canEdit = !activeUser || activeUser.role === 'parent';
  const { dock, more } = dockLayout(filterNavItems(ALL_NAV_ITEMS), dockPages, narrow ? DOCK_SIZE_NARROW : undefined);
  const [moreOpen, setMoreOpen] = React.useState(false);
  // The open question (#1311) asks in a window of its own, from Feedback beside Help.
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  // In More, Settings sits with Help and Sign in under Prism (#1257); the rest are pages.
  const settingsItem = more.find((i) => i.href === '/settings');
  const pages = more.filter((i) => i.href !== '/settings');

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
  // The tab's nub (#989): full when the dock has just gone or after a touch,
  // a nub after MENU_NUB_MS of quiet.
  const [nub, setNub] = React.useState(false);
  React.useEffect(() => {
    if (mode !== 'wall' || visible) return;
    const t = setTimeout(() => setNub(true), MENU_NUB_MS);
    const wake = () => { setNub(false); };
    window.addEventListener('pointerdown', wake, { passive: true });
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', wake); setNub(false); };
  }, [mode, visible]);
  // The wall's Menu word fades with the rest when the display goes idle (#926).
  const calm = useCalmIdle();

  // The dashboard is "Home" on the dock, as on the wall's design.
  // A phone: a swipe from the screen's edge moves along the dock's row (#1087).
  // From the left edge to the previous page, from the right edge to the next.
  // Only from the edge, so a page's own sideways swipe (Calendar's dates,
  // Shopping's lists) keeps the middle of the screen.
  const router = useRouter();
  const rowRef = React.useRef({ dock, pathname, search });
  // Kept current after each render, for the swipe handler to read.
  React.useEffect(() => { rowRef.current = { dock, pathname, search }; });
  React.useEffect(() => {
    if (!narrow) return;
    let start: { x: number; y: number; t: number; dir: -1 | 1 } | null = null;
    const onStart = (e: TouchEvent) => {
      start = null;
      if (e.touches.length !== 1 || document.querySelector('[role="dialog"]')) return;
      const { clientX: x, clientY: y } = e.touches[0]!;
      if (x <= EDGE_PX) start = { x, y, t: Date.now(), dir: -1 };
      else if (x >= window.innerWidth - EDGE_PX) start = { x, y, t: Date.now(), dir: 1 };
    };
    const onEnd = (e: TouchEvent) => {
      const s = start;
      start = null;
      const end = e.changedTouches[0];
      if (!s || !end) return;
      const dx = end.clientX - s.x;
      const dy = end.clientY - s.y;
      // Towards the middle, mostly sideways, far enough and quick.
      if (Math.sign(dx) !== -s.dir || Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 1.5 * Math.abs(dy) || Date.now() - s.t > SWIPE_MS) return;
      const { dock: row, pathname: path, search: q } = rowRef.current;
      const at = row.findIndex((i) => isNavActive(i.href, path, q));
      const to = row[at + s.dir];
      if (at < 0 || !to) return;
      router.push(scopedHref(to.href, path, q));
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend', onEnd, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend', onEnd);
    };
  }, [narrow, router]);

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
        className={
          // Rounded corners, not a pill: round, the highlight behind a long
          // word ("Shopping") became an oval crowding its label (#1068).
          inMore
            ? cn(MORE_TILE, 'transition-colors', active && 'bg-muted')
            : cn('flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl text-caption font-medium text-white/85 transition-colors hover:bg-white/10', narrow ? 'min-w-[44px] flex-1 px-0.5' : 'min-w-[64px] px-3', active && 'bg-white/15 text-white')
        }
        data-dock-item={item.href}
      >
        <Icon className="h-5 w-5" />
        <span className={cn('whitespace-nowrap', narrow && !inMore && 'max-w-full truncate')}>{label(item)}</span>
      </Link>
    );
  };

  return (
    <>
      {/* The Menu as a soft tab on the bottom edge (#989): it shrinks to a
          nub after a few quiet seconds and grows back with a tap. The button
          stays 44px tall either way; only the drawn tab changes. Over the
          wallpaper it is the dock's own dark glass, so white text reads on a
          photo and on a pale page such as the bus map alike; the theme's card
          colours with no wallpaper. */}
      {mode === 'wall' && !visible && !calm && (
        <button
          type="button"
          className="fixed bottom-0 left-1/2 z-40 flex h-[44px] min-w-[96px] -translate-x-1/2 items-end justify-center"
          onClick={() => setShown(true)}
          aria-label={t('nav.menu', { defaultValue: 'Menu' })}
          data-dock-menu
          data-nub={nub || undefined}
        >
          <span
            className={cn(
              'flex items-center justify-center overflow-hidden rounded-t-[999px] border border-b-0 border-white/25 bg-[rgb(22_17_13/0.72)] text-body font-medium text-white backdrop-blur-md [html:not([data-wallpaper])_&]:border-border [html:not([data-wallpaper])_&]:bg-card/90 [html:not([data-wallpaper])_&]:text-foreground transition-all duration-500 motion-reduce:duration-0',
              nub ? 'h-[6px] w-[40px] opacity-50' : 'h-[40px] w-[140px] opacity-100',
            )}
            style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}
            data-dock-menu-tab
          >
            <span className={cn('transition-opacity duration-300', nub ? 'opacity-0' : 'opacity-100')}>{t('nav.menu', { defaultValue: 'Menu' })}</span>
          </span>
        </button>
      )}

      <nav
        aria-label={t('nav.label', { defaultValue: 'Pages' })}
        className={cn(
          'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-center rounded-[20px] bg-[rgb(22_17_13)] shadow-2xl transition-[opacity,transform] duration-200',
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
          className={cn('flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-2xl text-caption font-medium text-white/85 hover:bg-white/10', narrow ? 'min-w-[44px] flex-1 px-0.5' : 'min-w-[64px] px-3')}
          data-dock-more
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>{t('nav.more', { defaultValue: 'More' })}</span>
        </button>
        {!narrow && <button
          type="button"
          onClick={user ? onLogout : onLogin}
          className="flex min-h-[56px] min-w-[64px] flex-col items-center justify-center gap-1 rounded-2xl px-3 text-caption font-medium text-white/85 hover:bg-white/10"
          data-dock-sign
        >
          {user ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
          <span className="max-w-[6rem] truncate">{user ? user.name : t('nav.signIn', { defaultValue: 'Sign in' })}</span>
        </button>}
      </nav>

      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-2xl" data-dock-more-panel>
          <DialogTitle>{t('nav.more', { defaultValue: 'More' })}</DialogTitle>
          {/* One tile for everything, in three groups (#1257). On a wall this
              screen's jobs lead; on a phone, the pages. */}
          {(narrow ? GROUPS_NARROW : GROUPS_WALL).map((group) => {
            if (group === 'pages' && pages.length === 0) return null;
            if (group === 'screens' && !canEdit) return null;
            const title = group === 'screen'
              ? t('nav.thisScreen', { defaultValue: 'This screen' })
              : group === 'screens' ? t('nav.screens', { defaultValue: 'Screens' })
              : group === 'pages' ? t('nav.pages', { defaultValue: 'Pages' }) : t('nav.prism', { defaultValue: 'Prism' });
            return (
              <section
                key={group}
                className={cn('flex flex-col gap-2 rounded-2xl border p-3', GROUP_PANEL[group])}
                data-dock-more-group={group}
                data-dock-screen-jobs={group === 'screen' || undefined}
                data-dock-pages={group === 'pages' || undefined}
                data-dock-prism={group === 'prism' || undefined}
              >
                <p className="m-0 px-1 text-caption font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
                {/* Five a row on a wall (#1006). */}
                <div
                  className="grid grid-cols-3 gap-2 sm:grid-cols-5"
                  data-dock-more-tiles
                  data-dock-jobs-grid={group === 'screen' || undefined}
                  data-dock-more-grid={group === 'pages' || undefined}
                  data-dock-prism-grid={group === 'prism' || undefined}
                >
                  {group === 'screen' && (screenJobs ?? <PageScreenJobs narrow={narrow} editHref={screenEditHref(pathname, search)} close={() => setMoreOpen(false)} />)}
                  {group === 'screens' && <PhoneEditScreen close={() => setMoreOpen(false)} />}
                  {group === 'pages' && pages.map((item) => link(item, true))}
                  {group === 'prism' && (
                    <>
                      {settingsItem && link(settingsItem, true)}
                      <Link href="/help" onClick={() => setMoreOpen(false)} className={cn(MORE_TILE, pathname === '/help' && 'bg-muted')} data-dock-item="/help">
                        <HelpCircle className="h-5 w-5" />
                        <span className="whitespace-nowrap">{t('nav.help', { defaultValue: 'Help' })}</span>
                      </Link>
                      {/* Beside Help while a question is open (#1311): asked on a tap, never in the way. */}
                      {isReferendumOpen() && (
                        <button
                          type="button"
                          onClick={() => { setMoreOpen(false); setFeedbackOpen(true); }}
                          className={MORE_TILE}
                          data-dock-feedback
                        >
                          <Vote className="h-5 w-5" />
                          <span className="whitespace-nowrap">{t('nav.feedback', { defaultValue: 'Feedback' })}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setMoreOpen(false); (user ? onLogout : onLogin)?.(); }}
                        className={MORE_TILE}
                        aria-label={user ? `Sign out ${user.name}` : undefined}
                        data-dock-sign
                      >
                        {user ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                        <span className="max-w-[6rem] truncate">{user ? user.name : t('nav.signIn', { defaultValue: 'Sign in' })}</span>
                      </button>
                    </>
                  )}
                </div>
              </section>
            );
          })}
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="max-w-md" data-feedback-dialog>
          <DialogTitle>{t('nav.feedback', { defaultValue: 'Feedback' })}</DialogTitle>
          <FeedbackCard showHeading={false} />
        </DialogContent>
      </Dialog>
    </>
  );
}
