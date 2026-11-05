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
import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { CalendarEvent } from '@/types/calendar';
import { useTimeFormat } from '@/components/providers';
import { eventOccursOnDisplayDay, formatBareTime, toDisplayDate } from '@/lib/utils/timeFormat';
import { arcAxis, arcPoint, arcPolyline, hourOf, type ArcPoint } from '@/lib/today/arc';

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

export function SunArc({ events, now, sunrise, sunset }: {
  events: CalendarEvent[];
  now: Date;
  sunrise?: Date;
  sunset?: Date;
}) {
  const t = useTranslations('today');
  const { timeFormat, displayTimezone } = useTimeFormat();
  const { ref, width, height } = useBoxSize<HTMLDivElement>();

  const hour = (d: Date) => hourOf(toDisplayDate(d, displayTimezone));
  const nowH = hour(now);
  const rise = sunrise ? hour(sunrise) : 7;
  const set = sunset ? hour(sunset) : 19;
  const axis = arcAxis(nowH, { portrait: height > width });
  // The horizon sits near the bottom of the band; the peak about two thirds up.
  const box = { width, horizon: height * 0.8, amp: Math.min(height * 0.6, 160) };
  const at = (h: number) => arcPoint(axis, h, rise, set, box);

  const today = toDisplayDate(now, displayTimezone);
  const timed = events
    .filter((e) => !e.allDay && eventOccursOnDisplayDay(e.startTime, e.endTime, e.allDay, today, displayTimezone))
    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  const allDay = events.filter((e) => e.allDay && eventOccursOnDisplayDay(e.startTime, e.endTime, e.allDay, today, displayTimezone));
  const ahead = timed.filter((e) => e.endTime.getTime() > now.getTime());
  const nextStart = ahead.find((e) => e.startTime.getTime() > now.getTime());
  const nextH = nextStart ? hour(nextStart.startTime) : nowH;
  const time = (d: Date) => formatBareTime(d, timeFormat, displayTimezone);

  const ready = width > 0 && height > 0;
  const end = axis.end;
  const sun = at(Math.min(Math.max(nowH, axis.start), end));
  // Path pieces: the past, the lit stretch to the next event, the rest by day, and after sunset.
  const pieces = ready ? [
    { key: 'past', from: axis.start, to: Math.max(axis.start, Math.min(nowH, end)), cls: 'stroke-white/40', w: 2 },
    { key: 'lit', from: Math.min(nowH, end), to: Math.min(Math.max(nowH, nextH), set, end), cls: 'stroke-white', w: 3 },
    { key: 'ahead', from: Math.min(Math.max(nowH, nextH), end), to: Math.max(Math.min(set, end), Math.min(Math.max(nowH, nextH), end)), cls: 'stroke-white/65', w: 2 },
    { key: 'night', from: Math.max(set, nowH, axis.start), to: end, cls: 'stroke-white/55', w: 2, dash: true },
  ].filter((p) => p.to > p.from) : [];
  const ticks = [];
  for (let h = Math.ceil(nowH); h < end; h++) if (h > axis.start) ticks.push(h);

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
          <circle cx={sun.x} cy={sun.y} r={16} fill="rgb(255 236 200)" opacity={0.55} filter="url(#sun-glow)" />
          <circle cx={sun.x} cy={sun.y} r={9} fill="rgb(255 244 224)" data-arc-sun />
        </svg>
      )}

      {ready && ahead.map((e) => {
        const p = at(hour(e.startTime));
        const inProgress = e.startTime.getTime() <= now.getTime();
        return (
          <div
            key={e.id}
            className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap text-body font-medium"
            style={{ left: p.x, top: p.y - 14 }}
            data-arc-label
          >
            {inProgress ? t('until', { title: e.title, time: time(e.endTime) }) : t('at', { title: e.title, time: time(e.startTime) })}
          </div>
        );
      })}

      {ready && ahead.length === 0 && (
        <div className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap text-body" style={{ left: sun.x, top: sun.y - 22 }} data-arc-empty>
          {t('nothingElse')}
        </div>
      )}

      {ready && sunset && set > axis.start && set < end && (() => {
        const p = at(set);
        return (
          <div className="absolute -translate-x-full whitespace-nowrap text-caption opacity-80" style={{ left: p.x - 6, top: p.y + 12 }} data-arc-sunset-label>
            {t('sunset', { time: time(sunset) })}
          </div>
        );
      })()}

      {ready && allDay.length > 0 && (
        <div className="absolute left-0 whitespace-nowrap text-caption opacity-90" style={{ top: box.horizon + 18 }} data-arc-all-day>
          {t('allDay', { titles: allDay.map((e) => e.title).join(', ') })}
        </div>
      )}
    </div>
  );
}
