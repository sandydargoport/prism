'use client';

/**
 * Simple or Custom (#808, #991): Simple is the Today and Calendar layouts,
 * Custom is a grid of widgets. The same steps on the wall's one-time offer
 * and in Settings > Display.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers';
import { useLayouts } from '@/lib/hooks/useLayouts';
import { NEW_LOOK_SETTING_KEY, planNewLook } from '@/lib/newLook';
import { sharedGet } from '@/lib/utils/sharedGet';

export function useNewLook() {
  const { requireAuth } = useAuth();
  const { layouts, saveLayout, setDefault, refresh } = useLayouts();
  const [previousDefaultId, setPreviousDefaultId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    sharedGet('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setPreviousDefaultId(d?.settings?.[NEW_LOOK_SETTING_KEY]?.previousDefaultId ?? null); })
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
      body: JSON.stringify({ key: NEW_LOOK_SETTING_KEY, value: { previousDefaultId: plan.previousDefaultId } }),
    });
    setPreviousDefaultId(plan.previousDefaultId);
    await refresh();
    return true;
  }, [requireAuth, layouts, saveLayout, refresh]);

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
  const isSimple = (l: { view?: string }) => l.view === 'today' || l.view === 'calendar';
  const current = layouts.find((l) => l.isDefault);
  /** Which kind the front page is now. */
  const mode: 'simple' | 'custom' = current && isSimple(current) ? 'simple' : 'custom';

  /** Simple: add the layouts if there are none yet, else make Today the front page again. */
  const chooseSimple = useCallback(async (): Promise<boolean> => {
    const today = layouts.find((l) => l.view === 'today');
    if (!today) return tryIt();
    const user = await requireAuth('Use the Simple layout', "Enter a parent's PIN to change the front page.");
    if (!user || user.role !== 'parent') return false;
    if (current && !isSimple(current)) {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: NEW_LOOK_SETTING_KEY, value: { previousDefaultId: current.id } }),
      });
      setPreviousDefaultId(current.id);
    }
    await setDefault(today.id);
    await refresh();
    return true;
  }, [layouts, current, tryIt, requireAuth, setDefault, refresh]);

  /** Custom: back to the grid layout used before, or the first grid layout there is. */
  const chooseCustom = useCallback(async (): Promise<boolean> => {
    const target = previous && !isSimple(previous) ? previous : layouts.find((l) => !isSimple(l));
    if (!target) return false;
    const user = await requireAuth('Use a Custom layout', "Enter a parent's PIN to change the front page.");
    if (!user || user.role !== 'parent') return false;
    await setDefault(target.id);
    await refresh();
    return true;
  }, [previous, layouts, requireAuth, setDefault, refresh]);

  return { layouts, hasToday, previous, mode, tryIt, switchBack, chooseSimple, chooseCustom };
}
