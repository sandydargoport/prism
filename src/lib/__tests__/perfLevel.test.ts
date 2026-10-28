/**
 * @jest-environment jsdom
 */
import {
  PERF_AUTO_LEVEL_KEY, PERF_CLASS_SCRIPT, PERF_MODE_KEY, levelFrom, modeFrom,
} from '../perfLevel';
import { afterFade, fadeWasBad, BAD_FADES_TO_STEP, type AutoState } from '../autoPerf';

describe('performance levels', () => {
  it('reads the old switch as the level it meant, and nothing as Auto', () => {
    expect(modeFrom('true')).toBe('reduced');
    expect(modeFrom('false')).toBe('full');
    expect(modeFrom(null)).toBe('auto');
    expect(modeFrom('nonsense')).toBe('auto');
    expect(modeFrom('minimal')).toBe('minimal');
  });

  it('Auto runs at what it measured, a chosen level ignores it', () => {
    expect(levelFrom(null, null)).toBe('full');
    expect(levelFrom('auto', 'reduced')).toBe('reduced');
    expect(levelFrom('full', 'minimal')).toBe('full');
  });

  // The script runs before the first paint, the hook after it. If they read
  // the keys differently, a screen flashes one level and then shows another.
  const modes = [null, 'true', 'false', 'auto', 'full', 'reduced', 'minimal', 'junk'];
  const autos = [null, 'full', 'reduced', 'minimal', 'junk'];
  it.each(modes.flatMap(m => autos.map(a => [m, a] as const)))(
    'the pre-paint script agrees with the hook for mode %s, auto %s',
    (mode, auto) => {
      localStorage.clear();
      if (mode !== null) localStorage.setItem(PERF_MODE_KEY, mode);
      if (auto !== null) localStorage.setItem(PERF_AUTO_LEVEL_KEY, auto);
      const classes = document.documentElement.classList;
      classes.remove('performance-mode', 'perf-minimal');
      new Function(PERF_CLASS_SCRIPT)();
      const level = levelFrom(mode, auto);
      expect(classes.contains('performance-mode')).toBe(level !== 'full');
      expect(classes.contains('perf-minimal')).toBe(level === 'minimal');
    },
  );
});

describe('Auto performance', () => {
  const smooth = Array(70).fill(16.7);

  it('one slow frame does not make a fade bad, a run of them does', () => {
    expect(fadeWasBad([...smooth, 400])).toBe(false);
    expect(fadeWasBad([...Array(50).fill(16.7), ...Array(20).fill(60)])).toBe(true);
    // Too few frames to judge: a throttled tab, not slow hardware.
    expect(fadeWasBad([200, 200, 200])).toBe(false);
  });

  function run(start: AutoState, bad: boolean[]): AutoState {
    return bad.reduce(afterFade, start);
  }

  it(`steps down only after ${BAD_FADES_TO_STEP} bad fades in a row`, () => {
    const full: AutoState = { level: 'full', badInARow: 0 };
    expect(run(full, [true, true]).level).toBe('full');
    expect(run(full, [true, true, true]).level).toBe('reduced');
    expect(run(full, [true, true, false, true, true]).level).toBe('full');
    expect(run(full, Array(6).fill(true)).level).toBe('minimal');
  });

  it('never steps up, and stops at minimal', () => {
    expect(run({ level: 'reduced', badInARow: 0 }, Array(10).fill(false)).level).toBe('reduced');
    expect(run({ level: 'minimal', badInARow: 0 }, Array(10).fill(true)).level).toBe('minimal');
  });
});
