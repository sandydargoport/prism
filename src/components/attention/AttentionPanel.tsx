'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { Bus, CalendarClock, MessageSquare, X } from 'lucide-react';
import { useTimeFormat } from '@/components/providers';
import { useStoredString } from '@/lib/hooks/useStoredValue';
import { useDisplayIdle } from '@/lib/hooks/useDisplayIdle';
import { PollingScopeContext } from '@/lib/hooks/pollingScope';
import { useCalmIdle } from '@/components/screensaver/calmMode';
import { cn } from '@/lib/utils';
import { useNow } from '@/lib/hooks/useNow';
import { useBusTracking } from '@/lib/hooks/useBusTracking';
import { useBusLive } from '@/lib/hooks/useBusLive';
import { useCalendarEvents } from '@/lib/hooks/useCalendarEvents';
import { useMessages } from '@/lib/hooks/useMessages';
import { formatDisplayTime } from '@/lib/utils/timeFormat';
import {
  arrangeNotices, busNotices, eventNotices, messageNotices, parseAttention, SCREEN_ATTENTION_KEY,
  type AttentionKind, type Notice,
} from '@/lib/displays/screenAttention';

/**
 * The attention panel (#692 phase 2): small notification cards down the
 * right side of a dashboard, newest on top, for whatever the screen's
 * attention settings switch on (bus close, event soon, new message). Nothing
 * underneath moves; a card goes when its moment passes or someone taps it away.
 *
 * Each source fetches only while its trigger is on, so a screen that uses
 * none of them makes no extra requests. Sits above the screensaver and below
 * the idle dim, so it stays visible while idle and dims with everything else.
 * While idle the cards turn dark, so they do not glare off a black screen.
 */

const MIN = 60 * 1000;

type Report = (kind: AttentionKind, notices: Notice[]) => void;

function BusSource({ minutes, now, report }: { minutes: number; now: number; report: Report }) {
  const { routes, allRoutes } = useBusTracking();
  const live = useBusLive(allRoutes.length > 0);
  const notices = React.useMemo(() => {
    const trips = live.tracks.map((t) => {
      const stop = t.stops.find((s) => s.key === t.riderStopKey) ?? null;
      return { id: t.id, routeId: t.routeId, routeLabel: t.routeLabel, riderStop: stop };
    });
    const estimates = routes
      .filter((r) => r.prediction.status === 'in_transit' || r.prediction.status === 'at_stop')
      .map((r) => ({ id: r.id, label: r.label, stopName: r.stopName, etaMinutes: r.prediction.etaMinutes }));
    return busNotices(trips, estimates, now + live.clockOffsetMs, minutes);
  }, [live.tracks, live.clockOffsetMs, routes, now, minutes]);
  React.useEffect(() => report('bus', notices), [report, notices]);
  return null;
}

function EventSource({ minutes, now, report }: { minutes: number; now: number; report: Report }) {
  const { events } = useCalendarEvents({ daysToShow: 1, useDemoFallback: false, autoSyncMinutes: 0 });
  const notices = React.useMemo(() => eventNotices(events, now, minutes), [events, now, minutes]);
  React.useEffect(() => report('event', notices), [report, notices]);
  return null;
}

function MessageSource({ minutes, now, report }: { minutes: number; now: number; report: Report }) {
  const { messages } = useMessages({ limit: 10 });
  const notices = React.useMemo(() => messageNotices(messages, now, minutes), [messages, now, minutes]);
  React.useEffect(() => report('message', notices), [report, notices]);
  return null;
}

const ICONS: Record<AttentionKind, React.ReactNode> = {
  bus: <Bus className="h-5 w-5" />,
  event: <CalendarClock className="h-5 w-5" />,
  message: <MessageSquare className="h-5 w-5" />,
};

function detail(n: Notice, now: number, time: (ms: number) => string): string {
  const until = Math.max(0, Math.round((n.at - now) / MIN));
  if (n.kind === 'bus') return until === 0 ? 'At your stop now' : `At your stop in ${until} min · ${time(n.at)}`;
  if (n.kind === 'event') return until === 0 ? `Starting now · ${time(n.at)}` : `Starts in ${until} min · ${time(n.at)}`;
  const ago = Math.max(0, Math.round((now - n.at) / MIN));
  return ago === 0 ? 'Just now' : ago < 60 ? `${ago} min ago` : time(n.at);
}

/** Dashboards only: the home page and /d/<slug>. */
function isDashboardPath(path: string | null): boolean {
  return path === '/' || (path?.startsWith('/d/') ?? false);
}

/** Visible while the screensaver is up, so it keeps polling like the screensaver's own widgets. */
export function AttentionPanel() {
  return (
    <PollingScopeContext.Provider value="screensaver">
      <Notices />
    </PollingScopeContext.Provider>
  );
}

function Notices() {
  const settings = parseAttention(useStoredString(SCREEN_ATTENTION_KEY));
  const onDashboard = isDashboardPath(usePathname());
  const now = useNow(15_000).getTime();
  const { timeFormat, displayTimezone } = useTimeFormat();
  const screensaverUp = useDisplayIdle();
  const calmIdle = useCalmIdle();
  const idle = screensaverUp || calmIdle;
  const [byKind, setByKind] = React.useState<Partial<Record<AttentionKind, Notice[]>>>({});
  const [dismissed, setDismissed] = React.useState<ReadonlySet<string>>(() => new Set());

  const report = React.useCallback<Report>((kind, notices) => {
    setByKind((prev) => (prev[kind] === notices ? prev : { ...prev, [kind]: notices }));
  }, []);

  const active = onDashboard ? settings : { bus: null, event: null, message: null };
  const shown = arrangeNotices(
    (Object.keys(byKind) as AttentionKind[]).filter((k) => active[k] !== null).flatMap((k) => byKind[k] ?? []),
    dismissed,
  );
  const time = (ms: number) => formatDisplayTime(new Date(ms), timeFormat, {}, displayTimezone);

  return (
    <>
      {active.bus !== null && <BusSource minutes={active.bus} now={now} report={report} />}
      {active.event !== null && <EventSource minutes={active.event} now={now} report={report} />}
      {active.message !== null && <MessageSource minutes={active.message} now={now} report={report} />}
      {shown.length > 0 && (
        <aside
          aria-label="Notices"
          data-testid="attention-panel"
          data-idle={idle || undefined}
          className="pointer-events-none fixed right-4 top-4 z-9999 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
        >
          {shown.map((n) => (
            <div
              key={n.id}
              data-testid="attention-notice"
              data-kind={n.kind}
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-colors duration-1000 animate-in fade-in slide-in-from-right-4',
                idle ? 'border-white/10 bg-neutral-900/90 text-white/85' : 'border-border bg-card text-card-foreground',
              )}
            >
              <span className={cn('mt-0.5 shrink-0', idle ? 'text-white/60' : 'text-primary')}>{ICONS[n.kind]}</span>
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 font-semibold leading-snug">{n.title}</div>
                <div className={cn('text-sm', idle ? 'text-white/55' : 'text-muted-foreground')}>{detail(n, now, time)}</div>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                className={cn('-m-1 shrink-0 rounded-md p-1', idle ? 'text-white/55 hover:bg-white/10' : 'text-muted-foreground hover:bg-muted')}
                onClick={() => setDismissed((prev) => new Set(prev).add(n.id))}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </aside>
      )}
    </>
  );
}
