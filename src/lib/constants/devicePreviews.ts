/**
 * Representative devices for the layout "how it looks on each screen" preview
 * gallery. Each entry is a device's native screen size; the gallery renders the
 * SAME dashboard layout the way that device would actually show it — stretched
 * to fill when the orientation matches the design, letterboxed on a genuine
 * mismatch (mirroring CssGridDisplay's live behavior). Aspect ratio is what
 * matters here; pixel counts are only used to derive it.
 *
 * Note: these are the raw panel aspects. A browser (e.g. iPhone Safari, non-PWA)
 * eats some height with its chrome, so the real usable area is a little wider
 * than the native aspect — the gallery is a close approximation, not exact.
 */
export interface DevicePreview {
  name: string;
  w: number;
  h: number;
  /** Short aspect/context label shown under the frame. */
  note?: string;
}

export const DEVICE_PREVIEWS: DevicePreview[] = [
  { name: '27" / Kiosk', w: 1920, h: 1080, note: '16:9' },
  { name: 'iPad', w: 1024, h: 768, note: '4:3' },
  { name: 'Fire Kids', w: 1280, h: 800, note: '16:10' },
  { name: 'iPhone', w: 390, h: 844, note: 'Safari' },
];
