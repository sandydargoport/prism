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
];

export function loadScreensaverLayout(): WidgetConfig[] {
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
 * The screensaver a dashboard shows: its own when it has saved one, else the
 * default. The one exception is the upgrade from a single screensaver kept in
 * this browser to one per dashboard: while no dashboard has saved one yet, the
 * stored one carries over, so the upgrade does not lose it. Without that check
 * a dashboard with none would inherit whatever the last dashboard left here.
 */
export function screensaverForDashboard(
  active: { screensaverWidgets?: WidgetConfig[] | null },
  all: { screensaverWidgets?: WidgetConfig[] | null }[],
): WidgetConfig[] {
  if (active.screensaverWidgets) return active.screensaverWidgets;
  const upgrading = !all.some((l) => l.screensaverWidgets);
  return upgrading ? loadScreensaverLayout() : DEFAULT_SCREENSAVER_LAYOUT;
}

export function saveScreensaverLayout(layout: WidgetConfig[]) {
  localStorage.setItem(SCREENSAVER_LAYOUT_KEY, JSON.stringify(layout));
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
