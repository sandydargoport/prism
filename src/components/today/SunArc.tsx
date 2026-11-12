'use client';

/**
 * The day as the sun's path (#909). Geometry in src/lib/today/arc.ts.
 *
 * The path behind the sun is a faint solid line, the stretch from the sun to
 * the next event is lit, the rest of the day ahead is a clean hairline, and
 * after sunset it turns dotted and keeps curving below the horizon, never flat.
 * The moon has its own fainter curve between moonrise and moonset, and at
 * night the moon sits on it in its phase (#994). Low and thin on purpose: an
 * instrument line, not a picture. Each timed event
 * today is a bead in its person's colour; events still ahead carry a label
 * with the title and the time ("Scouts 6", "Soccer until 5:30"). No
 * countdowns: the time and the bead's place say when.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay, formatBareTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { arcAxis, arcPoint, arcPolyline, bodyHeight, hourOf, type ArcPoint } from '@/lib/today/arc';
import { MoonGlyph } from '@/components/widgets/WeatherWidget';
import { placeLabels, type Rect } from '@/lib/today/labels';

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

export function SunArc({ events, now, sunrise, sunset, moonrise, moonset, moonPhase, onOpenEvent, onlyNext = false }: {
  events: CalendarEvent[];
  now: Date;
  sunrise?: Date;
  sunset?: Date;
  moonrise?: Date;
  moonset?: Date;
  /** 0 new, 0.5 full (as the weather gives it). */
  moonPhase?: number;
  onOpenEvent?: (event: CalendarEvent) => void;
  /** Idle (#926): label only the next event. */
  onlyNext?: boolean;
}) {
  const t = useTranslations('today');
  const { timeFormat, displayTimezone } = useTimeFormat();
  const { ref, width, height } = useBoxSize<HTMLDivElement>();
  const probe = useRef<HTMLDivElement>(null);
  const measure = useTextWidth(probe);

  const hour = (d: Date) => hourOf(toDisplayDate(d, displayTimezone));
  const nowH = hour(now);
  const rise = sunrise ? hour(sunrise) : 7;
  const set = sunset ? hour(sunset) : 19;

  // Low and flat (#994): the peak well under half the band, and room under the
  // horizon for the night's curve.
  const box = { width, horizon: height * 0.62, amp: Math.min(height * 0.42, 96) };

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
    { key: 'past', from: axis.start, to: Math.max(axis.start, Math.min(nowH, end)), cls: 'stroke-white/25', w: 1 },
    { key: 'lit', from: Math.min(nowH, end), to: Math.min(Math.max(nowH, nextH), set, end), cls: 'stroke-white', w: 2 },
    { key: 'ahead', from: Math.min(Math.max(nowH, nextH), end), to: Math.max(Math.min(set, end), Math.min(Math.max(nowH, nextH), end)), cls: 'stroke-white/65', w: 1.5 },
    { key: 'night', from: Math.max(set, nowH, axis.start), to: end, cls: 'stroke-white/55', w: 1.25, dash: true },
  ].filter((p) => p.to > p.from) : [];
  // The moon's own curve (#994), fainter and lower than the sun's.
  const mr = moonrise ? hour(moonrise) : null;
  const ms = moonset ? hour(moonset) : null;
  const moonAt = (h: number): ArcPoint => ({ x: axis.x(h) * width, y: box.horizon - box.amp * 0.7 * bodyHeight(h, mr!, ms!) });
  const moonPath: ArcPoint[] = [];
  if (ready && mr !== null && ms !== null) for (let h = axis.start; h <= end + 1e-9; h += 1 / 12) moonPath.push(moonAt(Math.min(h, end)));
  const moonUp = mr !== null && ms !== null && bodyHeight(nowH, mr, ms) > 0;
  const moon = sunDown && moonUp && moonPhase !== undefined ? moonAt(Math.min(Math.max(nowH, axis.start), end)) : null;
  const ticks = [];
  for (let h = Math.ceil(nowH); h < end; h++) if (h > axis.start) ticks.push(h);

  // Busy days (#910): labels placed so none overlap. What does not fit stays a
  // bead on the line, tappable, with no "+N" count (#993).
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
  if (moon) obstacles.push({ left: moon.x - 16, top: moon.y - 16, width: 32, height: 32 });
  if (sunsetAt && sunsetText) {
    const m = measure(sunsetText);
    obstacles.push({ left: sunsetAt.x - 6 - m.width, top: sunsetAt.y + 12, width: m.width, height: m.height });
  }
  const labelled = onlyNext ? ahead.slice(0, 1) : ahead;
  const layout = ready ? placeLabels(
    labelled.map((e) => { const p = at(hour(e.startTime)); return { id: e.id, x: p.x, y: p.y, ...measure(labelText(e)) }; }),
    { width, top: 0, obstacles, pathTop },
  ) : { placed: [], folded: [] };

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
          {moonPath.length > 1 && (
            <path
              d={toPath(moonPath)}
              fill="none"
              stroke="rgb(255 226 190)"
              strokeOpacity={sunDown ? 0.55 : 0.2}
              strokeWidth={1.25}
              strokeDasharray="1 5"
              strokeLinecap="round"
              data-arc-moon-path
            />
          )}
          {pieces.map((p) => (
            <path
              key={p.key}
              d={toPath(arcPolyline(axis, p.from, p.to, rise, set, box))}
              fill="none"
              className={p.cls}
              strokeWidth={p.w}
              strokeLinecap="round"
              strokeDasharray={p.dash ? '2 6' : undefined}
              data-arc-piece={p.key}
              style={p.key === 'lit' ? { filter: 'drop-shadow(0 0 2px rgb(255 255 255 / 0.5))' } : undefined}
            />
          ))}
          {ticks.map((h) => {
            const p = at(h);
            return <line key={h} x1={p.x} x2={p.x} y1={p.y - 3} y2={p.y + 3} className="stroke-white/60" strokeWidth={1.5} data-arc-tick />;
          })}
          {set > axis.start && set < end && (() => {
            const p = at(set);
            return <line x1={p.x} x2={p.x} y1={p.y - 7} y2={p.y + 7} className="stroke-white/70" strokeWidth={1.5} data-arc-sunset />;
          })()}
          {timed.map((e) => {
            const p = at(hour(e.startTime));
            const past = e.endTime.getTime() <= now.getTime();
            return (
              <circle
                key={e.id}
                cx={p.x}
                cy={p.y}
                r={past ? 3.5 : 5}
                fill={e.color}
                fillOpacity={past ? 0.6 : 1}
                stroke="white"
                strokeOpacity={past ? 0.3 : 0.7}
                strokeWidth={1.25}
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
            <circle cx={sun.x} cy={sun.y} r={3.5} fill="rgb(196 206 228)" opacity={0.6} data-arc-sun data-sun-down />
          ) : (
            <>
              <circle cx={sun.x} cy={sun.y} r={11} fill="none" stroke="rgb(255 244 224)" strokeOpacity={0.35} strokeWidth={1} />
              <circle cx={sun.x} cy={sun.y} r={6} fill="rgb(255 244 224)" data-arc-sun />
            </>
          )}
        </svg>
      )}

      {/* At night the moon sits on its curve, in its phase (#994). */}
      {ready && moon && (
        <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: moon.x, top: moon.y }} aria-hidden data-arc-moon>
          <MoonGlyph phase={moonPhase!} size={18} color="rgb(255 226 190)" />
        </div>
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

      {ready && ahead.length === 0 && (
        // Under the line when the moon is up, so the two never overlap.
        <div className={`absolute -translate-x-1/2 whitespace-nowrap text-body ${moon ? '' : '-translate-y-full'}`} style={{ left: sun.x, top: moon ? sun.y + 16 : sun.y - 22 }} data-arc-empty>
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
