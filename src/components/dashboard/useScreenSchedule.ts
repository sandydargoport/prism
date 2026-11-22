'use client';

import type React from 'react';
import { addTransitionType, startTransition, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Layout } from '@/lib/hooks/useLayouts';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import { usePerformanceLevel } from '@/lib/hooks/usePerformanceMode';
import { useResetOn } from '@/lib/hooks/useResetOn';
import { useHydrated } from '@/lib/hooks/useStoredValue';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { loadBase, planOf } from '@/lib/displays/displaySettingsSync';
import { SCHEDULE_TRANSITION, switchAt, type BusTime, type ScreenPlan } from '@/lib/screenSwitches';
import { pageZoomVars } from '@/lib/utils/zoomVars';

/**
 * A named screen shows its dashboard, and switches to another for a while at
 * bus time or at set times (#692, #1282).
 *
 * The home page already opens on the dashboard the screen shows at load time
 * (see app/page). This keeps it right while the screen stays on: when a
 * switch starts or ends, the dashboard changes over in place, without a
 * reload, so widget data stays loaded and widgets both dashboards share can
 * slide to their new place (the `screen-schedule` transition, see
 * CssGridDisplay). A change made from another device reaches it through the
 * heartbeat, which reloads it (DisplayHeartbeat).
 *
 *  - Someone opening another dashboard by hand keeps it until the next switch
 *    starts or ends; then the screen's own plan takes over again.
 *  - A change waits while the screen is in use: until nobody has touched it
 *    for a minute, and never while the layout is being edited.
 *
 * A named screen follows its plan at any address. A device nobody named shows
 * the dashboard at its address, the default on the home page, and switches
 * nothing.
 */

/** How long the screen must be left alone before a scheduled change. */
export const IN_USE_MS = 60 * 1000;

const CHECK_MS = 15 * 1000;

const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/** Bus routes change rarely; their times are read again this often. */
const BUS_TIMES_MS = 15 * 60 * 1000;

/** The plan this page follows: a named screen's own, or none on a device nobody named. */
function screenPlan(): ScreenPlan | null {
  const base = loadBase();
  return base ? planOf(base) : null;
}

/** The bus routes' times at the stop, from the status every display can read; null when unreadable. */
async function readBusTimes(): Promise<BusTime[] | null> {
  try {
    const res = await fetch('/api/bus-tracking/status');
    if (!res.ok) return null;
    const data = await res.json() as { routes?: Array<{ scheduledTime?: string; activeDays?: number[] }> };
    return (data.routes ?? []).flatMap((r) => (typeof r.scheduledTime === 'string' && Array.isArray(r.activeDays)
      ? [{ scheduledTime: r.scheduledTime, activeDays: r.activeDays }] : []));
  } catch {
    // Offline for a moment: the times read last stand.
    return null;
  }
}

/** The bus routes' times at the stop, read when a switch needs them and every so often after. */
function useBusTimes(wanted: boolean): BusTime[] {
  const [times, setTimes] = useState<BusTime[]>([]);
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    void (async () => {
      const read = await readBusTimes();
      if (live && read) setTimes(read);
    })();
    return () => { live = false; };
  }, [wanted]);
  useVisibilityPolling(() => {
    if (wanted) void readBusTimes().then((read) => { if (read) setTimes(read); });
  }, BUS_TIMES_MS, { pollWhileIdle: true });
  return times;
}

/** When someone last touched the screen. Module-wide, so a remount does not forget it. */
let lastInputAt = 0;
let listening = false;
/** The first dashboard this page load opened, by component and page. */
let firstOpen: string | null = null;

function listenForInput(): void {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  const touch = () => { lastInputAt = Date.now(); };
  for (const e of INPUT_EVENTS) window.addEventListener(e, touch, { passive: true, capture: true });
}

type Input = {
  /** The dashboard the page is for: its slug, or undefined for the home page. */
  routeSlug: string | undefined;
  layouts: Layout[];
  loading: boolean;
  /** Whether the layout is being edited; a ref, since the layout hook that knows comes after. */
  editing: { readonly current: boolean };
};

