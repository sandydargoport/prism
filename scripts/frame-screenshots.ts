/**
 * Put the wall, tablet and phone screenshots into plain device frames on one
 * image, in light and dark: docs/demos/hero-light.png and hero-dark.png, for
 * the README, the website and store listings.
 *
 * Reads docs/demos/hero-{wall,tablet,phone}-{light,dark}.png, which
 * capture-screenshots.ts writes (`npm run screenshots:capture -- hero`), and
 * runs at the end of that capture. It also runs on its own, to re-frame
 * without re-capturing:
 *
 *   npx tsx scripts/frame-screenshots.ts
 *
 * The frames are drawn here as plain rounded bezels, not copies of any
 * maker's hardware.
 */
import * as fs from 'fs';
import * as path from 'path';
import sharp, { type OverlayOptions } from 'sharp';

export type Mode = 'light' | 'dark';

/** Output canvas. 16:9, wide enough for a README hero at 2x. */
export const CANVAS = { width: 2400, height: 1350 } as const;

/** Where each screen goes on the canvas, as screen rects (the bezel sits outside). */
export const PLACEMENT = {
  wall: { left: 360, top: 90, width: 1680, height: 945, bezel: 22, radius: 18 },
  tablet: { left: 110, top: 700, width: 720, height: 500, bezel: 26, radius: 30 },
  phone: { left: 1990, top: 560, width: 330, height: 714, bezel: 16, radius: 46 },
} as const;

export type DeviceName = keyof typeof PLACEMENT;

export const BACKDROP: Record<Mode, { from: string; to: string; bezel: string; edge: string; ring: string }> = {
  // Paper neutrals from docs/DESIGN.md: warm paper in light, warm near-black in dark.
  // `ring` separates a front device from the one behind it, whose bezel is
  // the same near-black: without it the front device's edge disappears.
  light: { from: '#f6f2ea', to: '#e9e2d4', bezel: '#1d1b19', edge: '#3a3632', ring: '#f6f2ea' },
  dark: { from: '#1a1816', to: '#0c0b0a', bezel: '#050505', edge: '#2e2b28', ring: '#4a4540' },
};

/** Width of the ring around the tablet and the phone, in canvas px. */
export const RING = 6;

/** Back to front: each device is drawn whole before the next one covers it. */
const ORDER: DeviceName[] = ['wall', 'tablet', 'phone'];

function roundedMask(width: number, height: number, radius: number): Buffer {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`,
  );
}

const svg = (body: string, defs = '') =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}">` +
      `<defs>${defs}</defs>${body}</svg>`,
  );

function backdropSvg(mode: Mode): Buffer {
  const c = BACKDROP[mode];
  return svg(
    `<rect width="${CANVAS.width}" height="${CANVAS.height}" fill="url(#g)"/>`,
    `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${c.from}"/><stop offset="1" stop-color="${c.to}"/></linearGradient>`,
  );
}

/**
 * One device's shadow, separating ring (front devices only) and bezel, as a
 * canvas-sized layer. The screen goes on top of it before the next device.
 */
function frameSvg(mode: Mode, device: DeviceName): Buffer {
  const c = BACKDROP[mode];
  const p = PLACEMENT[device];
  const x = p.left - p.bezel;
  const y = p.top - p.bezel;
  const w = p.width + p.bezel * 2;
  const h = p.height + p.bezel * 2;
  const r = p.radius + p.bezel;
  const ring = device === ORDER[0] ? '' :
    `<rect x="${x - RING}" y="${y - RING}" width="${w + RING * 2}" height="${h + RING * 2}" rx="${r + RING}" fill="${c.ring}"/>`;
  return svg(
    `<rect x="${x}" y="${y + 18}" width="${w}" height="${h}" rx="${r}" fill="#000" opacity="${mode === 'light' ? 0.18 : 0.5}" filter="url(#blur)"/>` +
      ring +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c.bezel}" stroke="${c.edge}" stroke-width="2"/>`,
    `<filter id="blur" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="22"/></filter>`,
  );
}

/** Fit a screenshot into a screen rect (cover, top-aligned) with rounded corners. */
async function screen(file: string, device: DeviceName): Promise<Buffer> {
  const p = PLACEMENT[device];
  return sharp(file)
    .resize(p.width, p.height, { fit: 'cover', position: 'top' })
    .composite([{ input: roundedMask(p.width, p.height, p.radius), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

/**
 * Compose one framed hero image. `shots` maps each device to its screenshot
 * file; the order wall, tablet, phone puts the smaller devices in front.
 */
export async function composeHero(mode: Mode, shots: Record<DeviceName, string>, outFile: string): Promise<void> {
  const layers: OverlayOptions[] = [];
  for (const device of ORDER) {
    const p = PLACEMENT[device];
    layers.push({ input: frameSvg(mode, device), left: 0, top: 0 });
    layers.push({ input: await screen(shots[device], device), left: p.left, top: p.top });
  }
  await sharp(backdropSvg(mode)).composite(layers).png({ compressionLevel: 9 }).toFile(outFile);
}

/** Frame both modes from docs/demos. Returns the files written. */
export async function frameAll(dir: string): Promise<string[]> {
  const written: string[] = [];
  for (const mode of ['light', 'dark'] as Mode[]) {
    const shots = {
      wall: path.join(dir, `hero-wall-${mode}.png`),
      tablet: path.join(dir, `hero-tablet-${mode}.png`),
      phone: path.join(dir, `hero-phone-${mode}.png`),
    };
    const missing = Object.values(shots).filter((f) => !fs.existsSync(f));
    if (missing.length) {
      console.warn(`  frame ${mode}: skipped, missing ${missing.map((f) => path.basename(f)).join(', ')}`);
      continue;
    }
    const out = path.join(dir, `hero-${mode}.png`);
    await composeHero(mode, shots, out);
    written.push(out);
  }
  return written;
}

if (require.main === module) {
  const dir = path.resolve(__dirname, '..', 'docs', 'demos');
  frameAll(dir)
    .then((files) => {
      for (const f of files) console.log(`  ✓ ${path.basename(f)}`);
      if (files.length === 0) process.exit(1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
