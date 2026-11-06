import { createSlideQueue, slideDuration, SLIDE } from '../slideQueue';

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

  it('takes the rests plus the travel there and back at 30px/s', () => {
    expect(slideDuration(60)).toBe(2 * SLIDE.pauseMs + 2 * 2000);
  });
});
