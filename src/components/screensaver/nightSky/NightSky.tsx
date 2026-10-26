'use client';

import { useEffect, useRef, useState } from 'react';
import { useShouldSkipMotion } from '@/lib/hooks/useShouldSkipMotion';
import { readStored, writeStored } from '@/lib/hooks/useStoredValue';
import { STARS, LINES, MILKY_WAY, FIGURES } from './catalog';
import { Constellation, lessonLength } from './Constellation';
import { pickNext, type Placement, type TaughtHistory } from './teach';
import {
  facingFor, localSiderealTime, moonPosition, project, skyLight, sunPosition, toEquatorial, toHorizontal,
  unproject,
  type Horizontal, type View,
} from './sky';

/** A bright star on screen, for the twinkle drawn over the canvas. */
export type BrightStar = { x: number; y: number; r: number; rgb: string }

type Meteor = { id: number; x: number; y: number; angle: number; travel: number; length: number }

/** When each figure was last taught on this display. */
const TAUGHT_KEY = 'prism-night-sky-taught';
/** The first lesson soon after the sky comes up, then one after each pause. */
const FIRST_LESSON = 12_000;
const BETWEEN_LESSONS = 40_000;

function readTaught(): TaughtHistory {
  try {
    const parsed: unknown = JSON.parse(readStored(TAUGHT_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as TaughtHistory) : {};
  } catch {
    return {};
  }
}

/**
 * The screensaver's night sky: the stars, Milky Way, constellation figures and
 * moon as they stand outside right now, drawn on one canvas.
 *
 * The canvas redraws once a minute and not otherwise. The sky turns a quarter
 * of a degree in that time, which is about a pixel, so a frame loop would spend
 * the whole night redrawing a picture that had not changed. What does move,
 * the twinkle on the brightest stars and the odd shooting star, is CSS on top:
 * opacity and transform animations the compositor runs without touching the
 * canvas. Both stop with reduced motion or Performance Mode.
 */
export function NightSky({ lat, lon }: { lat: number; lon: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bright, setBright] = useState<BrightStar[]>([]);
  const [dark, setDark] = useState(0);
  const [meteor, setMeteor] = useState<Meteor | null>(null);
  const [lesson, setLesson] = useState<Placement | null>(null);
  const still = useShouldSkipMotion();

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const paint = () => {
      const drawn = drawSky(el, new Date(), lat, lon);
      setBright(drawn.bright);
      setDark(drawn.dark);
    };
    paint();
    const timer = window.setInterval(paint, 60_000);
    const resize = new ResizeObserver(paint);
    resize.observe(el);
    return () => { window.clearInterval(timer); resize.disconnect(); };
  }, [lat, lon]);

  // A shooting star every few minutes, somewhere in the upper sky, only once
  // it is properly dark.
  const meteorsOn = !still && dark > 0.6;
  useEffect(() => {
    if (!meteorsOn) return;
    let timer = 0;
    let id = 0;
    const next = () => {
      timer = window.setTimeout(() => {
        const el = canvas.current;
        if (el) {
          const h = el.clientHeight;
          const leftward = Math.random() < 0.5;
          setMeteor({
            id: ++id,
            x: el.clientWidth * (0.15 + Math.random() * 0.7),
            y: h * (0.05 + Math.random() * 0.35),
            angle: leftward ? 140 + Math.random() * 30 : 10 + Math.random() * 30,
            travel: h * (0.25 + Math.random() * 0.2),
            length: h * (0.08 + Math.random() * 0.06),
          });
        }
        next();
      }, 120_000 + Math.random() * 240_000);
    };
    next();
    return () => window.clearTimeout(timer);
  }, [meteorsOn]);

  // One constellation at a time, drawn in and named, once it is dark enough
  // to see them. The display remembers which it has shown, so it works
  // through all of them before coming back round.
  const teaching = dark > 0.6;
  useEffect(() => {
    if (!teaching) return;
    let timer = 0;
    const teach = () => {
      const el = canvas.current;
      const next = el && pickNext(
        FIGURES, lat, localSiderealTime(new Date(), lon),
        { width: el.clientWidth, height: el.clientHeight, facing: facingFor(lat) },
        // Not behind a widget, where it could not be seen.
        Array.from(document.querySelectorAll('.prism-screensaver-flat'), (w) => w.getBoundingClientRect()),
        readTaught(),
      );
      if (!next) {
        timer = window.setTimeout(teach, BETWEEN_LESSONS);
        return;
      }
      writeStored(TAUGHT_KEY, JSON.stringify({ ...readTaught(), [next.fig.id]: Date.now() }));
      setLesson(next);
      timer = window.setTimeout(() => {
        setLesson(null);
        timer = window.setTimeout(teach, BETWEEN_LESSONS);
      }, lessonLength(next));
    };
    timer = window.setTimeout(teach, FIRST_LESSON);
    return () => {
      window.clearTimeout(timer);
      setLesson(null);
    };
  }, [teaching, lat, lon]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={canvas} data-testid="night-sky" className="absolute inset-0 h-full w-full" />
      {!still && bright.map((s, i) => (
        <span
          key={i}
          data-testid="night-sky-twinkle"
          className="night-sky-twinkle absolute rounded-full"
          style={{
            left: s.x,
            top: s.y,
            width: s.r * 2,
            height: s.r * 2,
            background: `radial-gradient(circle, rgba(${s.rgb},0.9) 0%, rgba(${s.rgb},0.25) 30%, rgba(${s.rgb},0) 70%)`,
            // Spread over 3 to 7 seconds by position in the list, so no two
            // neighbours keep time with each other.
            animationDuration: `${3 + ((i * 1.37) % 4)}s`,
            animationDelay: `${-((i * 0.73) % 5)}s`,
          }}
        />
      ))}
      {lesson && (
        <Constellation key={lesson.fig.id} placement={lesson} still={still} />
      )}
      {meteorsOn && meteor && (
        <span
          key={meteor.id}
          data-testid="night-sky-meteor"
          className="night-sky-meteor absolute"
          onAnimationEnd={() => setMeteor(null)}
          style={{
            left: meteor.x,
            top: meteor.y,
            width: meteor.length,
            height: 2,
            background: 'linear-gradient(to right, rgba(255,255,255,0), rgba(230,240,255,0.9))',
            ['--angle' as string]: `${meteor.angle}deg`,
            ['--travel' as string]: `${meteor.travel}px`,
          }}
        />
      )}
    </div>
  );
}

