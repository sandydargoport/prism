'use client';

/**
 * Trying the new look, and going back (#808). The same steps on the wall's
 * one-time offer and in Settings > Display.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers';
import { useLayouts } from '@/lib/hooks/useLayouts';
import { NEW_LOOK_SETTING_KEY, planNewLook } from '@/lib/newLook';

export function useNewLook() {
  const { requireAuth } = useAuth();
  const { layouts, saveLayout, setDefault, refresh } = useLayouts();
  const [previousDefaultId, setPreviousDefaultId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active) setPreviousDefaultId(d?.settings?.[NEW_LOOK_SETTING_KEY]?.previousDefaultId ?? null); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  /** Add Today and the Calendar layout, Today the default; nothing else changes. */
  const tryIt = useCallback(async (): Promise<boolean> => {
    const user = await requireAuth('Try the new look', "Enter a parent's PIN to change the front page.");
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
  return { layouts, hasToday, previous, tryIt, switchBack };
}
