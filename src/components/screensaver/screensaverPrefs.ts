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
  /** Bubbles rising through the water. */
  carbonation: boolean;
  /** How much the surface moves, as a multiplier. 0 is a dead flat waterline. */
  wobble: number;
}

const CARBONATION_KEY = 'prism-screensaver-carbonation';
const WOBBLE_KEY = 'prism-screensaver-wobble';

const DEFAULTS: EffectPrefs = { carbonation: true, wobble: 1 };

let cached: EffectPrefs = { ...DEFAULTS };
let listening = false;

function read(): EffectPrefs {
  if (typeof window === 'undefined') return { ...DEFAULTS };
  try {
    const w = Number(localStorage.getItem(WOBBLE_KEY));
    return {
      carbonation: localStorage.getItem(CARBONATION_KEY) !== 'off',
      wobble: Number.isFinite(w) && w >= 0 ? w : DEFAULTS.wobble,
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
      if (e.key === CARBONATION_KEY || e.key === WOBBLE_KEY) cached = read();
    });
  }
  return cached;
}

export const PREF_KEYS = { CARBONATION_KEY, WOBBLE_KEY };
