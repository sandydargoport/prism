'use client';

/**
 * The day as the sun's path (#909). Geometry in src/lib/today/arc.ts.
 *
 * The path behind the sun is a faint solid line, the stretch from the sun to
 * the next event is lit, the rest of the day ahead is a clean hairline, and
 * after sunset it turns dashed and dips below the horizon. Each timed event
 * today is a bead in its person's colour; events still ahead carry a label
 * with the title and the time ("Scouts 6", "Soccer until 5:30"). No
 * countdowns: the time and the bead's place say when.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay, formatBareTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { arcAxis, arcPoint, arcPolyline, hourOf, type ArcPoint } from '@/lib/today/arc';
import { placeLabels, type Rect } from '@/lib/today/labels';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/** Width of a line of text in the label's font, read from a probe element. */
function useTextWidth(probe: React.RefObject<HTMLElement | null>) {
  const canvas = useMemo(() => (typeof document === 'undefined' ? null : document.createElement('canvas')), []);
  return (text: string): { width: number; height: number } => {
    const el = probe.current;
    const ctx = canvas?.getContext('2d');
    if (!el || !ctx) return { width: text.length * 12, height: 28 };
    const cs = getComputedStyle(el);
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    return { width: Math.ceil(ctx.measureText(text).width) + 2, height: Math.ceil(lh) };
  };
}

function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, ...size };
}

