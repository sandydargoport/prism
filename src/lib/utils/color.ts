/**
 * Returns true if the given hex color is light (luminance > 0.5).
 * Used for auto light/dark text detection on colored backgrounds.
 *
 * Future: per-widget text color manual override could replace this auto-detection.
 */
/**
 * Converts a hex color + opacity to an rgba() string.
 * Keeps opacity on the background only — sibling content stays fully opaque.
 */
export function hexToRgba(hex: string, opacity: number): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

/** sRGB linearization for a single channel (0–1). */
function linearize(c: number): number {
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG 2.1 relative luminance from hex color. */
export function relativeLuminance(hex: string): number {
  const c = hex.replace('#', '');
  const r = linearize(parseInt(c.substring(0, 2), 16) / 255);
  const g = linearize(parseInt(c.substring(2, 4), 16) / 255);
  const b = linearize(parseInt(c.substring(4, 6), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG contrast ratio between two hex colours.
 *
 * The luminance-pair version below is the primitive; this is what callers
 * almost always want, and exporting it keeps the conversion in one place.
 */
export function contrastRatioHex(a: string, b: string): number {
  return contrastRatio(relativeLuminance(a), relativeLuminance(b));
}

/** WCAG contrast ratio between two luminances. */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Returns true if the given hex color needs dark text for WCAG AA contrast.
 * Uses proper sRGB linearization and checks 4.5:1 ratio against white (#fff).
 */
export function isLightColor(hex: string): boolean {
  const bgLum = relativeLuminance(hex);
  const whiteLum = 1.0; // luminance of #ffffff
  const blackLum = 0.0; // luminance of #000000
  // Use dark text if white doesn't meet 4.5:1, or if black provides better contrast
  const whiteContrast = contrastRatio(whiteLum, bgLum);
  const blackContrast = contrastRatio(bgLum, blackLum);
  return blackContrast > whiteContrast;
}

/** Returns '#000000' or '#ffffff' — whichever has better WCAG contrast against the given hex. */
export function contrastText(hex: string): string {
  return isLightColor(hex) ? '#000000' : '#ffffff';
}

/**
 * Converts a hex color to Tailwind HSL variable format: "h s% l%"
 * Used to override CSS custom properties like --foreground, --muted-foreground.
 */
export function hexToHslValues(hex: string): string {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16) / 255;
  const g = parseInt(c.substring(2, 4), 16) / 255;
  const b = parseInt(c.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(l * 100)}%`;
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6; break;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Converts an HSL string "h s% l%" (Tailwind format) to a hex color "#RRGGBB".
 * Inverse of hexToHslValues.
 */
export function hslToHex(hsl: string): string {
  const parts = hsl.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
  if (!parts || !parts[1] || !parts[2] || !parts[3]) return '#000000';

  const h = parseFloat(parts[1]) / 360;
  const s = parseFloat(parts[2]) / 100;
  const l = parseFloat(parts[3]) / 100;

  if (s === 0) {
    const v = Math.round(l * 255);
    return `#${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}${v.toString(16).padStart(2, '0')}`;
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