function starColour(bv: number): string {
  if (bv < 0) return '170,196,255';
  if (bv < 0.3) return '223,232,255';
  if (bv < 0.6) return '255,248,236';
  if (bv < 1.0) return '255,224,176';
  return '255,197,138';
}

/** Thicker air near the horizon: stars fade out toward it, as they do outside. */
const extinction = (alt: number) => Math.min(1, Math.max(0, alt / 8));

/** Stars brighter than this twinkle. About twenty are up on any night. */
const TWINKLE_MAG = 1.6;

export function drawSky(
  el: HTMLCanvasElement, date: Date, lat: number, lon: number,
): { bright: BrightStar[]; dark: number } {
  const ctx = el.getContext('2d');
  const none = { bright: [], dark: 0 };
  if (!ctx) return none;
  // Device pixels this time: there is no frame loop to pay for them, and stars
  // are exactly the fine detail a low-resolution canvas smears.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = el.clientWidth;
  const height = el.clientHeight;
  if (!width || !height) return none;
  el.width = Math.round(width * dpr);
  el.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const view: View = { width, height, facing: facingFor(lat) };
  const scale = height / 1080;
  const sun = sunPosition(date, lat, lon);
  const moon = moonPosition(date, lat, lon);
  const light = skyLight(sun.alt);
  const lst = localSiderealTime(date, lon);
  const at = (p: Horizontal) => project(p, view);
  const horizonY = at({ alt: 0, az: view.facing }).y;

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, light.top);
  sky.addColorStop(1, light.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  // The faint dome of light over the nearest town, low on every horizon.
  const dome = ctx.createLinearGradient(0, horizonY - height * 0.32, 0, horizonY);
  dome.addColorStop(0, 'rgba(110,100,120,0)');
  dome.addColorStop(1, `rgba(110,100,120,${0.16 * light.stars})`);
  ctx.fillStyle = dome;
  ctx.fillRect(0, 0, width, height);

  // Dusk and dawn: a warm glow on the horizon under the sun.
  if (light.glow > 0) {
    const g = at({ alt: 0, az: sun.az });
    const radius = height * 0.7;
    const glow = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, radius);
    glow.addColorStop(0, `rgba(255,150,90,${0.35 * light.glow})`);
    glow.addColorStop(1, 'rgba(255,150,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
  }

  const bright: BrightStar[] = [];
  if (light.stars > 0) {
    // The Milky Way is the last thing to come out at dusk, so it follows the
    // square of the darkness; and a bright moon washes it out, a full one by half.
    const moonlight = moon.alt > 0 ? 1 - 0.5 * moon.fraction : 1;
    drawMilkyWay(ctx, view, lat, lst, light.stars ** 2 * moonlight);
    drawStarDust(ctx, view, lat, lst, light.stars ** 2 * moonlight);

    ctx.lineWidth = Math.max(1, scale);
    ctx.strokeStyle = `rgba(160,184,230,${0.14 * light.stars})`;
    ctx.beginPath();
    for (const line of LINES) {
      let pen = false;
      for (let i = 0; i < line.length; i += 2) {
        const h = toHorizontal(line[i]!, line[i + 1]!, lat, lst);
        if (h.alt < 0) { pen = false; continue; }
        const p = at(h);
        if (pen) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y);
        pen = true;
      }
    }
    ctx.stroke();

    // Faintest first, so a bright star's halo is never covered by a dim one.
    for (let i = STARS.length - 4; i >= 0; i -= 4) {
      const h = toHorizontal(STARS[i]!, STARS[i + 1]!, lat, lst);
      if (h.alt < 0) continue;
      const p = at(h);
      if (p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10) continue;
      const mag = STARS[i + 2]!;
      const alpha = light.stars * extinction(h.alt) * Math.min(1, 1.15 - mag * 0.14);
      if (alpha <= 0.02) continue;
      const radius = Math.max(0.55, (3.6 - mag * 0.52) * scale);
      const rgb = starColour(STARS[i + 3]!);
      if (mag < 2) {
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 5);
        halo.addColorStop(0, `rgba(${rgb},${0.4 * alpha})`);
        halo.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(p.x - radius * 5, p.y - radius * 5, radius * 10, radius * 10);
      }
      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      if (radius < 1) {
        // A pinpoint: a square is indistinguishable and far cheaper.
        ctx.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
      if (mag < TWINKLE_MAG && h.alt > 10 && light.stars > 0.5) {
        bright.push({ x: p.x, y: p.y, r: radius * 4, rgb });
      }
    }
  }

  drawMoon(ctx, moon, at, height);
  drawGround(ctx, at, width, height, view.facing);
  drawGrain(ctx, width, height);
  return { bright, dark: light.stars };
}

