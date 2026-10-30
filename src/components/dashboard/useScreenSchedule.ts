'use client';

import type React from 'react';
import { addTransitionType, startTransition, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Layout } from '@/lib/hooks/useLayouts';
import { useStoredString } from '@/lib/hooks/useStoredValue';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import { usePerformanceLevel } from '@/lib/hooks/usePerformanceMode';
import { useResetOn } from '@/lib/hooks/useResetOn';
import { useTimeFormat } from '@/components/providers/TimeFormatProvider';
import { loadBase } from '@/lib/displays/displaySettingsSync';
import { parseSchedule, scheduledDashboard, SCHEDULE_TRANSITION, SCREEN_SCHEDULE_KEY } from '@/lib/displays/screenSchedule';

/**
 * Time-of-day layouts on the screen itself (#692).
 *
 * The home page already opens on the dashboard the schedule shows at load
 * time. This keeps it right while the screen stays on: when a window starts or
 * ends, the dashboard changes over in place, without a reload, so widget data
 * stays loaded and widgets both dashboards share can slide to their new place
 * (the `screen-schedule` transition, see CssGridDisplay).
 *
 *  - Someone opening another dashboard by hand keeps it until the next rule
 *    starts or ends; then the schedule takes over again.
 *  - A change waits while the screen is in use: until nobody has touched it
 *    for a minute, and never while the layout is being edited.
 *
 * Only a named screen has a schedule; anywhere else this shows the page's own
 * dashboard, as before.
 */

/** How long the screen must be left alone before a scheduled change. */
export const IN_USE_MS = 60 * 1000;

const CHECK_MS = 15 * 1000;

const INPUT_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

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
  /** Someone chose this dashboard (by slug); it stays until the next rule starts or ends. */
  pick: (slug: string) => void;
} {
  const stored = useStoredString(SCREEN_SCHEDULE_KEY);
  const rules = useMemo(() => parseSchedule(stored), [stored]);
  const { householdTimezone } = useTimeFormat();
  const perfLevel = usePerformanceLevel();

  const defaultLayout = layouts.find((l) => l.isDefault) ?? null;
  const routeLayout = routeSlug ? layouts.find((l) => l.slug === routeSlug) ?? null : defaultLayout;

  // Which dashboard the schedule wants now. Without a named screen, or before
  // the layouts arrive, that is simply the page's own.
  const wanted = useCallback((now: number): { rule: number; id: string | null } => {
    const base = typeof window === 'undefined' ? null : loadBase();
    if (!base || rules.length === 0 || !routeLayout) return { rule: -1, id: routeLayout?.id ?? null };
    const homeId = layouts.some((l) => l.id === base.dashboardId) ? base.dashboardId! : defaultLayout?.id ?? null;
    const { rule, dashboardId } = scheduledDashboard(rules, now, householdTimezone, (id) => layouts.some((l) => l.id === id));
    return { rule, id: dashboardId ?? homeId };
  }, [rules, routeLayout, layouts, defaultLayout, householdTimezone]);

  // While someone's own choice stands: the rule in force when they made it.
  // It holds until that changes.
  const holdRule = useRef<number | null>(null);
  const [shownId, setShownId] = useState<string | null>(null);

  const showByHand = useCallback((id: string | null) => {
    const now = wanted(Date.now());
    holdRule.current = id === now.id ? null : now.rule;
    setShownId(id);
  }, [wanted]);

  // The first dashboard a page load opens follows the schedule, whatever the
  // address says: it is the screen starting up, or reloading at an address an
  // earlier change over left behind. Any later one was opened from inside the
  // app, so someone chose it.
  const instance = useId();
  const openKey = loading ? null : `${routeSlug ?? ''}|${routeLayout?.id ?? ''}`;
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
    : ({ zoom, '--app-vh': `${10000 / shownScale}vh` } as React.CSSProperties);
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
