/**
 * Orientation for a photo, derived from its pixel dimensions.
 *
 * `photos.orientation` drives the Photos page filter and lets a landscape wall
 * display avoid a library that is mostly phone-shaped portraits. It was
 * previously computed only on manual upload, so every synced photo landed with
 * a NULL orientation and the filter silently matched nothing for them.
 *
 * Returns null when either dimension is missing, which is the honest answer:
 * a NULL means "unknown", not "square".
 */
export function orientationFromDimensions(
  width: number | null | undefined,
  height: number | null | undefined,
): 'landscape' | 'portrait' | 'square' | null {
  if (width == null || height == null) return null;
  if (width > height) return 'landscape';
  if (height > width) return 'portrait';
  return 'square';
}
