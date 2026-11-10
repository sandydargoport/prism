/**
 * The one line under each screen in Settings > Screens (#1153): when it
 * rests, when its night is, and how many Interludes it has, such as "Rests
 * after 2 min, night from dusk, 1 Interlude".
 *
 * Resting and Interludes are the screen's own settings; night is the rule of
 * the dashboard it shows.
 */
import type { IdleBackground } from '@/lib/idleBackground';
import { nightRule } from '@/lib/throughTheDay';
import { parseSchedule, SCREEN_SCHEDULE_KEY } from './screenSchedule';
import type { ScreenSettings } from './screenSettings';

/** The screensaver timeout a screen uses when it never chose one, in seconds. */
const DEFAULT_TIMEOUT_S = 120;

function restsAfter(seconds: number): string {
  if (seconds <= 0) return 'Never rests';
  if (seconds < 60) return `Rests after ${seconds} sec`;
  if (seconds < 3600) return `Rests after ${Math.round(seconds / 60)} min`;
  const hours = Math.round(seconds / 3600);
  return `Rests after ${hours} hour${hours === 1 ? '' : 's'}`;
}

export function screenSummary(
  settings: ScreenSettings,
  background: IdleBackground | null,
  /** "21:00" as the household reads a time, e.g. "9:00 pm". */
  clock: (hhmm: string) => string,
): string {
  const raw = settings['prism-screensaver-timeout'];
  const timeout = raw !== undefined && Number.isFinite(Number(raw)) ? Number(raw) : DEFAULT_TIMEOUT_S;
  const parts = [restsAfter(timeout)];

  if (background) {
    const rule = nightRule(background);
    parts.push(rule.by === 'sun' ? 'night from dusk' : `night ${clock(rule.from)} to ${clock(rule.to)}`);
  }

  const interludes = parseSchedule(settings[SCREEN_SCHEDULE_KEY]).length;
  if (interludes > 0) parts.push(`${interludes} Interlude${interludes === 1 ? '' : 's'}`);

  return parts.join(', ');
}
