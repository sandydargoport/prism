'use client';

/**
 * Quiet lines, bottom right of Today (#911): chores left, with a ring in each
 * person's colour to tick it; the shopping list's count, with a plus to add;
 * and, when a birthday is near, an offer to put a card on the to-do list.
 * A line with nothing to say drops out.
 */
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { addDays } from 'date-fns';
import { Plus } from 'lucide-react';
import { useAuth, useTimeFormat } from '@/components/providers';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { getDisplayDateKey, toDisplayDate } from '@/lib/utils/timeFormat';
import { birthdayNudge, choresLeft, type BirthdayLike, type ChoreLike } from '@/lib/today/quietLines';

const PUT_OFF_KEY = 'prism-birthday-nudge-put-off';

function readPutOff(): string[] {
  try { return JSON.parse(localStorage.getItem(PUT_OFF_KEY) ?? '[]') as string[]; } catch { return []; }
}

export function QuietLines({ chores, lists, birthdays, now, onTickChore, onAddShopping }: {
  chores: ChoreLike[];
  lists: Array<{ id: string; name: string; items: Array<{ checked: boolean }> }>;
  birthdays: BirthdayLike[];
  now: Date;
  onTickChore?: (choreId: string) => void;
  onAddShopping?: () => void;
}) {
  const t = useTranslations('today');
  const locale = useLocale();
  const { displayTimezone } = useTimeFormat();
  const { requireAuth } = useAuth();
  // Put off "for this birthday", on this screen: id plus the date it falls on.
  const [putOff, setPutOff] = useState<string[]>(() => (typeof window === 'undefined' ? [] : readPutOff()));

  const today = toDisplayDate(now, displayTimezone);
  const todayKey = getDisplayDateKey(now, displayTimezone);
  const left = choresLeft(chores, todayKey);
  const list = lists[0];
  const toBuy = list ? list.items.filter((i) => !i.checked).length : 0;
  const nudge = birthdayNudge(birthdays, {
    hour: today.getHours(),
    putOff: (b) => putOff.includes(`${b.id}:${b.nextBirthday}`),
  });
  const nudgeBirthday = nudge ? birthdays.find((b) => b.id === nudge.birthdayId) : undefined;
  const weekday = (days: number) => addDays(today, days).toLocaleDateString(locale, { weekday: 'long' });

  const notNow = () => {
    if (!nudgeBirthday) return;
    const next = [...putOff, `${nudgeBirthday.id}:${nudgeBirthday.nextBirthday}`];
    setPutOff(next);
    try { localStorage.setItem(PUT_OFF_KEY, JSON.stringify(next)); } catch { /* the line comes back on reload */ }
  };

  const addIt = async () => {
    if (!nudge) return;
    const user = await requireAuth(t('nudgeWho'));
    if (!user) return;
    const due = getDisplayDateKey(addDays(today, nudge.mailInDays), undefined);
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: t('nudgeTask', { name: nudge.name }), dueDate: due }),
    });
    if (!res.ok) { toast({ title: t('nudgeFailed'), variant: 'destructive' }); return; }
    toast({ title: t('nudgeAdded', { day: weekday(nudge.mailInDays) }) });
    notNow();
  };

  if (left.length === 0 && !list && !nudge) return null;

  return (
    <div className="flex flex-col items-end gap-3 text-right" data-today-quiet>
      {nudge && (
        <div className="flex max-w-[34rem] flex-col items-end gap-2" data-today-nudge>
          <p className="m-0 text-body [text-wrap:balance]">
            {nudge.age
              ? t('nudgeAge', { name: nudge.name, age: nudge.age, day: weekday(nudge.daysUntil), mailDay: weekday(nudge.mailInDays) })
              : t('nudgeNoAge', { name: nudge.name, day: weekday(nudge.daysUntil), mailDay: weekday(nudge.mailInDays) })}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" className="min-h-[44px] text-white hover:bg-white/10" onClick={notNow}>{t('notNow')}</Button>
            <Button className="min-h-[44px] bg-white text-black hover:bg-white/90" onClick={addIt}>{t('addIt')}</Button>
          </div>
        </div>
      )}

      {left.length > 0 && (
        <div className="flex items-center gap-3" data-today-chores>
          <span className="text-body">{t('choresLeft', { count: left.length })}</span>
          <span className="flex">
            {left.slice(0, 6).map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex h-[44px] w-[44px] items-center justify-center"
                onClick={() => onTickChore?.(c.id)}
                aria-label={t('tick', { title: c.title })}
                data-today-ring
              >
                <span className="h-7 w-7 rounded-full border-[3px] bg-black/10" style={{ borderColor: c.assignedTo?.color ?? 'white' }} />
              </button>
            ))}
          </span>
        </div>
      )}

      {list && (
        <div className="flex items-center gap-1" data-today-shopping>
          <span className="text-body">{t('listCount', { name: list.name, count: toBuy })}</span>
          <button
            type="button"
            className="flex h-[44px] w-[44px] items-center justify-center rounded-full hover:bg-white/10"
            onClick={onAddShopping}
            aria-label={t('addToList', { name: list.name })}
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
