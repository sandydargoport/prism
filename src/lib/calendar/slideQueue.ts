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
  /** Fade out at the end and in at the start, so it never reads backwards. */
  fadeMs: 300,
} as const;

/** One slide, in ms, for a title `distance` px too long: rest, travel, rest, fade out, fade in. */
export function slideDuration(distance: number): number {
  return 2 * SLIDE.pauseMs + (distance / SLIDE.pxPerSecond) * 1000 + 2 * SLIDE.fadeMs;
}

/**
 * The slide's keyframes (#901, one way): rest at the start, travel left so the
 * text reads left to right, rest at the end, fade out, jump back to the start
 * unseen, fade in. It never travels right while it can be seen.
 */
export function slideKeyframes(distance: number): Keyframe[] {
  const total = slideDuration(distance);
  const at = (ms: number) => ms / total;
  const travel = (distance / SLIDE.pxPerSecond) * 1000;
  const end = `translateX(-${distance}px)`;
  const a = SLIDE.pauseMs, b = a + travel, c = b + SLIDE.pauseMs, d = c + SLIDE.fadeMs;
  return [
    { transform: 'translateX(0)', opacity: 1, offset: 0 },
    { transform: 'translateX(0)', opacity: 1, offset: at(a) },
    { transform: end, opacity: 1, offset: at(b) },
    { transform: end, opacity: 1, offset: at(c) },
    { transform: end, opacity: 0, offset: at(d) },
    { transform: 'translateX(0)', opacity: 0, offset: at(d) },
    { transform: 'translateX(0)', opacity: 1, offset: 1 },
  ];
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
