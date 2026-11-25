'use client';

/**
 * The Screen tab's picture of today (#1349): one bar, night as shading by the
 * screen's own rule, each switch a band in its row's swatch colour, never
 * narrower than 12px, and a line at now. It only shows; the rows below it
 * say every time in words.
 */
import * as React from 'react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { stripGeometry } from '@/lib/dayStrip';
import { DAY_MINUTES, type NightSpan, type SwitchSpan } from '@/lib/dayWaypoints';
import { cn } from '@/lib/utils';
import { paint } from './sheetRows';

/** The bar's width, measured, and again whenever it changes; 0 before it is laid out. */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // The bands are placed inside its border.
    const read = () => setWidth(el.clientWidth);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(read);
    watch.observe(el);
    return () => watch.disconnect();
  }, [ref]);
  return width;
}

/** Minutes into the day now, on this clock, again each minute. */
export function useMinuteNow(): number {
  const of = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const [now, setNow] = useState(of);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(of()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

const pct = (minute: number) => `${(minute / DAY_MINUTES) * 100}%`;

export function DayStrip({ nights, spans, now, tick, caption }: {
  nights: NightSpan[];
  spans: SwitchSpan[];
  /** Now, in minutes into the day. */
  now: number;
  /** A time under the bar, by the household's clock. */
  tick: (minute: number) => string;
  /** The line under it: what the shading and the line are. */
  caption: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const g = stripGeometry({ width, nights, spans, now });
  // Before it is laid out (and in tests with no layout) it is drawn in
  // percent, each band still at least 12px wide.
  const place = (b: { left: number; width: number }, from: number, to: number, min = 0): React.CSSProperties => (width > 0
    ? { left: b.left, width: b.width }
    : { left: pct(from), width: pct(to - from), minWidth: min });
  return (
    <div className="flex flex-col gap-1.5" data-day-strip>
      <div ref={ref} className="relative h-[30px] overflow-hidden rounded-lg border border-border bg-muted" role="img"
        aria-label={caption} data-strip-bar>
        {nights.map((n, i) => (
          <span key={`n${n.from}`} aria-hidden className="absolute inset-y-0 bg-foreground/15" style={place(g.nights[i]!, n.from, n.to)} data-strip-night />
        ))}
        {g.bands.map((b) => {
          const p = paint(b.index);
          return (
            <span key={`s${b.index}-${b.from}`} aria-hidden className={cn('absolute inset-y-[5px] rounded', p.className)}
              style={{ ...place(b, b.from, b.to, 12), ...p.style }} data-strip-band={b.index} data-color={p.color} />
          );
        })}
        <span aria-hidden className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground" style={width > 0 ? { left: g.now } : { left: pct(now) }} data-strip-now />
      </div>
      <div className="relative h-4 text-caption text-muted-foreground" aria-hidden data-strip-ticks>
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h} className={cn('absolute top-0 whitespace-nowrap', h === 0 ? '' : h === 24 ? '-translate-x-full' : '-translate-x-1/2')}
            style={{ left: pct(h * 60) }}>
            {tick(h * 60)}
          </span>
        ))}
      </div>
      <p className="m-0 text-caption text-muted-foreground" data-strip-caption>{caption}</p>
    </div>
  );
}
