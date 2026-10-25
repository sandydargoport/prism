import * as SunCalc from 'suncalc';

/**
 * The sky outside, worked out locally from the date and the household's
 * location. No network, no key: the stars move by sidereal time and the sun and
 * moon come from suncalc, which the weather widget already uses.
 */

const RAD = Math.PI / 180;

export type ScreensaverBackdrop = 'photos' | 'sky' | 'skyAtNight';

/** Degrees the sun sits below the horizon at sunset, refraction included. */
const SUNSET_ALT = -0.833;

/** Sidereal time at a longitude, in degrees. Accurate to well under a degree. */
export function localSiderealTime(date: Date, lon: number): number {
  const days = date.getTime() / 86_400_000 - 10_957.5; // since J2000.0
  const gmst = 280.46061837 + 360.98564736629 * days;
  return (((gmst + lon) % 360) + 360) % 360;
}

/** Altitude and azimuth (degrees, azimuth from north through east). */
export type Horizontal = { alt: number; az: number }

export function toHorizontal(ra: number, dec: number, lat: number, lst: number): Horizontal {
  const h = (lst - ra) * RAD;
  const d = dec * RAD;
  const p = lat * RAD;
  const alt = Math.asin(Math.sin(d) * Math.sin(p) + Math.cos(d) * Math.cos(p) * Math.cos(h));
  const az = Math.atan2(
    -Math.sin(h) * Math.cos(d),
    Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(h),
  );
  return { alt: alt / RAD, az: ((az / RAD) + 360) % 360 };
}

// suncalc 2 works in degrees with azimuth from north, the same as here. Its
// first version used radians from south, and examples written for it are
// still everywhere.
export function sunPosition(date: Date, lat: number, lon: number): Horizontal {
  const p = SunCalc.getPosition(date, lat, lon);
  return { alt: p.altitude, az: p.azimuth };
}

/** Whether the screensaver should be showing the sky rather than photos. */
export function skyShowsNow(
  backdrop: ScreensaverBackdrop, date: Date, lat: number, lon: number,
): boolean {
  if (backdrop === 'sky') return true;
  if (backdrop === 'photos') return false;
  return sunPosition(date, lat, lon).alt < SUNSET_ALT;
}

export type Moon = {
  /** Lit fraction of the disc, 0..1. */
  fraction: number;
  /**
   * Where the bright limb points on screen, radians anticlockwise from up, so
   * a crescent is drawn the way it looks from here rather than always the
   * same way round.
   */
  limb: number;
} & Horizontal

export function moonPosition(date: Date, lat: number, lon: number): Moon {
  const pos = SunCalc.getMoonPosition(date, lat, lon);
  const ill = SunCalc.getMoonIllumination(date);
  return {
    alt: pos.altitude,
    az: pos.azimuth,
    fraction: ill.fraction,
    limb: (ill.angle - pos.parallacticAngle) * RAD,
  };
}

/**
 * A view of the sky toward the equator, as if standing outside looking up.
 *
 * Stereographic, centred above the horizon. It keeps the shapes of
 * constellations true wherever they are on screen, which a flat altitude by
 * azimuth grid does not: that one stretches anything high up sideways, and the
 * figures people know stop looking like themselves.
 */
export type View = {
  width: number;
  height: number;
  /** Azimuth the view faces: south in the northern hemisphere, north in the southern. */
  facing: number;
}

const CENTRE_ALT = 50;
/** Where the horizon straight ahead sits, as a fraction of the height. */
const HORIZON_AT = 1.02;
const CENTRE_AT = 0.45;

export function facingFor(lat: number): number {
  return lat >= 0 ? 180 : 0;
}

export function project(p: Horizontal, v: View): { x: number; y: number } {
  const a0 = CENTRE_ALT * RAD;
  const a = p.alt * RAD;
  const dAz = (p.az - v.facing) * RAD;
  // Radius that puts the horizon ahead at HORIZON_AT of the height.
  const horizonY = (2 * Math.sin(a0)) / (1 + Math.cos(a0));
  const r = ((HORIZON_AT - CENTRE_AT) * v.height) / horizonY;
  const k = (2 * r) / (1 + Math.sin(a0) * Math.sin(a) + Math.cos(a0) * Math.cos(a) * Math.cos(dAz));
  return {
    x: v.width / 2 + k * Math.cos(a) * Math.sin(dAz),
    y: CENTRE_AT * v.height - k * (Math.cos(a0) * Math.sin(a) - Math.sin(a0) * Math.cos(a) * Math.cos(dAz)),
  };
}

/** Sky colour and star visibility for a sun altitude. */
export type SkyLight = {
  top: string;
  bottom: string;
  /** How much of the starlight shows, 0 in daylight to 1 in full dark. */
  stars: number;
  /** Warmth of the glow on the horizon below the sun, 0..1. */
  glow: number;
}

type Rgb = [number, number, number];
// Sun altitude, then the top and bottom of the sky. Daylight is a muted blue
// rather than a bright one: the screensaver's widgets are drawn in white.
const KEYS: [number, Rgb, Rgb][] = [
  [-18, [2, 4, 12], [9, 17, 38]],
  [-12, [5, 10, 30], [20, 32, 70]],
  [-6, [14, 26, 64], [74, 70, 110]],
  [0, [30, 52, 104], [176, 112, 92]],
  [8, [38, 76, 132], [104, 142, 186]],
];

const mix = (a: Rgb, b: Rgb, t: number): string =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i]! - v) * t)).join(',')})`;

export function skyLight(sunAlt: number): SkyLight {
  let i = KEYS.findIndex(([alt]) => sunAlt < alt);
  if (i === -1) i = KEYS.length;
  const lo = KEYS[Math.max(0, i - 1)]!;
  const hi = KEYS[Math.min(KEYS.length - 1, i)]!;
  const t = lo === hi ? 0 : (sunAlt - lo[0]) / (hi[0] - lo[0]);
  return {
    top: mix(lo[1], hi[1], t),
    bottom: mix(lo[2], hi[2], t),
    stars: Math.min(1, Math.max(0, (-2 - sunAlt) / 12)),
    glow: Math.max(0, 1 - Math.abs(sunAlt + 3) / 9),
  };
}
