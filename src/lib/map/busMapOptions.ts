/**
 * How the live bus map looks and moves, chosen under Live Tracking settings.
 */

export const BUS_MAP_STYLE_SETTING = 'busMapStyle';
export const BUS_MAP_CAMERA_SETTING = 'busMapCamera';

export const BUS_MAP_STYLES = ['simple', 'detailed'] as const;
export type BusMapStyle = (typeof BUS_MAP_STYLES)[number];
export const DEFAULT_BUS_MAP_STYLE: BusMapStyle = 'simple';

export const BUS_MAP_STYLE_LABELS: Record<BusMapStyle, string> = {
  simple: 'Simple: plain grey streets, so the route stands out',
  detailed: 'Detailed: coloured roads, parks and buildings',
};

/**
 * OpenFreeMap styles for each choice, light and dark. The dark one is picked
 * when Prism's theme is dark, so the map follows light, dark or system.
 */
const STYLE_URLS: Record<BusMapStyle, { light: string; dark: string }> = {
  simple: { light: 'positron', dark: 'dark' },
  detailed: { light: 'liberty', dark: 'fiord' },
};

export function busMapStyleUrl(style: BusMapStyle, dark: boolean): string {
  return `https://tiles.openfreemap.org/styles/${STYLE_URLS[style][dark ? 'dark' : 'light']}`;
}

export const BUS_MAP_CAMERAS = ['follow', 'route'] as const;
export type BusMapCamera = (typeof BUS_MAP_CAMERAS)[number];
export const DEFAULT_BUS_MAP_CAMERA: BusMapCamera = 'follow';

export const BUS_MAP_CAMERA_LABELS: Record<BusMapCamera, string> = {
  follow: 'Follow: the bus and your stop, closer as it approaches',
  route: 'Whole route: the full trip stays in view',
};

export function isBusMapStyle(value: unknown): value is BusMapStyle {
  return typeof value === 'string' && (BUS_MAP_STYLES as readonly string[]).includes(value);
}

export function isBusMapCamera(value: unknown): value is BusMapCamera {
  return typeof value === 'string' && (BUS_MAP_CAMERAS as readonly string[]).includes(value);
}
