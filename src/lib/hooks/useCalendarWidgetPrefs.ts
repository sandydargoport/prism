'use client';

import { useState, useEffect, useCallback, useMemo, createContext } from 'react';
import { addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, startOfWeek } from 'date-fns';
import type { OverlayFlags } from '@/lib/hooks/useDayBucketsForRange';

/**
 * Scopes CalendarWidget preference storage. Empty string = the shared keys used
 * on the dashboard. A non-empty scope (e.g. 'screensaver') suffixes every
 * `prism-calendar-*` key so that context keeps its own independent, persisted
 * view + display prefs. Provided by the screensaver overlay so its calendar can
 * show a different view than the dashboard's.
 */
export const CalendarPrefsScopeContext = createContext<string>('');

export type WidgetViewType =
  | 'agenda'
  | 'list'
  | 'day'
  | 'week'
  | 'multiWeek'
  | 'multiWeek2'
  | 'multiWeek3'
  | 'multiWeek4'
  | 'month';

export type ResolvedViewType = 'agenda' | 'list' | 'day' | 'week' | 'multiWeek' | 'month';

const VALID_VIEWS: WidgetViewType[] = [
  'agenda', 'list', 'day', 'week', 'multiWeek', 'multiWeek2', 'multiWeek3', 'multiWeek4', 'month',
];

export const VIEW_OPTIONS: { value: WidgetViewType; label: string }[] = [
  { value: 'agenda', label: 'Agenda' },
  { value: 'day', label: 'Day' },
  { value: 'list', label: 'List' },
  { value: 'week', label: 'Schedule' },
  { value: 'multiWeek', label: '1W' },
  { value: 'multiWeek2', label: '2W' },
  { value: 'multiWeek3', label: '3W' },
  { value: 'multiWeek4', label: '4W' },
  { value: 'month', label: 'Month' },
];

/** Which views are available at a given grid size (48-column grid) */
export function getAvailableViews(gridW: number, gridH: number): WidgetViewType[] {
  const mw: WidgetViewType[] = ['multiWeek', 'multiWeek2', 'multiWeek3', 'multiWeek4'];
  if (gridW >= 36 && gridH >= 24) return ['agenda', 'list', 'day', 'week', ...mw, 'month'];
  if (gridW >= 24 && gridH >= 36) return ['agenda', 'list', 'day', 'week', ...mw, 'month'];
  if (gridW >= 24 && gridH >= 24) return ['agenda', 'list', 'week', ...mw, 'month'];
  if (gridW >= 16 && gridH >= 16) return ['agenda', 'list', 'week', ...mw];
  return ['agenda'];
}

/** Resolve multiWeekN variant to base view + week count */
export function resolveMultiWeek(vt: WidgetViewType): { baseView: ResolvedViewType; weekCount: 1 | 2 | 3 | 4 } {
  if (vt === 'multiWeek') return { baseView: 'multiWeek', weekCount: 1 };
  if (vt === 'multiWeek2') return { baseView: 'multiWeek', weekCount: 2 };
  if (vt === 'multiWeek3') return { baseView: 'multiWeek', weekCount: 3 };
  if (vt === 'multiWeek4') return { baseView: 'multiWeek', weekCount: 4 };
  return { baseView: vt as ResolvedViewType, weekCount: 2 };
}

function readViewPref(suffix: string): WidgetViewType {
  if (typeof window === 'undefined') return 'agenda';
  // A scoped calendar (e.g. screensaver) with no saved view yet inherits the
  // dashboard's current view, then diverges once the user changes it.
  const saved = localStorage.getItem(`prism-calendar-view${suffix}`)
    ?? (suffix ? localStorage.getItem('prism-calendar-view') : null);
  // Migrate legacy formats
  if (saved === 'twoWeek') return 'multiWeek2';
  if (saved === 'multiWeek') {
    const wc = Number(localStorage.getItem(`prism-calendar-weekcount${suffix}`) || '2');
    if (wc === 1) return 'multiWeek';
    if (wc === 3) return 'multiWeek3';
    if (wc === 4) return 'multiWeek4';
    return 'multiWeek2';
  }
  if (saved === 'list') return 'agenda';
  if (saved && VALID_VIEWS.includes(saved as WidgetViewType)) return saved as WidgetViewType;
  return 'agenda';
}

/**
 * Manages view-type selection, date navigation, and preference persistence
 * for the CalendarWidget. Extracted from the component to keep it under 250 lines.
 */
