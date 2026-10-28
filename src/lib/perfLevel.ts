/**
 * Performance levels (#691): how much visual work a screen does.
 *
 *  - full: everything.
 *  - reduced: no backdrop blur, no full-screen celebrations or particle
 *    effects, a still night sky. What "performance mode on" used to mean,
 *    minus the two slow-downs below.
 *  - minimal: reduced, plus a single static photo, polling stretched, and
 *    fades cut to a blink.
 *
 * A screen stores a mode: one of those three, or 'auto'. Auto starts at full
 * and steps down by itself when its fades drop frames (see autoPerf.ts); the
 * level it settled on is stored separately, so choosing Auto again later picks
 * up where the measurement left off.
 *
 * Not a client module on purpose: app/layout.tsx is a server component and
 * inlines PERF_CLASS_SCRIPT, which has to agree with levelFrom() below.
 */

export type PerfLevel = 'full' | 'reduced' | 'minimal';
export type PerfMode = 'auto' | PerfLevel;

/** The screen's chosen mode. Synced per screen (#690). */
export const PERF_MODE_KEY = 'prism-perf-mode';
/** The level Auto measured on this screen. Not synced: it is this screen's hardware. */
export const PERF_AUTO_LEVEL_KEY = 'prism-perf-auto-level';

/** Set on <html> for reduced and minimal. CSS keys the blur removal off it. */
export const PERF_CLASS = 'performance-mode';
/** Set on <html> for minimal only. */
export const PERF_MINIMAL_CLASS = 'perf-minimal';

export const PERF_LEVELS: readonly PerfLevel[] = ['full', 'reduced', 'minimal'];

function isLevel(raw: string | null): raw is PerfLevel {
  return raw === 'full' || raw === 'reduced' || raw === 'minimal';
}

/**
 * The stored mode. Performance mode used to be an on/off switch: 'true' and
 * 'false' were chosen (or guessed) on that screen, so they keep meaning what
 * they did. Nothing stored is Auto, which replaces the old core-count guess.
 */
export function modeFrom(raw: string | null): PerfMode {
  if (raw === 'true') return 'reduced';
  if (raw === 'false') return 'full';
  return isLevel(raw) ? raw : 'auto';
}

/** The level Auto has settled on; full until it measures otherwise. */
export function autoLevelFrom(raw: string | null): PerfLevel {
  return isLevel(raw) ? raw : 'full';
}

/** The level a screen runs at, from its two stored strings. */
export function levelFrom(modeRaw: string | null, autoRaw: string | null): PerfLevel {
  const mode = modeFrom(modeRaw);
  return mode === 'auto' ? autoLevelFrom(autoRaw) : mode;
}

/**
 * Sets the classes before the first paint, from the same two keys. Kept as
 * small as levelFrom() and tested against it, value by value.
 */
export const PERF_CLASS_SCRIPT =
  `var p=localStorage.getItem('${PERF_MODE_KEY}');` +
  `if(p==='true')p='reduced';else if(p==='false')p='full';` +
  `else if(p!=='full'&&p!=='reduced'&&p!=='minimal')p=localStorage.getItem('${PERF_AUTO_LEVEL_KEY}');` +
  `if(p==='reduced'||p==='minimal')document.documentElement.classList.add('${PERF_CLASS}');` +
  `if(p==='minimal')document.documentElement.classList.add('${PERF_MINIMAL_CLASS}');`;
