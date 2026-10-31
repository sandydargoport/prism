'use client';

import { useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from '@/components/ui/use-toast';
import { removeBirthday, type Birthday } from '@/lib/hooks/useBirthdays';

type ConfirmFn = (
  title: string,
  description?: string,
  options?: { confirmLabel?: string; variant?: 'default' | 'destructive' },
) => Promise<boolean>;

/**
 * Remove a birthday from where it shows: a parent's PIN, a confirmation, then
 * the same removal as the Birthdays list in Settings > Calendars, which can
 * restore it. Every list
 * on this screen reloads as soon as it goes.
 */
export function useRemoveBirthday(confirm: ConfirmFn) {
  const { requireAuth } = useAuth();
  return useCallback(async (birthday: Birthday) => {
    const user = await requireAuth('Remove a birthday', "Enter a parent's PIN to remove it.");
    if (!user) return;
    if (user.role !== 'parent') {
      toast({ title: 'Only a parent can remove a birthday', variant: 'warning' });
      return;
    }
    const ok = await confirm(
      `Remove ${birthday.name}?`,
      'It disappears from Prism, and calendar or contact sync will not add it back. You can restore it in Settings > Calendars.',
      { confirmLabel: 'Remove', variant: 'destructive' },
    );
    if (!ok) return;
    if (!await removeBirthday(birthday.id)) toast({ title: 'Failed to remove', variant: 'destructive' });
  }, [requireAuth, confirm]);
}