export function useCalendarWidgetPrefs(gridW: number, gridH: number, scope = '') {
  // Non-empty scope suffixes every storage key so this calendar (e.g. the one on
  // the screensaver) keeps prefs independent of the dashboard's. Empty = shared.
  const suffix = scope ? `:${scope}` : '';
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [widgetBordered, setWidgetBordered] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(`prism-calendar-bordered${suffix}`) === 'true'
  );
  const [mergedView, setMergedView] = useState(false);
  const [showNotes, setShowNotes] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem(`prism-calendar-notes-visible${suffix}`) === 'true'
  );
  const [viewType, setViewType] = useState<WidgetViewType>(() => readViewPref(suffix));
  const [displayMode, setDisplayMode] = useState<'inline' | 'cards'>(
    // Match useCalendarViewData's default: 'cards' only if explicitly set,
    // else 'inline'. Same localStorage key — divergent defaults caused the
    // widget and subpage to render differently on first load.
    () => (typeof window !== 'undefined' && localStorage.getItem(`prism-calendar-display-mode${suffix}`) === 'cards') ? 'cards' : 'inline'
  );
  const [hideWeekends, setHideWeekends] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem(`prism-calendar-hide-weekends${suffix}`) === 'true'
  );
  const [overlays, setOverlays] = useState<OverlayFlags>(() => {
    if (typeof window === 'undefined') return { events: true, meals: true, chores: true, tasks: true };
    try {
      const raw = localStorage.getItem(`prism-calendar-overlays${suffix}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          events: parsed.events !== false,
          meals: parsed.meals !== false,
          chores: parsed.chores !== false,
          tasks: parsed.tasks !== false,
        };
      }
    } catch { /* ignore */ }
    return { events: true, meals: true, chores: true, tasks: true };
  });

  // Persist prefs (keyed by scope)
  useEffect(() => { localStorage.setItem(`prism-calendar-view${suffix}`, viewType); }, [viewType, suffix]);
  useEffect(() => { localStorage.setItem(`prism-calendar-bordered${suffix}`, String(widgetBordered)); }, [widgetBordered, suffix]);
  useEffect(() => { localStorage.setItem(`prism-calendar-notes-visible${suffix}`, String(showNotes)); }, [showNotes, suffix]);
  useEffect(() => { localStorage.setItem(`prism-calendar-display-mode${suffix}`, displayMode); }, [displayMode, suffix]);
  useEffect(() => { localStorage.setItem(`prism-calendar-hide-weekends${suffix}`, String(hideWeekends)); }, [hideWeekends, suffix]);
  useEffect(() => { localStorage.setItem(`prism-calendar-overlays${suffix}`, JSON.stringify(overlays)); }, [overlays, suffix]);

  // Derived view state
  const availableViews = useMemo(() => getAvailableViews(gridW, gridH), [gridW, gridH]);
  const effectiveView = availableViews.includes(viewType) ? viewType : 'agenda';
  const { baseView: resolvedView, weekCount: resolvedWeekCount } = resolveMultiWeek(effectiveView);
  const viewUnavailable = viewType !== effectiveView;

  // Navigation
  const goToToday = useCallback(() => setCurrentDate(new Date()), []);
  const goToPrevious = useCallback(() => {
    setCurrentDate(d => {
      switch (resolvedView) {
        case 'day': return subDays(d, 1);
        case 'list':
        case 'week': return subWeeks(d, 1);
        case 'multiWeek': return subWeeks(d, resolvedWeekCount);
        case 'month': return subMonths(d, 1);
        default: return subDays(d, 3);
      }
    });
  }, [resolvedView, resolvedWeekCount]);
  const goToNext = useCallback(() => {
    setCurrentDate(d => {
      switch (resolvedView) {
        case 'day': return addDays(d, 1);
        case 'list':
        case 'week': return addWeeks(d, 1);
        case 'multiWeek': return addWeeks(d, resolvedWeekCount);
        case 'month': return addMonths(d, 1);
        default: return addDays(d, 3);
      }
    });
  }, [resolvedView, resolvedWeekCount]);

  return {
    currentDate, setCurrentDate,
    widgetBordered, setWidgetBordered,
    mergedView, setMergedView,
    showNotes, setShowNotes,
    viewType, setViewType,
    displayMode, setDisplayMode,
    hideWeekends, setHideWeekends,
    overlays, setOverlays,
    availableViews,
    effectiveView,
    resolvedView,
    resolvedWeekCount,
    viewUnavailable,
    goToToday, goToPrevious, goToNext,
  };
}
