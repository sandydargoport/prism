'use client';

import { useEffect, useRef } from 'react';
import { STARS, LINES } from './catalog';
import {
  facingFor, localSiderealTime, moonPosition, project, skyLight, sunPosition, toHorizontal,
  type Horizontal, type View,
} from './sky';

/**
 * The screensaver's night sky: the stars, constellation figures and moon as
 * they stand outside right now, drawn on one canvas.
 *
 * It redraws once a minute and not otherwise. The sky turns a quarter of a
 * degree in that time, which is about a pixel, so a frame loop would spend the
 * whole night redrawing a picture that had not changed. Loading nothing and
 * animating nothing is the point of offering it on a display that never sleeps.
 */
export function NightSky({ lat, lon }: { lat: number; lon: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const paint = () => drawSky(el, new Date(), lat, lon);
    paint();
    const timer = window.setInterval(paint, 60_000);
    const resize = new ResizeObserver(paint);
    resize.observe(el);
    return () => { window.clearInterval(timer); resize.disconnect(); };
  }, [lat, lon]);

  return (
    <canvas
      ref={canvas}
      data-testid="night-sky"
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

function starColour(bv: number): string {
  if (bv < 0) return '170,196,255';
  if (bv < 0.3) return '223,232,255';
  if (bv < 0.6) return '255,248,236';
  if (bv < 1.0) return '255,224,176';
  return '255,197,138';
}

/** Thinner air overhead: stars fade out toward the horizon, as they do outside. */
const extinction = (alt: number) => Math.min(1, Math.max(0, alt / 8));

export function drawSky(el: HTMLCanvasElement, date: Date, lat: number, lon: number) {
  const ctx = el.getContext('2d');
  if (!ctx) return;
  // Device pixels this time: there is no frame loop to pay for them, and stars
  // are exactly the fine detail a low-resolution canvas smears.
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = el.clientWidth;
  const height = el.clientHeight;
  if (!width || !height) return;
  el.width = Math.round(width * dpr);
  el.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const view: View = { width, height, facing: facingFor(lat) };
  const scale = height / 1080;
  const sun = sunPosition(date, lat, lon);
  const light = skyLight(sun.alt);
  const lst = localSiderealTime(date, lon);
  const at = (p: Horizontal) => project(p, view);

  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, light.top);
  sky.addColorStop(1, light.bottom);
  ctx.fillStyle = sky;
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

  if (light.stars > 0) {
    ctx.lineWidth = Math.max(1, scale);
    ctx.strokeStyle = `rgba(160,184,230,${0.22 * light.stars})`;
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

    for (let i = 0; i < STARS.length; i += 4) {
      const h = toHorizontal(STARS[i]!, STARS[i + 1]!, lat, lst);
      if (h.alt < 0) continue;
      const p = at(h);
      if (p.x < -10 || p.x > width + 10 || p.y < -10 || p.y > height + 10) continue;
      const mag = STARS[i + 2]!;
      const alpha = light.stars * extinction(h.alt) * Math.min(1, 1.25 - mag * 0.15);
      if (alpha <= 0.02) continue;
      const radius = Math.max(1, (3.8 - mag * 0.55) * scale);
      const rgb = starColour(STARS[i + 3]!);
      if (mag < 2) {
        const halo = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 5);
        halo.addColorStop(0, `rgba(${rgb},${0.4 * alpha})`);
        halo.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(p.x - radius * 5, p.y - radius * 5, radius * 10, radius * 10);
      }
      ctx.fillStyle = `rgba(${rgb},${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMoon(ctx, date, lat, lon, at, height);
  drawGround(ctx, at, height, view.facing);
}

function drawMoon(
  ctx: CanvasRenderingContext2D, date: Date, lat: number, lon: number,
  at: (p: Horizontal) => { x: number; y: number }, height: number,
) {
  const moon = moonPosition(date, lat, lon);
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

/**
 * A dark band of ground under the horizon, following its curve.
 *
 * In this projection the horizon is a circle around the sky, so only its lower
 * arc is traced: a hundred degrees either way is already off both sides of the
 * screen, and going further round would climb back up over the sky.
 */
function drawGround(
  ctx: CanvasRenderingContext2D, at: (p: Horizontal) => { x: number; y: number },
  height: number, facing: number,
) {
  ctx.fillStyle = '#03050a';
  ctx.beginPath();
  const first = at({ alt: 0, az: facing - 100 });
  ctx.moveTo(first.x, first.y);
  let last = first;
  for (let d = -95; d <= 100; d += 5) {
    last = at({ alt: 0, az: facing + d });
    ctx.lineTo(last.x, last.y);
  }
  ctx.lineTo(last.x, height * 2);
  ctx.lineTo(first.x, height * 2);
  ctx.closePath();
  ctx.fill();
}