/** Milky Way brightness at a point, 0..1, smoothed between grid cells. */
function milkyWayAt(ra: number, dec: number): number {
  const x = ra - 0.5;
  const y = Math.min(178.999, Math.max(0, dec + 89.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const cell = (c: number, r: number) => MILKY_WAY.charCodeAt(r * 360 + ((c + 360) % 360)) - 48;
  const top = cell(x0, y0) * (1 - fx) + cell(x0 + 1, y0) * fx;
  const bottom = cell(x0, y0 + 1) * (1 - fx) + cell(x0 + 1, y0 + 1) * fx;
  return (top * (1 - fy) + bottom * fy) / 9;
}

/** Points of star dust: flat [ra°, dec°, brightness 0..1, band brightness 0..1]. */
let starDust: Float32Array | null = null;
const DUST = 80_000;

/**
 * The Milky Way's grain: a great many faint points, scattered over the band as
 * thickly as it is bright. The glow alone reads as thin cloud; it is this
 * grain, the unresolved stars, that makes it read as the galaxy. Made once,
 * from a fixed seed, so the same points stay in the same places on the sky.
 */
function makeStarDust(): Float32Array {
  const out = new Float32Array(DUST * 4);
  const rand = seeded(1987);
  let n = 0;
  for (let tries = 0; n < DUST && tries < DUST * 60; tries++) {
    // Even over the sphere, then kept in proportion to the band's brightness.
    const ra = rand() * 360;
    const dec = (Math.asin(2 * rand() - 1) * 180) / Math.PI;
    const v = milkyWayAt(ra, dec);
    if (v <= 0 || rand() > v ** 1.2) continue;
    out[n * 4] = ra;
    out[n * 4 + 1] = dec;
    out[n * 4 + 2] = rand() ** 2.5;
    out[n * 4 + 3] = v;
    n++;
  }
  return out.subarray(0, n * 4);
}

/** Alpha steps the dust is drawn in: one fill per step rather than one per point. */
const DUST_STEPS = 8;

function drawStarDust(
  ctx: CanvasRenderingContext2D, view: View, lat: number, lst: number, strength: number,
) {
  if (strength <= 0.05) return;
  starDust ??= makeStarDust();
  const size = Math.max(0.8, view.height / 1080);
  const steps: Path2D[] = Array.from({ length: DUST_STEPS }, () => new Path2D());
  for (let i = 0; i < starDust.length; i += 4) {
    const h = toHorizontal(starDust[i]!, starDust[i + 1]!, lat, lst);
    if (h.alt < 2) continue;
    const p = project(h, view);
    if (p.x < 0 || p.x > view.width || p.y < 0 || p.y > view.height) continue;
    const a = Math.min(1, h.alt / 25) * (0.25 + 0.75 * starDust[i + 2]!) * (0.4 + 0.6 * starDust[i + 3]!);
    const step = Math.min(DUST_STEPS - 1, Math.floor(a * DUST_STEPS));
    steps[step]!.rect(p.x, p.y, size, size);
  }
  for (let k = 0; k < DUST_STEPS; k++) {
    ctx.fillStyle = `rgba(225,232,255,${(((k + 1) / DUST_STEPS) * 0.55 * strength).toFixed(3)})`;
    ctx.fill(steps[k]!);
  }
}

/**
 * The Milky Way, looked up pixel by pixel on a canvas a quarter of the size
 * and scaled up, which is both the softening and the saving.
 *
 * Each pixel is turned back into a point of the sky and its brightness read
 * from the grid. That is right however the band lies across the screen, which
 * filling its outline polygons was not.
 */
function drawMilkyWay(
  ctx: CanvasRenderingContext2D, view: View, lat: number, lst: number, strength: number,
) {
  if (strength <= 0) return;
  const k = 4;
  const w = Math.max(1, Math.round(view.width / k));
  const h = Math.max(1, Math.round(view.height / k));
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const o = off.getContext('2d');
  if (!o) return;
  const img = o.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sky = unproject((x + 0.5) * k, (y + 0.5) * k, view);
      if (sky.alt <= 0) continue;
      const { ra, dec } = toEquatorial(sky, lat, lst);
      const v = milkyWayAt(ra, dec);
      if (v <= 0) continue;
      // Thicker air near the horizon dims it, as it does the stars.
      const haze = Math.min(1, sky.alt / 25);
      const a = Math.min(1, v ** 1.4 * haze * strength * 0.24);
      const i = (y * w + x) * 4;
      // Bluish where faint, warmer in the bright star clouds of the core.
      img.data[i] = 190 + 50 * v;
      img.data[i + 1] = 200 + 30 * v;
      img.data[i + 2] = 240 - 20 * v;
      img.data[i + 3] = a * 255;
    }
  }
  o.putImageData(img, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if ('filter' in ctx) ctx.filter = `blur(${Math.max(1, view.height / 220)}px)`;
  ctx.drawImage(off, 0, 0, view.width, view.height);
  ctx.restore();
}

function drawMoon(
  ctx: CanvasRenderingContext2D, moon: ReturnType<typeof moonPosition>,
  at: (p: Horizontal) => { x: number; y: number }, height: number,
) {
  if (moon.alt < -1) return;
  const { x, y } = at(moon);
  // Several times its true size. At half a degree it would be a dot.
  const r = height * 0.026;

  const halo = ctx.createRadialGradient(x, y, r, x, y, r * 6);
  halo.addColorStop(0, `rgba(240,236,220,${0.18 * moon.fraction})`);
  halo.addColorStop(1, 'rgba(240,236,220,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - r * 6, y - r * 6, r * 12, r * 12);

  ctx.save();
  ctx.translate(x, y);
  // The unlit part is faintly there, the way it is on a clear night.
  ctx.fillStyle = 'rgba(200,205,220,0.08)';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Turn so the bright limb points along +x, then draw the lit half and close
  // it with the terminator, an ellipse that bulges out for a crescent and back
  // for a gibbous moon.
  ctx.rotate(Math.atan2(-Math.cos(moon.limb), -Math.sin(moon.limb)));
  const rx = r * Math.abs(2 * moon.fraction - 1);
  ctx.fillStyle = '#f4f1e6';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  if (moon.fraction >= 0.5) ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, Math.PI * 1.5);
  else ctx.ellipse(0, 0, rx, r, 0, Math.PI / 2, -Math.PI / 2, true);
  ctx.fill();
  ctx.restore();
}

/** Small deterministic random numbers, so the treeline is the same every night. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/**
 * The ground under the horizon, with a treeline along it.
 *
 * In this projection the horizon is a circle around the sky, so only its lower
 * arc is traced: a hundred degrees either way is already off both sides of the
 * screen, and going further round would climb back up over the sky. The trees
 * are laid out in units of the screen height, so they keep their size and
 * spacing on any display.
 */
function drawGround(
  ctx: CanvasRenderingContext2D, at: (p: Horizontal) => { x: number; y: number },
  width: number, height: number, facing: number,
) {
  // The horizon's height at each pixel column.
  const arc: { x: number; y: number }[] = [];
  for (let d = -100; d <= 100; d += 2) arc.push(at({ alt: 0, az: facing + d }));
  const columns = Math.ceil(width) + 1;
  const base = new Float32Array(columns);
  let j = 0;
  for (let x = 0; x < columns; x++) {
    while (j < arc.length - 2 && arc[j + 1]!.x < x) j++;
    const a = arc[j]!;
    const b = arc[j + 1]!;
    const t = b.x === a.x ? 0 : Math.min(1, Math.max(0, (x - a.x) / (b.x - a.x)));
    base[x] = a.y + (b.y - a.y) * t;
  }

  // Tree heights above the horizon, built up in screen-height units.
  const lift = new Float32Array(columns);
  const rand = seeded(340);
  const units = width / height;
  for (let u = -0.05; u < units + 0.05; u += 0.004 + rand() * 0.012) {
    // Stands and clearings, from a slow wave along the horizon.
    const stand = Math.sin(u * 5.1) + Math.sin(u * 2.3 + 1.7);
    if (stand < -0.6 && rand() < 0.85) continue;
    const conifer = rand() < 0.6;
    const tall = (0.014 + rand() * 0.032) * (stand > 0.8 ? 1.2 : 1);
    const half = conifer ? tall * (0.22 + rand() * 0.1) : tall * (0.45 + rand() * 0.25);
    const from = Math.max(0, Math.floor((u - half) * height));
    const to = Math.min(columns - 1, Math.ceil((u + half) * height));
    for (let x = from; x <= to; x++) {
      const d = Math.abs(x / height - u) / half;
      if (d > 1) continue;
      const h = conifer ? tall * (1 - d) : tall * Math.sqrt(1 - d * d) * 0.8;
      if (h > lift[x]!) lift[x] = h;
    }
  }

  ctx.fillStyle = '#03050a';
  ctx.beginPath();
  ctx.moveTo(0, height * 2);
  for (let x = 0; x < columns; x++) {
    // Low rolling ground under the trees.
    const hill = (Math.sin(x / height * 3.1) * 0.5 + 0.5) * 0.006;
    ctx.lineTo(x, base[x]! - (lift[x]! + hill) * height);
  }
  ctx.lineTo(columns, height * 2);
  ctx.closePath();
  ctx.fill();
}

let grainTile: HTMLCanvasElement | null = null;

/**
 * A faint grain over everything. Dark gradients on an 8-bit screen show as
 * visible bands; a level of noise breaks them up, as film grain does.
 */
function drawGrain(ctx: CanvasRenderingContext2D, width: number, height: number) {
  if (!grainTile) {
    const tile = document.createElement('canvas');
    tile.width = tile.height = 128;
    const t = tile.getContext('2d');
    if (!t) return;
    const img = t.createImageData(128, 128);
    const rand = seeded(1);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rand() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    t.putImageData(img, 0, 0);
    grainTile = tile;
  }
  const pattern = ctx.createPattern(grainTile, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.globalAlpha = 0.025;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
