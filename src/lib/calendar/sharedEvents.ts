import type { CalendarEvent } from '@/types/calendar';

/**
 * One event on two people's calendars (an invite both accepted) arrives as
 * two rows, one per calendar, and showed twice, identical. Copies on
 * different calendars with the same title, start, end and all-day are one
 * event: the first stays, and keeps the others' colours, calendar names and
 * ids, so a mark can show every person and Hide can hide every copy.
 * Copies on one calendar are left alone; that is a different problem.
 */
export function mergeSharedEvents(events: CalendarEvent[]): CalendarEvent[] {
  const byKey = new Map<string, CalendarEvent>();
  const out: CalendarEvent[] = [];
  for (const e of events) {
    const key = [e.title.trim().toLowerCase(), +e.startTime, +e.endTime, e.allDay].join('|');
    const first = byKey.get(key);
    if (!first || first.calendarId === e.calendarId || (first.alsoCalendarIds ?? []).includes(e.calendarId)) {
      if (!first) byKey.set(key, e);
      out.push(e);
      continue;
    }
    // Merge into the first copy, without changing the object others may hold.
    const merged: CalendarEvent = {
      ...first,
      alsoIds: [...(first.alsoIds ?? []), e.id],
      alsoCalendarIds: [...(first.alsoCalendarIds ?? []), e.calendarId],
      alsoCalendarNames: [...(first.alsoCalendarNames ?? []), e.calendarName],
      alsoColors: [...new Set([...(first.alsoColors ?? []), e.color])].filter((c) => c !== first.color),
    };
    byKey.set(key, merged);
    out[out.indexOf(first)] = merged;
  }
  return out;
}

/** Every person's colour on an event: its own first, then any shared copies'. */
export function eventColors(e: Pick<CalendarEvent, 'color' | 'alsoColors'>): string[] {
  return [e.color, ...(e.alsoColors ?? [])];
}

/**
 * A mark's background: one colour, or the colours in equal parts, side by
 * side for a dot ('90deg') or stacked for a thin bar ('180deg').
 */
export function eventDotBackground(e: Pick<CalendarEvent, 'color' | 'alsoColors'>, direction: '90deg' | '180deg' = '90deg'): string {
  const colors = eventColors(e);
  if (colors.length === 1) return colors[0]!;
  const step = 100 / colors.length;
  return `linear-gradient(${direction}, ${colors.map((c, i) => `${c} ${i * step}% ${(i + 1) * step}%`).join(', ')})`;
}
