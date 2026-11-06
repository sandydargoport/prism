/**
 * A short, plain name for a device from its browser string, for the signed-in
 * devices list (#1044): "iPhone · Safari", "Mac · Chrome". Unknown parts drop
 * out; nothing unknown is guessed.
 */
export function deviceLabel(userAgent?: string): string {
  const ua = userAgent ?? '';
  const device =
    /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet')
    : /CrOS/.test(ua) ? 'Chromebook'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : '';
  const browser =
    /Edg\//.test(ua) ? 'Edge'
    : /Firefox\/|FxiOS/.test(ua) ? 'Firefox'
    : /Chrome\/|CriOS/.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /AppleWebKit/.test(ua) && /iPhone|iPad/.test(ua) ? 'Home screen app'
    : '';
  return [device, browser].filter(Boolean).join(' · ') || 'Unknown device';
}
