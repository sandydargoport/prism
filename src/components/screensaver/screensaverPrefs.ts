'use client';

/**
 * Per-display screensaver preferences that the EFFECTS need to read.
 *
 * Effects are plain objects, not components, so they cannot use a hook. Rather
 * than thread every option through the frame loop, the handful an effect cares
 * about are mirrored here from localStorage and refreshed on the same storage
 * event the settings already dispatch. Reading is a property lookup, which
 * matters when it happens for every fragment of every frame.
 */
export interface EffectPrefs {
  /**
   * Multiplier on every transition's length. The effects carry a considered
   * default each; this scales all of them together rather than asking anyone to
   * pick a number of seconds per effect.
   */
  speed: number;
  /** Bubbles rising through the water. */
  carbonation: boolean;
  /** How much the surface moves, as a multiplier. 0 is a dead flat waterline. */
  wobble: number;
}

const CARBONATION_KEY = 'prism-screensaver-carbonation';
const WOBBLE_KEY = 'prism-screensaver-wobble';
const SPEED_KEY = 'prism-screensaver-speed';

const DEFAULTS: EffectPrefs = { carbonation: true, wobble: 1, speed: 1 };

let cached: EffectPrefs = { ...DEFAULTS };
let listening = false;

function read(): EffectPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    // The raw string first, and it matters: Number(null) is 0, which is finite
    // and not negative — so an ABSENT setting read as "wobble: 0" and every
    // waterline came out dead flat. A missing value has to be distinguished
    // from a deliberate zero before it is turned into a number.
    const raw = localStorage.getItem(WOBBLE_KEY);
    const w = raw === null ? NaN : Number(raw);
    const rawSpeed = localStorage.getItem(SPEED_KEY);
    const sp = rawSpeed === null ? NaN : Number(rawSpeed);
    return {
      carbonation: localStorage.getItem(CARBONATION_KEY) !== 'off',
      wobble: Number.isFinite(w) && w >= 0 ? w : DEFAULTS.wobble,
      speed: Number.isFinite(sp) && sp > 0 ? sp : DEFAULTS.speed,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function effectPrefs(): EffectPrefs {
  if (!listening && typeof window !== 'undefined') {
    listening = true;
    cached = read();
    window.addEventListener('storage', (e) => {
      if (e.key === CARBONATION_KEY || e.key === WOBBLE_KEY || e.key === SPEED_KEY) cached = read();
    });
  }
  return cached;
}

export const PREF_KEYS = { CARBONATION_KEY, WOBBLE_KEY, SPEED_KEY };

/** An effect's length for a phase, with the display's speed setting applied. */
export function scaledDuration(base: number): number {
  return Math.round(base * effectPrefs().speed);
}
