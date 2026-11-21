/**
 * The one line under each screen in Settings > Screens (#1153): which
 * timeline it follows, when it rests, when its night is, and how many
 * dashboards are placed on its day, such as "Main: rests after 2 min, night
 * from dusk, 1 dashboard placed".
 *
 * Resting is the screen's own setting; night and the placements are its
 * timeline's (#1266).
 */
import type { Timeline } from '@/lib/timeline';
import { nightRule } from '@/lib/throughTheDay';
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
  timeline: Pick<Timeline, 'name' | 'idleBackground' | 'placements'> | null,
  /** "21:00" as the household reads a time, e.g. "9:00 pm". */
  clock: (hhmm: string) => string,
): string {
  const raw = settings['prism-screensaver-timeout'];
  const timeout = raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : DEFAULT_TIMEOUT_S;
  const parts = [restsAfter(timeout)];

  if (timeline) {
    const rule = nightRule(timeline.idleBackground);
    parts.push(rule.by === 'sun' ? 'night from dusk' : `night ${clock(rule.from)} to ${clock(rule.to)}`);
    const placed = timeline.placements.length;
    if (placed > 0) parts.push(`${placed} dashboard${placed === 1 ? '' : 's'} placed`);
  }

  const line = parts.join(', ');
  return timeline ? `${timeline.name}: ${line}` : line.charAt(0).toUpperCase() + line.slice(1);
}