export function useScreenSchedule({ routeSlug, layouts, loading, editing }: Input): {
  /** The slug to show, for useDashboardLayout. */
  slug: string | undefined;
  /**
   * The page applies its own dashboard's text size (see app/d/[slug]/layout);
   * this is what to add on top when the dashboard shown has another, or
   * undefined when it is the same.
   */
  zoomStyle: React.CSSProperties | undefined;
  /** Someone chose this dashboard (by slug); it stays until the next switch starts or ends. */
  pick: (slug: string) => void;
} {
  // Read once the page is in the browser: a change to it reloads the page.
  const hydrated = useHydrated();
  const plan = useMemo<ScreenPlan | null>(() => (hydrated ? screenPlan() : null), [hydrated]);
  const busTimes = useBusTimes(hydrated && !!plan?.switches.some((s) => s.when === 'bus'));
  const { householdTimezone } = useTimeFormat();
  const perfLevel = usePerformanceLevel();

  const defaultLayout = layouts.find((l) => l.isDefault) ?? null;
  const routeLayout = routeSlug ? layouts.find((l) => l.slug === routeSlug) ?? null : defaultLayout;

  // Which dashboard the screen wants now: a switch's, or its own. On a device
  // nobody named, or before the layouts arrive, that is simply the page's own.
  const wanted = useCallback((now: number): { rule: number; id: string | null } => {
    if (!plan || !routeLayout) return { rule: -1, id: routeLayout?.id ?? null };
    const exists = (id: string) => layouts.some((l) => l.id === id);
    const homeId = plan.dashboardId && exists(plan.dashboardId) ? plan.dashboardId : defaultLayout?.id ?? null;
    const { index, dashboardId } = switchAt(plan.switches, now, householdTimezone, busTimes, exists);
    return { rule: index, id: dashboardId ?? homeId };
  }, [plan, routeLayout, layouts, defaultLayout, householdTimezone, busTimes]);

  // While someone's own choice stands: the switch in force when they made
  // it (-1 for none). It holds until that changes.
  const holdRule = useRef<number | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);

  const showByHand = useCallback((id: string | null) => {
    const now = wanted(Date.now());
    holdRule.current = id === now.id ? null : now.rule;
    setShownId(id);
  }, [wanted]);

  // The first dashboard a page load opens follows the screen's plan, whatever
  // the address says: it is the screen starting up, or reloading at an
  // address an earlier change over left behind. Any later one was opened from
  // inside the app, so someone chose it.
  const instance = useId();
  const openKey = loading || !hydrated ? null : `${routeSlug ?? ''}|${routeLayout?.id ?? ''}`;
  useResetOn(openKey, () => {
    if (openKey === null) return;
    // Keyed, not a flag, so rendering twice (React's development checks) still counts as one open.
    firstOpen ??= `${instance}|${openKey}`;
    if (firstOpen === `${instance}|${openKey}`) {
      holdRule.current = null;
      setShownId(wanted(Date.now()).id);
    } else {
      showByHand(routeLayout?.id ?? null);
    }
  });

  useEffect(listenForInput, []);

  const check = useCallback(() => {
    if (loading || editing.current) return;
    const now = Date.now();
    const { rule, id } = wanted(now);
    if (holdRule.current !== null) {
      if (rule === holdRule.current) return;
      holdRule.current = null;
    }
    if (id === shownId) return;
    if (now - lastInputAt < IN_USE_MS) return;
    if (perfLevel === 'minimal') {
      setShownId(id);
      return;
    }
    startTransition(() => {
      addTransitionType(SCHEDULE_TRANSITION);
      setShownId(id);
    });
  }, [loading, editing, wanted, shownId, perfLevel]);

  useVisibilityPolling(check, CHECK_MS, { pollWhileIdle: true });

  const shown = layouts.find((l) => l.id === shownId) ?? routeLayout;
  const shownScale = shown?.fontScale ?? 100;
  const zoom = shownScale / (routeLayout?.fontScale ?? 100);
  // `--app-vh` as the page sets it, for the scale now in force overall.
  const zoomStyle = zoom === 1
    ? undefined
    : ({ zoom, '--app-vh': `${10000 / shownScale}vh`, ...pageZoomVars(shownScale) } as React.CSSProperties);
  const pick = useCallback((slug: string) => {
    const layout = layouts.find((l) => l.slug === slug);
    if (layout) showByHand(layout.id);
  }, [layouts, showByHand]);

  // The default dashboard may have no slug; useDashboardLayout finds it without one.
  return {
    slug: shown ? shown.slug ?? (shown.isDefault ? undefined : routeSlug) : routeSlug,
    zoomStyle,
    pick,
  };
}
