import type { PerfLevel } from './perfLevel';

/**
 * Auto performance (#691): watch real frames while the screen fades between
 * idle and awake, and step down a level when it cannot keep up.
 *
 * This replaces a guess from core count and memory, which put a capable
 * 4-core mini PC in performance mode. A fade is the right thing to time: it is
 * the most work the screen does on its own, and it happens every time someone
 * walks up to it.
 *
 * One slow frame, or one bad fade, is not a verdict: a photo decoding or a
 * poll landing mid-fade can do that on any hardware. It takes BAD_FADES_TO_STEP
 * bad fades in a row, and a good one in between starts the count again. Auto
 * never steps back up on its own: a screen that struggled once will struggle
 * again, and flipping between levels would itself look like a fault.
 */

/** A frame slower than this missed at least two refreshes at 60 Hz. */
export const SLOW_FRAME_MS = 50;
/** A fade with more than this share of slow frames looked choppy. */
export const SLOW_SHARE = 0.2;
/** Bad fades in a row before stepping down. */
export const BAD_FADES_TO_STEP = 3;
/** How long to watch after each change, a little past the 1 s fade. */
export const WATCH_MS = 1200;

/** Whether a fade, given the gaps between its frames, looked choppy. */
export function fadeWasBad(frameGapsMs: readonly number[]): boolean {
  // Too few frames to judge: the tab was throttled, or the watch was cut short.
  if (frameGapsMs.length < 5) return false;
  const slow = frameGapsMs.filter(gap => gap > SLOW_FRAME_MS).length;
  return slow / frameGapsMs.length > SLOW_SHARE;
}

export type AutoState = { level: PerfLevel; badInARow: number };

function stepDown(level: PerfLevel): PerfLevel {
  return level === 'full' ? 'reduced' : 'minimal';
}

/** The state after one more fade. */
export function afterFade(state: AutoState, bad: boolean): AutoState {
  if (!bad) return { level: state.level, badInARow: 0 };
  const badInARow = state.badInARow + 1;
  if (badInARow < BAD_FADES_TO_STEP || state.level === 'minimal') {
    return { level: state.level, badInARow };
  }
  return { level: stepDown(state.level), badInARow: 0 };
}

/** The gaps between animation frames over `ms`, as the browser drew them. */
export function watchFrames(ms: number): Promise<number[]> {
  return new Promise(resolve => {
    const gaps: number[] = [];
    let last: number | undefined;
    let start: number | undefined;
    const tick = (now: number) => {
      if (last !== undefined) gaps.push(now - last);
      last = now;
      start ??= now;
      if (now - start < ms) requestAnimationFrame(tick);
      else resolve(gaps);
    };
    requestAnimationFrame(tick);
  });
}
