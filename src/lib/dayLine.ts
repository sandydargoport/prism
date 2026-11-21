import { nightsTouching, type IdleSwitch } from './idleBackground';
import type { Placement } from './timeline';

/**
 * The Through the day line (#1170): one day on the screen's wall clock, as
 * stretches of resting and night, the moments night starts and ends, and the
 * dashboards placed on it (#1266). Minutes run 0 to 1440 by the wall clock, so a day with
 * a clock change still reads 6:30 where the clock says 6:30.
 */

export const DAY_MINUTES = 24 * 60;

export type Stretch = { kind: 'resting' | 'night'; from: number; to: number };
export type Milestone = { kind: 'night-start' | 'night-end'; minute: number };
export type PlacementSpan = { index: number; from: number; to: number; partial: boolean };

const wall = (d: Date) => d.getHours() * 60 + d.getMinutes();
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Night and resting across the local day of `day`, and where night starts and ends in it. */
export function dayLine(day: Date, rule: IdleSwitch, lat: number, lon: number): { stretches: Stretch[]; milestones: Milestone[] } {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  const nights: { from: number; to: number }[] = [];
  const milestones: Milestone[] = [];
  for (const n of nightsTouching(day, rule, lat, lon)) {
    const from = n.start <= start ? 0 : wall(n.start);
    const to = n.end >= end ? DAY_MINUTES : wall(n.end);
    if (n.start > start) milestones.push({ kind: 'night-start', minute: from });
    if (n.end < end) milestones.push({ kind: 'night-end', minute: to });
    if (to > from) nights.push({ from, to });
  }
  nights.sort((a, b) => a.from - b.from);
  const stretches: Stretch[] = [];
  let at = 0;
  for (const n of nights) {
    if (n.from > at) stretches.push({ kind: 'resting', from: at, to: n.from });
    const from = Math.max(at, n.from);
    if (n.to > from) stretches.push({ kind: 'night', from, to: n.to });
    at = Math.max(at, n.to);
  }
  if (at < DAY_MINUTES) stretches.push({ kind: 'resting', from: at, to: DAY_MINUTES });
  milestones.sort((a, b) => a.minute - b.minute);
  return { stretches, milestones };
}

/**
 * Where each placement falls on a set of days (#1266), one block per part:
 * its own hours on its days, and the morning part of one that ran past
 * midnight from the day before. A placement on several of the days is one
 * block, not one per day. `partial` marks one that is on only some of them.
 */
export function placementSpans(placements: Placement[], days: number[]): PlacementSpan[] {
  const set = [...new Set(days)];
  const spans: PlacementSpan[] = [];
  /** The days of `set` that `on` covers, after shifting `set` back by `back` days. */
  const touching = (on: number[], back: number) => set.filter((d) => on.includes((d + 7 - back) % 7));
  placements.forEach((p, index) => {
    const from = minutesOf(p.from);
    const to = minutesOf(p.to);
    const part = (back: number, a: number, b: number) => {
      const hit = touching(p.days, back);
      if (hit.length > 0) spans.push({ index, from: a, to: b, partial: hit.length < set.length });
    };
    if (from === to) part(0, 0, DAY_MINUTES);
    else if (from < to) part(0, from, to);
    else {
      part(1, 0, to);
      part(0, from, DAY_MINUTES);
    }
  });
  return spans;
}

/** "HH:MM" for a minute of the day, wrapping past midnight. */
export function hhmm(minute: number): string {
  const m = ((Math.round(minute) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export type Placed = { left: number; lane: number };

/**
 * Where placement blocks go once their widths are known, in px on a line
 * `lineWidth` wide: each at its own start, moved left only as far as the
 * line's end forces, and down a row when it would touch one already placed.
 */
export function placeBlocks(blocks: { start: number; width: number }[], lineWidth: number, gap = 4): Placed[] {
  const order = blocks.map((b, i) => i).sort((a, b) => blocks[a]!.start - blocks[b]!.start);
  const laneEnds: number[] = [];
  const placed: Placed[] = new Array(blocks.length);
  for (const i of order) {
    const { start, width } = blocks[i]!;
    const left = Math.max(0, Math.min(start, lineWidth - width));
    let lane = laneEnds.findIndex((end) => left >= end + gap);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
    laneEnds[lane] = left + width;
    placed[i] = { left, lane };
  }
  return placed;
}
