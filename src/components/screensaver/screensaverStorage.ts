import type { WidgetConfig } from '@/lib/hooks/useLayouts';

const SCREENSAVER_LAYOUT_KEY = 'prism-screensaver-layout';
const SCREENSAVER_PRESETS_KEY = 'prism-screensaver-presets';

export const DEFAULT_SCREENSAVER_LAYOUT: WidgetConfig[] = [
  { i: 'clock', x: 32, y: 36, w: 16, h: 12, visible: true },
  { i: 'weather', x: 32, y: 28, w: 16, h: 8, visible: true },
  { i: 'messages', x: 32, y: 16, w: 16, h: 12, visible: true },
  { i: 'calendar', x: 0, y: 16, w: 16, h: 16, visible: false },
  { i: 'birthdays', x: 0, y: 32, w: 16, h: 16, visible: false },
  { i: 'tasks', x: 0, y: 0, w: 12, h: 16, visible: false },
  { i: 'chores', x: 12, y: 0, w: 12, h: 16, visible: false },
  { i: 'shopping', x: 24, y: 0, w: 12, h: 16, visible: false },
  { i: 'meals', x: 0, y: 16, w: 16, h: 16, visible: false },
  { i: 'photos', x: 16, y: 16, w: 16, h: 16, visible: false },
  { i: 'wishes', x: 16, y: 0, w: 12, h: 16, visible: false },
  { i: 'busTracking', x: 36, y: 0, w: 12, h: 12, visible: false },
  { i: 'nowNext', x: 0, y: 0, w: 24, h: 6, visible: false },
];

/**
 * The arrangement this browser kept before dashboards had their own, merged
 * onto the default as v1.30.1 drew it. Read only by the carry-over below;
 * the running photo frame reads the dashboard's (#1346).
 */
function loadScreensaverLayout(): WidgetConfig[] {
  if (typeof window === 'undefined') return DEFAULT_SCREENSAVER_LAYOUT;
  try {
    const stored = localStorage.getItem(SCREENSAVER_LAYOUT_KEY);
    if (!stored) return DEFAULT_SCREENSAVER_LAYOUT;
    let parsed = JSON.parse(stored) as WidgetConfig[];
    // Migrate 12-col screensaver layouts to 48-col
    const maxRight = Math.max(...parsed.map(w => w.x + w.w), 0);
    if (maxRight > 0 && maxRight <= 12) {
      parsed = parsed.map(w => ({ ...w, x: w.x * 4, y: w.y * 4, w: w.w * 4, h: w.h * 4 }));
      localStorage.setItem(SCREENSAVER_LAYOUT_KEY, JSON.stringify(parsed));
    }
    return DEFAULT_SCREENSAVER_LAYOUT.map(def => {
      const saved = parsed.find(p => p.i === def.i);
      return saved ? { ...def, ...saved } : def;
    });
  } catch { return DEFAULT_SCREENSAVER_LAYOUT; }
}

/**
 * The photo frame arrangement a dashboard has: its own when it has saved one,
 * else the default. Never the copy a browser kept: that is only carried over,
 * once, by the upgrade from v1.30.1 (see legacyScreensaver).
 */
export function screensaverForDashboard(
  active: { screensaverWidgets?: WidgetConfig[] | null },
): WidgetConfig[] {
  return active.screensaverWidgets ?? DEFAULT_SCREENSAVER_LAYOUT;
}

/**
 * Set once this browser no longer holds an arrangement from before dashboards
 * had their own (#1154): it was carried onto the dashboard it shows, or there
 * was nothing to carry.
 */
export const SCREENSAVER_CARRIED_KEY = 'prism-screensaver-carried';

/**
 * The arrangement this browser kept from v1.30.1, which a dashboard with none
 * of its own showed there, until it is carried onto that dashboard. Null once
 * carried, or when the browser kept none.
 */
export function legacyScreensaver(): WidgetConfig[] | null {
  try {
    if (localStorage.getItem(SCREENSAVER_CARRIED_KEY) === '1') return null;
    if (!localStorage.getItem(SCREENSAVER_LAYOUT_KEY)) return null;
  } catch { return null; }
  return loadScreensaverLayout();
}

export function markScreensaverCarried() {
  try { localStorage.setItem(SCREENSAVER_CARRIED_KEY, '1'); } catch { /* storage refused */ }
}

/**
 * Whether the arrangement this browser kept is still owed to the dashboard it
 * shows: the dashboard has none of its own and rests over photos or the sky,
 * where a screensaver arrangement shows. Otherwise there is nothing to carry.
 */
export function owesLegacyScreensaver(
  active: { screensaverWidgets?: WidgetConfig[] | null },
  restsOverScreensaver: boolean,
  legacy: WidgetConfig[] | null,
): legacy is WidgetConfig[] {
  return !!legacy && !active.screensaverWidgets && restsOverScreensaver;
}

export function getScreensaverPresets(): Array<{ name: string; widgets: WidgetConfig[] }> {
  try {
    const stored = localStorage.getItem(SCREENSAVER_PRESETS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export function saveScreensaverPreset(name: string, widgets: WidgetConfig[]) {
  const presets = getScreensaverPresets();
  const existing = presets.findIndex(p => p.name === name);
  if (existing >= 0) presets[existing] = { name, widgets };
  else presets.push({ name, widgets });
  localStorage.setItem(SCREENSAVER_PRESETS_KEY, JSON.stringify(presets));
}

export function deleteScreensaverPreset(name: string) {
  const presets = getScreensaverPresets().filter(p => p.name !== name);
  localStorage.setItem(SCREENSAVER_PRESETS_KEY, JSON.stringify(presets));
}
