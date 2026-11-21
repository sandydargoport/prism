/**
 * The one line under each screen in Settings > Screens (#1153): which
 * timeline it follows, when it rests, and how many dashboards are placed on
 * its day, such as "Main: rests after 2 min, 1 dashboard placed".
 *
 * Resting is the screen's own setting; the placements are its timeline's
 * (#1266). Night is each dashboard's own (#1281), so it is not one thing for
 * a screen whose dashboard changes through the day, and is left out.
 */
import type { Timeline } from '@/lib/timeline';
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
  timeline: Pick<Timeline, 'name' | 'placements'> | null,
): string {
  const raw = settings['prism-screensaver-timeout'];
  const timeout = raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : DEFAULT_TIMEOUT_S;
  const parts = [restsAfter(timeout)];

  if (timeline) {
    const placed = timeline.placements.length;
    if (placed > 0) parts.push(`${placed} dashboard${placed === 1 ? '' : 's'} placed`);
  }

  const line = parts.join(', ');
  return timeline ? `${timeline.name}: ${line}` : line.charAt(0).toUpperCase() + line.slice(1);
}
