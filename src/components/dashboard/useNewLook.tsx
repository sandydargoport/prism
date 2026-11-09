'use client';

/**
 * Simple or Custom (#808, #991): Simple is the premade Today and Calendar
 * pages, Custom is a grid of widgets. The same steps on the wall's one-time
 * offer and in Settings > Display. On a named screen the choice is that
 * screen's own dashboard (#1117); elsewhere it is the household default.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers';
import { useLayouts } from '@/lib/hooks/useLayouts';
import { NEW_LOOK_SETTING_KEY, customTarget, isSimpleView, newLookLayouts, planNewLook, type NewLookSetting } from '@/lib/newLook';
import { sharedGet } from '@/lib/utils/sharedGet';

export function useNewLook() {
  const { requireAuth } = useAuth();
  const { layouts, saveLayout, setDefault, refresh } = useLayouts();
  const [previousDefaultId, setPreviousDefaultId] = useState<string | null>(null);
  const [setting, setSetting] = useState<NewLookSetting>({});
  /** This browser's named screen, if it is one. */
  const [screen, setScreen] = useState<{ id: string; name: string; dashboardId: string | null } | null>(null);

  useEffect(() => {
    let active = true;
    sharedGet('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        const value = (d?.settings?.[NEW_LOOK_SETTING_KEY] ?? {}) as NewLookSetting;
        setSetting(value);
        setPreviousDefaultId(value.previousDefaultId ?? null);
      })
      .catch(() => {});
    fetch('/api/displays')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { currentId?: string | null; displays?: Array<{ id: string; name: string; dashboardId: string | null }> } | null) => {
        const mine = d?.displays?.find((x) => x.id === d.currentId);
        if (active && mine) setScreen({ id: mine.id, name: mine.name, dashboardId: mine.dashboardId });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  /** Add Today and the Calendar layout, Today the default; nothing else changes. */
  const tryIt = useCallback(async (): Promise<boolean> => {
    const user = await requireAuth('Try the Simple layout', "Enter a parent's PIN to change the front page.");
    if (!user || user.role !== 'parent') return false;
    const plan = planNewLook(layouts);
    for (const l of plan.create) await saveLayout({ name: l.name, widgets: l.widgets, view: l.view, isDefault: l.isDefault });
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: NEW_LOOK_SETTING_KEY, value: { ...setting, previousDefaultId: plan.previousDefaultId } }),
    });
    setSetting((v) => ({ ...v, previousDefaultId: plan.previousDefaultId }));
    setPreviousDefaultId(plan.previousDefaultId);
    await refresh();
    return true;
  }, [requireAuth, layouts, saveLayout, refresh, setting]);

  /** Make the old front page the default again. The new layouts stay, one tap away. */
  const switchBack = useCallback(async (): Promise<boolean> => {
    if (!previousDefaultId) return false;
    const user = await requireAuth('Switch back', "Enter a parent's PIN to change the front page.");
    if (!user || user.role !== 'parent') return false;
    await setDefault(previousDefaultId);
    await refresh();
    return true;
  }, [previousDefaultId, requireAuth, setDefault, refresh]);

  const previous = layouts.find((l) => l.id === previousDefaultId) ?? null;
  const hasToday = layouts.some((l) => l.view === 'today');
  const householdDefault = layouts.find((l) => l.isDefault);
  // On a named screen the choice is that screen's own (#1117); elsewhere it is
  // the household default, which every unnamed screen shows.
  const screenDashboard = screen ? layouts.find((l) => l.id === screen.dashboardId) ?? householdDefault : null;
  const current = screen ? screenDashboard : householdDefault;
  /** Which kind the front page is now, here. */
  const mode: 'simple' | 'custom' = current && isSimpleView(current.view) ? 'simple' : 'custom';

  const remember = useCallback(async (patch: NewLookSetting) => {
    const merged: NewLookSetting = { ...setting, ...patch, screens: { ...setting.screens, ...patch.screens } };
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: NEW_LOOK_SETTING_KEY, value: merged }),
    });
    setSetting(merged);
  }, [setting]);

  const setScreenDashboard = useCallback(async (id: string, dashboardId: string) => {
    await fetch(`/api/displays/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dashboardId }),
    });
    setScreen((s) => (s ? { ...s, dashboardId } : s));
  }, []);

  /** Simple: add the layouts if there are none yet, else make Today the front page here. */
  const chooseSimple = useCallback(async (): Promise<boolean> => {
    let today = layouts.find((l) => l.view === 'today');
    if (!today && !screen) return tryIt();
    const user = await requireAuth('Use the Simple layout', "Enter a parent's PIN to change the front page.");
    if (!user || user.role !== 'parent') return false;
    if (!today) {
      today = await saveLayout({ ...newLookLayouts()[0]!, isDefault: false });
      await refresh();
    }
    if (screen) {
      if (current && !isSimpleView(current.view)) await remember({ screens: { [screen.id]: current.id } });
      await setScreenDashboard(screen.id, today.id);
      return true;
    }
    if (current && !isSimpleView(current.view)) {
      await remember({ previousDefaultId: current.id });
      setPreviousDefaultId(current.id);
    }
    await setDefault(today.id);
    await refresh();
    return true;
  }, [layouts, screen, current, tryIt, requireAuth, saveLayout, remember, setScreenDashboard, setDefault, refresh]);

  /** Custom: back to the grid layout used before here, or the first grid layout there is. */
  const chooseCustom = useCallback(async (): Promise<boolean> => {
    const target = customTarget(screen ? setting.screens?.[screen.id] : previous?.id, layouts);
    if (!target) return false;
    const user = await requireAuth('Use a Custom layout', "Enter a parent's PIN to change the front page.");
    if (!user || user.role !== 'parent') return false;
    if (screen) {
      await setScreenDashboard(screen.id, target.id);
      return true;
    }
    await setDefault(target.id);
    await refresh();
    return true;
  }, [screen, setting, previous, layouts, requireAuth, setScreenDashboard, setDefault, refresh]);

  return { layouts, hasToday, previous, mode, screenName: screen?.name ?? null, tryIt, switchBack, chooseSimple, chooseCustom };
}
