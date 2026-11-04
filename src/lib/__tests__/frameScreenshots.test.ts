/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';
import { CANVAS, PLACEMENT, composeHero, frameAll, type DeviceName } from '../../../scripts/frame-screenshots';

// scripts/frame-screenshots.ts puts the wall, tablet and phone shots into
// device frames on one image (docs/demos/hero-{light,dark}.png). Each shot
// here is one flat colour, so the composite can be read back pixel by pixel.

const COLOURS: Record<DeviceName, [number, number, number]> = {
  wall: [200, 30, 30],
  tablet: [30, 200, 30],
  phone: [30, 30, 200],
};

let dir: string;

async function solid(file: string, width: number, height: number, rgb: [number, number, number]) {
  await sharp({ create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
    .png()
    .toFile(file);
}

async function pixel(file: string, x: number, y: number): Promise<number[]> {
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * info.channels;
  return [data[i]!, data[i + 1]!, data[i + 2]!];
}

beforeEach(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frame-'));
  // Real capture sizes: 1080p wall, 1180x820 tablet, phone at 2x.
  await solid(path.join(dir, 'hero-wall-light.png'), 1920, 1080, COLOURS.wall);
  await solid(path.join(dir, 'hero-tablet-light.png'), 1180, 820, COLOURS.tablet);
  await solid(path.join(dir, 'hero-phone-light.png'), 780, 1688, COLOURS.phone);
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('frame-screenshots', () => {
  it('draws each device screen where PLACEMENT says, smaller devices in front', async () => {
    const out = path.join(dir, 'hero-light.png');
    await composeHero(
      'light',
      {
        wall: path.join(dir, 'hero-wall-light.png'),
        tablet: path.join(dir, 'hero-tablet-light.png'),
        phone: path.join(dir, 'hero-phone-light.png'),
      },
      out,
    );

    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([CANVAS.width, CANVAS.height]);

    for (const device of ['tablet', 'phone'] as DeviceName[]) {
      const p = PLACEMENT[device];
      const centre = await pixel(out, p.left + p.width / 2, p.top + p.height / 2);
      expect([device, centre]).toEqual([device, COLOURS[device]]);
    }
    // The wall's top-left area is not covered by the tablet or the phone.
    const w = PLACEMENT.wall;
    expect(await pixel(out, w.left + 100, w.top + 100)).toEqual(COLOURS.wall);
    // The canvas corner is backdrop, not a screen.
    const corner = await pixel(out, 5, 5);
    for (const c of Object.values(COLOURS)) expect(corner).not.toEqual(c);
  });

  it('frames only the modes whose three shots exist', async () => {
    const written = await frameAll(dir);
    expect(written.map((f) => path.basename(f))).toEqual(['hero-light.png']);
  });
});
