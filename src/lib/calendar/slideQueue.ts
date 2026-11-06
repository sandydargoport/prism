/**
 * Who may slide now (#901). A title too long for its event slides so it can
 * be read, but only a few at a time and never all starting together: the
 * screen must not fill with moving text. Each title slides once, then goes to
 * the back of the queue.
 */
export const SLIDE = {
  /** Travel speed of a sliding title. */
  pxPerSecond: 30,
  /** Rest at each end, so the start and the end can be read. */
  pauseMs: 1500,
  /** Titles sliding at once. */
  maxAtOnce: 3,
  /** Gap between two titles starting. */
  staggerMs: 900,
} as const;

/** One slide there and back, in ms, for a title `distance` px too long. */
export function slideDuration(distance: number): number {
  return 2 * SLIDE.pauseMs + 2 * (distance / SLIDE.pxPerSecond) * 1000;
}

/** Runs one slide; resolves when it is over. */
export type Slide = () => Promise<void>;

export function createSlideQueue(opts: {
  maxAtOnce?: number;
  staggerMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
} = {}) {
  const maxAtOnce = opts.maxAtOnce ?? SLIDE.maxAtOnce;
  const staggerMs = opts.staggerMs ?? SLIDE.staggerMs;
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const waiting: Slide[] = [];
  const active = new Set<Slide>();
  const joined = new Set<Slide>();
  let nextStartAt = 0;
  let timerSet = false;

  const pump = (now: number) => {
    timerSet = false;
    while (active.size < maxAtOnce && waiting.length > 0) {
      if (now < nextStartAt) {
        if (!timerSet) { timerSet = true; setTimer(() => pump(Date.now()), nextStartAt - now); }
        return;
      }
      const slide = waiting.shift()!;
      active.add(slide);
      nextStartAt = now + staggerMs;
      void slide().catch(() => {}).finally(() => {
        active.delete(slide);
        // Back of the queue, if it is still on screen.
        if (joined.has(slide)) waiting.push(slide);
        pump(Date.now());
      });
    }
  };

  return {
    /** Queue a title's slide; returns how to leave the queue. */
    join(slide: Slide): () => void {
      joined.add(slide);
      waiting.push(slide);
      pump(Date.now());
      return () => {
        joined.delete(slide);
        const i = waiting.indexOf(slide);
        if (i >= 0) waiting.splice(i, 1);
      };
    },
    /** For tests: how many are sliding now. */
    get activeCount() { return active.size; },
  };
}

/** The one queue the calendar's titles share. */
export const slideQueue = createSlideQueue();
