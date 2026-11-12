'use client';

/**
 * Today as a list (#1030), what Today, the built-in dashboard, leads with: "Next" with the
 * event, its person's colour and its time, then "Later today", and what is
 * already over, faint, under "Earlier today" (#1186). On the wall it sits over the photo in light
 * ink; on a phone, on paper. Tapping an event opens the event sheet (#836).
 */
import { useEffect, useState } from 'react';
import { eventDotBackground } from '@/lib/calendar/sharedEvents';
import { useTranslations } from 'next-intl';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay, formatBareTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { todayAgenda } from '@/lib/today/agenda';
import type { CalendarEvent } from '@/types/calendar';
import { cn } from '@/lib/utils';

export function TodayList({ events, now, onOpenEvent, variant, onlyNext = false }: {
  events: CalendarEvent[];
  now: Date;
  onOpenEvent?: (event: CalendarEvent) => void;
  variant: 'wall' | 'phone';
  /** Idle on the wall: keep only Next. */
  onlyNext?: boolean;
}) {
  const t = useTranslations('today');
  const { timeFormat, displayTimezone } = useTimeFormat();
  const today = toDisplayDate(now, displayTimezone);
  const { next, later, done } = todayAgenda(events, now, (e) => eventOccursOnDisplayDay(e.startTime, e.endTime, e.allDay, today, displayTimezone));
  const time = (d: Date) => formatBareTime(d, timeFormat, displayTimezone);
  // The end says am or pm, so a range never leaves the day half to guess.
  const when = (e: CalendarEvent) => (e.allDay
    ? t('allDayShort')
    : `${time(e.startTime)} – ${formatBareTime(e.endTime, timeFormat, displayTimezone, { dayHalf: true })}`);
  const wall = variant === 'wall';
  const label = cn('m-0 text-caption font-semibold uppercase tracking-[0.14em]', wall ? 'opacity-70' : 'text-muted-foreground');
  const open = (e: CalendarEvent) => onOpenEvent?.(e);

  if (!next) {
    return (
      <p className={cn('m-0', wall ? 'text-title' : 'text-body text-muted-foreground')} style={wall ? { fontFamily: 'var(--font-display)' } : undefined} data-today-list-empty>
        {t('nothingElseToday')}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-today-list={variant}>
      <p className={label}>{t('next')}</p>
      <button
        type="button"
        onClick={() => open(next)}
        // Only the event opens it (#1034): on the wall a tap to wake or to reach
        // the Menu landed anywhere across a full-width button.
        className={cn(
          'flex min-h-[44px] min-w-0 flex-col items-start gap-1 text-left',
          wall ? 'w-fit max-w-full' : 'w-full rounded-2xl bg-card px-4 py-3 shadow-sm',
        )}
        data-today-next
      >
        {/* Across the room on the wall (#1030): about 4.4rem at 1920 wide. */}
        <span className={cn('flex min-w-0 items-center gap-3 leading-tight', wall ? 'text-[clamp(2.4rem,3.6vw,4.4rem)]' : 'text-title')} style={{ fontFamily: 'var(--font-display)' }}>
          <span className={cn('shrink-0 rounded-full', wall ? 'h-3.5 w-3.5' : 'h-2.5 w-2.5')} style={{ background: eventDotBackground(next) }} aria-hidden data-event-mark data-shared={next.alsoColors?.length ? '' : undefined} />
          {wall
            ? <WrittenTitle title={next.title} />
            : <span className="min-w-0 [text-wrap:balance]">{next.title}</span>}
        </span>
        {/* A detail of Next, at a later row's size (#1140): only the title is large. */}
        <span className={cn('tabular-nums', wall ? 'text-body opacity-80' : 'text-body text-muted-foreground')} data-today-next-time>
          {when(next)}{next.location ? `, ${next.location}` : ''}
        </span>
      </button>

      {/* What is still to come, then what is over (#1186), each under its own
          label: at 8:45 pm the soccer at 4 is earlier today, not later. */}
      {!onlyNext && ([['laterToday', later, false], ['earlierToday', done, true]] as const).map(([key, rows, past]) => rows.length > 0 && (
        <div key={key} data-today-group={key}>
          <p className={cn(label, 'mt-3')}>{t(key)}</p>
          <ul className="m-0 flex list-none flex-col p-0" data-today-later>
            {rows.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => open(e)}
                  className={cn(
                    'flex min-h-[44px] min-w-0 items-baseline gap-4 text-left',
                    wall ? 'w-fit max-w-full' : 'w-full',
                    wall ? 'text-body' : 'border-b border-border/60 text-body',
                    past && (wall ? 'opacity-55' : 'text-muted-foreground'),
                  )}
                  data-today-later-row
                  data-past={past || undefined}
                >
                  <span className={cn('w-[5.5rem] shrink-0 tabular-nums', wall ? 'opacity-80' : 'text-caption text-muted-foreground')}>
                    {e.allDay ? t('allDayShort') : time(e.startTime)}
                  </span>
                  <span className="min-w-0 truncate">{e.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** How often the wall writes Next out again, for a little slow motion. */
export const REWRITE_MS = 5 * 60_000;

/** Seconds to write a title: about a letter every 0.15 s, 2.5 to 6 s. */
export function writeSeconds(title: string): number {
  return Math.min(6, Math.max(2.5, title.length * 0.15));
}

/**
 * The next event's title on the wall, in a script face, written out left to
 * right: when it changes and again every few minutes. The writing is a soft
 * edge sliding across (prism-write in globals.css), so nothing jumps; with
 * reduced motion the title just shows.
 */
function WrittenTitle({ title }: { title: string }) {
  const [round, setRound] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setRound((r) => r + 1), REWRITE_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <span
      key={`${title}-${round}`}
      className="min-w-0 pb-[0.08em] [text-wrap:balance]"
      style={{ fontFamily: 'var(--font-script)', fontWeight: 600, ['--write-s' as string]: `${writeSeconds(title)}s` }}
      data-write
      data-today-next-title
    >
      {title}
    </span>
  );
}
