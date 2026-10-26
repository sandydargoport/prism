'use client';

import { useMemo } from 'react';
import { traceOrder, type Placement, type Stroke } from './teach';

/** Seconds to draw each step out from the brightest star. */
const STEP = 0.7;
/** Seconds the finished figure and its name stay up, and take to fade. */
const HOLD = 18;
const FADE = 2;

/** When the last line is finished, in seconds from the start. */
function drawTime(strokes: Stroke[]): number {
  let last = 0;
  for (const s of strokes) last = Math.max(last, s.depth + 1);
  return last * STEP;
}

/** How long one lesson takes from first line to gone, in milliseconds. */
export function lessonLength(placement: Placement): number {
  return (drawTime(traceOrder(placement.fig)) + 0.6 + HOLD + FADE) * 1000;
}

/**
 * One constellation, drawn in over the sky and named, so the figures can be
 * learned over time.
 *
 * Each line grows out of a star already drawn, beginning at the brightest, and
 * each star brightens as the line reaches it. Then the name, what it means and
 * the names of its brightest stars come up, hold, and the whole figure fades
 * back into the faint one on the canvas. It is all CSS animation on an SVG over
 * the canvas, and only for the length of the lesson. With `still` (reduced
 * motion or Performance Mode) the figure simply appears whole.
 */
export function Constellation({ placement, still }: { placement: Placement; still: boolean }) {
  const { fig, points, box, height } = placement;
  const strokes = useMemo(() => traceOrder(fig), [fig]);
  const drawn = drawTime(strokes);
  // When the trace first reaches each star.
  const reached = useMemo(() => {
    const at = new Array<number>(points.length).fill(Infinity);
    for (const s of strokes) {
      at[s.from] = Math.min(at[s.from]!, s.depth * STEP);
      at[s.to] = Math.min(at[s.to]!, (s.depth + 1) * STEP);
    }
    return at;
  }, [strokes, points.length]);

  const scale = height / 1080;
  const centre = (box.left + box.right) / 2;
  // Under the figure, or over it when it sits low over the trees.
  const below = box.bottom < height * 0.72;
  const labelTop = below ? box.bottom + 24 * scale : box.top - 24 * scale;
  const named: { i: number; name: string }[] = [];
  for (let k = 0; k < fig.labels.length; k += 2) {
    named.push({ i: fig.labels[k] as number, name: fig.labels[k + 1] as string });
  }

  return (
    <div
      data-testid="night-sky-constellation"
      data-figure={fig.id}
      className={`night-sky-lesson absolute inset-0 ${still ? 'night-sky-still' : ''}`}
      style={{ animationDelay: `${drawn + 0.6 + HOLD}s`, animationDuration: `${FADE}s` }}
    >
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        <g
          stroke="rgba(200,218,255,0.85)"
          strokeWidth={Math.max(1.2, 1.8 * scale)}
          strokeLinecap="round"
          style={{ filter: 'drop-shadow(0 0 4px rgba(140,175,255,0.7))' }}
        >
          {strokes.map((s, k) => {
            const a = points[s.from]!;
            const b = points[s.to]!;
            return (
              <line
                key={k}
                data-testid="night-sky-stroke"
                data-from={s.from}
                data-depth={s.depth}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                pathLength={1}
                className="night-sky-trace"
                style={{ animationDelay: `${s.depth * STEP}s`, animationDuration: `${STEP}s` }}
              />
            );
          })}
        </g>
        {points.map((p, i) => (
          Number.isFinite(reached[i]) && (
            <circle
              key={i}
              cx={p.x} cy={p.y}
              r={Math.max(2.5, (4.2 - fig.v[i * 3 + 2]! * 0.5) * scale)}
              fill="rgba(235,242,255,0.95)"
              className="night-sky-appear"
              style={{ animationDelay: `${reached[i]}s`, filter: 'drop-shadow(0 0 5px rgba(170,200,255,0.9))' }}
            />
          )
        ))}
        {named.map(({ i, name }) => (
          <text
            key={name}
            data-testid="night-sky-star-name"
            x={points[i]!.x + 10 * scale}
            y={points[i]!.y - 8 * scale}
            fill="rgba(220,230,255,0.8)"
            fontSize={Math.max(11, 17 * scale)}
            className="night-sky-appear"
            style={{ animationDelay: `${drawn + 0.3}s`, paintOrder: 'stroke', stroke: 'rgba(0,0,0,0.6)', strokeWidth: 3 }}
          >
            {name}
          </text>
        ))}
      </svg>
      <div
        className="night-sky-appear absolute text-center text-white"
        style={{
          left: centre,
          top: labelTop,
          transform: `translate(-50%, ${below ? '0' : '-100%'})`,
          animationDelay: `${drawn + 0.3}s`,
          textShadow: '0 1px 6px rgba(0,0,0,0.8)',
        }}
      >
        <div data-testid="night-sky-constellation-name" className="font-semibold tracking-[0.18em] uppercase" style={{ fontSize: Math.max(16, 30 * scale) }}>
          {fig.name}
        </div>
        <div className="italic opacity-75" style={{ fontSize: Math.max(12, 20 * scale) }}>
          {fig.meaning}
        </div>
      </div>
    </div>
  );
}
