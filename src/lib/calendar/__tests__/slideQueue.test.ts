import { createSlideQueue, slideDuration, slideKeyframes, SLIDE } from '../slideQueue';

/** A slide that stays running until finish() is called. */
function slide() {
  let finish!: () => void;
  let started = 0;
  const run = () => { started++; return new Promise<void>((r) => { finish = r; }); };
  return { run, get started() { return started; }, finish: () => finish() };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('the slide queue (#901)', () => {
  it('never runs more than the limit at once, and staggers starts', async () => {
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const q = createSlideQueue({ maxAtOnce: 2, staggerMs: 900, setTimer: (fn, ms) => timers.push({ fn, ms }) });
    const s = [slide(), slide(), slide()];
    s.forEach((x) => q.join(x.run));
    // One starts at once; the next waits out the stagger.
    expect(s.map((x) => x.started)).toEqual([1, 0, 0]);
    expect(timers.at(-1)!.ms).toBeGreaterThan(0);
  });

  it('a finished title goes to the back of the queue; one that left does not return', async () => {
    const q = createSlideQueue({ maxAtOnce: 1, staggerMs: 0 });
    const a = slide(); const b = slide();
    q.join(a.run);
    const leaveB = q.join(b.run);
    expect([a.started, b.started]).toEqual([1, 0]);
    a.finish(); await flush();
    expect([a.started, b.started]).toEqual([1, 1]);
    b.finish(); await flush();
    expect(a.started).toBe(2);
    leaveB();
    a.finish(); await flush();
    expect(b.started).toBe(1);
    expect(q.activeCount).toBe(1);
  });

  it('takes the rests, one travel at 30px/s, and the fades', () => {
    expect(slideDuration(60)).toBe(2 * SLIDE.pauseMs + 2000 + 2 * SLIDE.fadeMs);
  });

  it('only ever reads left to right: it never moves right while it can be seen', () => {
    const frames = slideKeyframes(60);
    const x = (f: Keyframe) => Number(/-?\d+(\.\d+)?/.exec(String(f.transform))![0]);
    expect(Math.min(...frames.map(x))).toBe(-60);
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1]!, cur = frames[i]!;
      if (x(cur) > x(prev)) {
        // Going back to the start happens only while hidden.
        expect(prev.opacity).toBe(0);
        expect(cur.opacity).toBe(0);
      }
    }
    expect(frames.map((f) => f.offset)).toEqual([...frames.map((f) => f.offset)].sort((a, b) => Number(a) - Number(b)));
  });
});
