'use client';

/**
 * The coming days as sentences, bottom left of Today (#805): the day in bold
 * in its own column, the sentence beside it, wrapping under itself and never
 * under the day. Words come from src/lib/today/sentences.ts.
 */
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { addDays } from 'date-fns';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay, formatBareTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { comingDays, SENTENCES, type SentenceLocale } from '@/lib/today/sentences';

/** Calendar group id to the person's name, for groups that belong to a person. */
function useCalendarPeople(): Map<string, string> {
  const [people, setPeople] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let active = true;
    fetch('/api/calendar-groups')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { groups?: Array<{ id: string; name: string; userId?: string | null }> } | null) => {
        if (!active || !data?.groups) return;
        setPeople(new Map(data.groups.filter((g) => g.userId).map((g) => [g.id, g.name])));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return people;
}

export function ComingDays({ events, now, daysAhead = SENTENCES.daysAheadDefault }: {
  events: CalendarEvent[];
  now: Date;
  daysAhead?: number;
}) {
  const locale = useLocale();
  const { timeFormat, displayTimezone } = useTimeFormat();
  const people = useCalendarPeople();
  const today = toDisplayDate(now, displayTimezone);

  // The week after today, so days past the limit can fold into "later this week".
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i + 1);
    const dayEvents = events
      .filter((e) => eventOccursOnDisplayDay(e.startTime, e.endTime, e.allDay, day, displayTimezone))
      .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startTime.getTime() - b.startTime.getTime())
      .map((e) => ({ title: e.title, start: e.startTime, allDay: e.allDay, who: e.groupId ? people.get(e.groupId) : undefined }));
    return { label: day.toLocaleDateString(locale, { weekday: 'long' }), events: dayEvents };
  });
  const { lines, more } = comingDays(days, {
    locale: (locale.startsWith('de') ? 'de' : 'en') as SentenceLocale,
    time: (d) => formatBareTime(d, timeFormat, displayTimezone),
    daysAhead,
  });
  if (lines.length === 0 && !more) return null;

  return (
    <div data-today-coming>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-2 text-prose">
        {lines.map((l) => (
          <div key={l.day} className="contents">
            <dt className="font-semibold">{l.day}</dt>
            <dd className="m-0 [text-wrap:balance]">{l.sentence}</dd>
          </div>
        ))}
      </dl>
      {more && <p className="mt-2 text-body opacity-85" data-today-more>{more}</p>}
    </div>
  );
}