const toPath = (pts: ArcPoint[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('');

export function SunArc({ events, now, sunrise, sunset, onOpenEvent, onlyNext = false }: {
  events: CalendarEvent[];
  now: Date;
  sunrise?: Date;
  sunset?: Date;
  onOpenEvent?: (event: CalendarEvent) => void;
  /** Idle (#926): label only the next event. */
  onlyNext?: boolean;
}) {
  const t = useTranslations('today');
  const { timeFormat, displayTimezone } = useTimeFormat();
  const { ref, width, height } = useBoxSize<HTMLDivElement>();
  const probe = useRef<HTMLDivElement>(null);
  const measure = useTextWidth(probe);
  const [foldedOpen, setFoldedOpen] = useState(false);

  const hour = (d: Date) => hourOf(toDisplayDate(d, displayTimezone));
  const nowH = hour(now);
  const rise = sunrise ? hour(sunrise) : 7;
  const set = sunset ? hour(sunset) : 19;

  // The horizon sits near the bottom of the band; the peak about two thirds up.
  const box = { width, horizon: height * 0.8, amp: Math.min(height * 0.6, 160) };

  const today = toDisplayDate(now, displayTimezone);
  const timed = events
    .filter((e) => !e.allDay && eventOccursOnDisplayDay(e.startTime, e.endTime, e.allDay, today, displayTimezone))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const allDay = events.filter((e) => e.allDay && eventOccursOnDisplayDay(e.startTime, e.endTime, e.allDay, today, displayTimezone));
  const ahead = timed.filter((e) => e.endTime.getTime() > now.getTime());
  const axis = arcAxis(nowH, {
    portrait: height > width,
    firstHour: timed.length ? hour(timed[0]!.startTime) : undefined,
    lastHour: timed.length ? Math.max(...timed.map((e) => hour(e.endTime))) : undefined,
  });
  const at = (h: number) => arcPoint(axis, h, rise, set, box);
  const nextStart = ahead.find((e) => e.startTime.getTime() > now.getTime());
  const nextH = nextStart ? hour(nextStart.startTime) : nowH;
  const time = (d: Date) => formatBareTime(d, timeFormat, displayTimezone);

  const ready = width > 0 && height > 0;
  const end = axis.end;
  const sun = at(Math.min(Math.max(nowH, axis.start), end));
  const sunDown = nowH >= set || nowH < rise;
  // Path pieces: the past, the lit stretch to the next event, the rest by day, and after sunset.
  const pieces = ready ? [
    { key: 'past', from: axis.start, to: Math.max(axis.start, Math.min(nowH, end)), cls: 'stroke-white/25', w: 1.5 },
    { key: 'lit', from: Math.min(nowH, end), to: Math.min(Math.max(nowH, nextH), set, end), cls: 'stroke-white', w: 3 },
    { key: 'ahead', from: Math.min(Math.max(nowH, nextH), end), to: Math.max(Math.min(set, end), Math.min(Math.max(nowH, nextH), end)), cls: 'stroke-white/65', w: 2 },
    { key: 'night', from: Math.max(set, nowH, axis.start), to: end, cls: 'stroke-white/55', w: 2, dash: true },
  ].filter((p) => p.to > p.from) : [];
  const ticks = [];
  for (let h = Math.ceil(nowH); h < end; h++) if (h > axis.start) ticks.push(h);

  // Busy days (#910): labels placed so none overlap, the rest folded into "+N".
  const labelText = (e: CalendarEvent) => (e.startTime.getTime() <= now.getTime()
    ? t('until', { title: e.title, time: time(e.endTime) })
    : t('at', { title: e.title, time: time(e.startTime) }));
  const path = ready ? arcPolyline(axis, axis.start, end, rise, set, box) : [];
  const pathTop = (x0: number, x1: number) => {
    let top = Infinity;
    for (const p of path) if (p.x >= x0 && p.x <= x1 && p.y < top) top = p.y;
    return top === Infinity ? box.horizon : top;
  };
  const sunsetText = sunset ? t('sunset', { time: time(sunset) }) : '';
  const sunsetAt = set > axis.start && set < end ? at(set) : null;
  const obstacles: Rect[] = [{ left: sun.x - 22, top: sun.y - 22, width: 44, height: 44 }];
  if (sunsetAt && sunsetText) {
    const m = measure(sunsetText);
    obstacles.push({ left: sunsetAt.x - 6 - m.width, top: sunsetAt.y + 12, width: m.width, height: m.height });
  }
  const labelled = onlyNext ? ahead.slice(0, 1) : ahead;
  const layout = ready ? placeLabels(
    labelled.map((e) => { const p = at(hour(e.startTime)); return { id: e.id, x: p.x, y: p.y, ...measure(labelText(e)) }; }),
    { width, top: 0, obstacles, pathTop },
  ) : { placed: [], folded: [] };
  const foldedEvents = onlyNext ? [] : ahead.filter((e) => layout.folded.includes(e.id));
  // "+N" sits by the first folded bead if there is room, else at the end of the arc.
  const more = foldedEvents.length > 0 ? (() => {
    const first = at(hour(foldedEvents[0]!.startTime));
    // A 44px target, placed at its full height so it never covers a label.
    const text = measure(t('more', { count: foldedEvents.length }));
    const m = { width: Math.max(text.width, 44), height: Math.max(text.height, 44) };
    const spot = placeLabels([{ id: 'more', x: first.x, y: first.y, ...m }], {
      width, top: 0, obstacles: [...obstacles, ...layout.placed], pathTop, max: 1,
    }).placed[0];
    // No room by the bead: at the top of the arc's box, above it.
    return spot ?? { left: Math.min(Math.max(0, first.x - m.width / 2), width - m.width), top: 0, width: m.width, height: m.height };
  })() : null;

  return (
    <div ref={ref} className="absolute inset-0" data-sun-arc>
      {ready && (
        <svg width={width} height={height} className="absolute inset-0 overflow-visible" aria-hidden>
          <defs>
            <filter id="sun-glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>
          {/* The whole path, unseen: what the beads sit on (and what a test measures). */}
          <path d={toPath(arcPolyline(axis, axis.start, end, rise, set, box))} fill="none" stroke="none" data-arc-path />
          {pieces.map((p) => (
            <path
              key={p.key}
              d={toPath(arcPolyline(axis, p.from, p.to, rise, set, box))}
              fill="none"
              className={p.cls}
              strokeWidth={p.w}
              strokeLinecap="round"
              strokeDasharray={p.dash ? '6 8' : undefined}
              style={p.key === 'lit' ? { filter: 'drop-shadow(0 0 4px rgb(255 255 255 / 0.6))' } : undefined}
            />
          ))}
          {ticks.map((h) => {
            const p = at(h);
            return <line key={h} x1={p.x} x2={p.x} y1={p.y - 4.5} y2={p.y + 4.5} className="stroke-white/70" strokeWidth={2.4} data-arc-tick />;
          })}
          {set > axis.start && set < end && (() => {
            const p = at(set);
            return <line x1={p.x} x2={p.x} y1={p.y - 11} y2={p.y + 11} className="stroke-white/80" strokeWidth={2} data-arc-sunset />;
          })()}
          {timed.map((e) => {
            const p = at(hour(e.startTime));
            const past = e.endTime.getTime() <= now.getTime();
            return (
              <circle
                key={e.id}
                cx={p.x}
                cy={p.y}
                r={past ? 5 : 7}
                fill={e.color}
                fillOpacity={past ? 0.6 : 1}
                stroke="white"
                strokeOpacity={past ? 0.4 : 0.9}
                strokeWidth={2}
                data-arc-bead
                data-start={e.startTime.getTime()}
                data-past={past || undefined}
              />
            );
          })}
          {/* A 44px target round each bead: tapping it opens the event (#836). */}
          {onOpenEvent && timed.map((e) => {
            const p = at(hour(e.startTime));
            return (
              <circle
                key={`hit-${e.id}`}
                cx={p.x}
                cy={p.y}
                r={22}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => onOpenEvent(e)}
                data-arc-bead-hit
                data-title={e.title}
              />
            );
          })}
          {/* Down after sunset and before sunrise: smaller, cooler, no glow (#926). */}
          {sunDown ? (
            <circle cx={sun.x} cy={sun.y} r={5} fill="rgb(196 206 228)" opacity={0.7} data-arc-sun data-sun-down />
          ) : (
            <>
              <circle cx={sun.x} cy={sun.y} r={16} fill="rgb(255 236 200)" opacity={0.55} filter="url(#sun-glow)" />
              <circle cx={sun.x} cy={sun.y} r={9} fill="rgb(255 244 224)" data-arc-sun />
            </>
          )}
        </svg>
      )}

      {/* Unseen: the label font, for measuring. */}
      <div ref={probe} className="invisible absolute whitespace-nowrap text-body font-medium" aria-hidden>M</div>

      {ready && layout.placed.length > 0 && (
        <svg width={width} height={height} className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden>
          {layout.placed.filter((l) => l.leader).map((l) => {
            const e = ahead.find((x) => x.id === l.id)!;
            const p = at(hour(e.startTime));
            return <line key={l.id} x1={p.x} x2={p.x} y1={l.top + l.height + 3} y2={p.y - 9} className="stroke-white/60" strokeWidth={1} data-arc-leader />;
          })}
        </svg>
      )}

      {layout.placed.map((l) => {
        const e = ahead.find((x) => x.id === l.id)!;
        return (
          <div
            key={l.id}
            className={`absolute whitespace-nowrap text-body font-medium${onOpenEvent ? ' cursor-pointer' : ''}`}
            style={{ left: l.left, top: l.top, width: l.width }}
            onClick={onOpenEvent ? () => onOpenEvent(e) : undefined}
            data-arc-label
          >
            {labelText(e)}
          </div>
        );
      })}

      {more && (
        <button
          type="button"
          className="absolute flex min-h-[44px] items-center whitespace-nowrap text-body font-semibold underline-offset-4 hover:underline"
          style={{ left: more.left, top: more.top, width: more.width, height: more.height }}
          onClick={() => setFoldedOpen(true)}
          data-arc-more
        >
          {t('more', { count: foldedEvents.length })}
        </button>
      )}

      <Dialog open={foldedOpen} onOpenChange={setFoldedOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t('laterToday')}</DialogTitle>
          <ul className="flex flex-col gap-3" data-arc-more-list>
            {foldedEvents.map((e) => (
              <li key={e.id} className="flex items-baseline gap-3 text-body">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <span className="tabular-nums text-muted-foreground">{time(e.startTime)}</span>
                <span>{e.title}</span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      {ready && ahead.length === 0 && (
        <div className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap text-body" style={{ left: sun.x, top: sun.y - 22 }} data-arc-empty>
          {t('nothingElse')}
        </div>
      )}

      {ready && sunsetAt && sunsetText && (
        <div className="absolute -translate-x-full whitespace-nowrap text-body opacity-80" style={{ left: sunsetAt.x - 6, top: sunsetAt.y + 12 }} data-arc-sunset-label>
          {sunsetText}
        </div>
      )}

      {ready && allDay.length > 0 && (
        <div className="absolute left-0 whitespace-nowrap text-caption opacity-90" style={{ top: box.horizon + 18 }} data-arc-all-day>
          {t('allDay', { titles: allDay.map((e) => e.title).join(', ') })}
        </div>
      )}
    </div>
  );
}
