/**
 * The one line under each screen in Settings > Screens (#1153): what it shows
 * and when it switches (#1282), then when it rests, such as "Shows Kitchen,
 * School run at bus time, rests after 2 min".
 *
 * Resting is the screen's own setting. Night is each dashboard's own (#1281),
 * so it is not one thing for a screen whose dashboard changes through the
 * day, and is left out.
 */
import type { ScreenSettings } from './screenSettings';

/** The screensaver timeout a screen uses when it never chose one, in seconds. */
const DEFAULT_TIMEOUT_S = 120;

function restsAfter(seconds: number): string {
  if (seconds <= 0) return 'never rests';
  if (seconds < 60) return `rests after ${seconds} sec`;
  if (seconds < 3600) return `rests after ${Math.round(seconds / 60)} min`;
  const hours = Math.round(seconds / 3600);
  return `rests after ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function screenSummary(
  settings: ScreenSettings,
  /** What it shows and its switches, in words; null when not known yet. */
  shows: string | null,
): string {
  const raw = settings['prism-screensaver-timeout'];
  const timeout = raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : DEFAULT_TIMEOUT_S;
  const line = [shows, restsAfter(timeout)].filter(Boolean).join(', ');
  return line.charAt(0).toUpperCase() + line.slice(1);
}
