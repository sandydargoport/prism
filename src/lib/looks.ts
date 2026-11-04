import { FIRST_SCREEN_TEMPLATE } from '@/lib/constants/layoutTemplates';
import type { WidgetConfig } from '@/lib/hooks/useLayouts';

/**
 * The three looks the setup wizard offers a new install (#808). Each is built
 * from things that exist on their own: the Paper palette, the bundled scenery,
 * the Glass widget fill and the household's default light or dark mode. A look
 * is applied once, when setup first finishes; after that each part is changed
 * where it lives (Settings > Appearance, the layout editor), and nothing
 * remembers which look was picked.
 */
export const LOOK_IDS = ['photo', 'night', 'paper'] as const;
export type LookId = (typeof LOOK_IDS)[number];

export type Look = {
  /** Palette written to the household theme setting. */
  paletteId: string;
  /** Show the bundled park scenery until the family adds photos. */
  scenery: boolean;
  /** Fill for the first screen's cards; undefined is the solid card colour. */
  fill: 'glass' | undefined;
  /** Household default light or dark mode; null follows each device. */
  mode: 'dark' | null;
};

export const LOOKS: Record<LookId, Look> = {
  photo: { paletteId: 'paper', scenery: true, fill: 'glass', mode: null },
  night: { paletteId: 'paper', scenery: true, fill: 'glass', mode: 'dark' },
  paper: { paletteId: 'paper', scenery: false, fill: undefined, mode: null },
};

export const DEFAULT_LOOK: LookId = 'photo';

/** Setting the wizard writes, read once by POST /api/setup/complete. */
export const FIRST_LOOK_SETTING_KEY = 'firstLook';

/** Household default for displays that never chose light, dark or system. */
export const DEFAULT_MODE_SETTING_KEY = 'defaultThemeMode';

export function isLookId(v: unknown): v is LookId {
  return typeof v === 'string' && (LOOK_IDS as readonly string[]).includes(v);
}

export type DefaultMode = 'light' | 'dark' | 'system';

export function isDefaultMode(v: unknown): v is DefaultMode {
  return v === 'light' || v === 'dark' || v === 'system';
}

/** The first screen's widgets with this look's card fill. */
export function firstScreenWidgets(look: Look): WidgetConfig[] {
  return FIRST_SCREEN_TEMPLATE.widgets.map(({ backgroundColor: _fill, ...w }) =>
    look.fill ? { ...w, backgroundColor: look.fill } : w,
  );
}
