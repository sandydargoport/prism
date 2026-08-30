'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarEvent } from '@/types/calendar';
import { auroraPalette, isNightSkyNight, moonPhase, nightSkyEvents, tomorrowEvents } from './nightSkyUtils';

type Props = { events: CalendarEvent[]; loading: boolean };

function hash(value: string) {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return (result >>> 0) / 4294967295;
}

function paintMoon(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  age: number,
  night: boolean,
) {
  const cycle = age / 29.530588853;
  const angle = cycle * Math.PI * 2;
  const lit = night ? '#8b93a3' : '#e7e4d7';
  const dark = night ? '#050712' : '#091126';
  const rightLit = cycle < 0.5;

  context.save();
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = dark;
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2);

  context.fillStyle = lit;
  context.beginPath();
  context.arc(x, y, radius, -Math.PI / 2, Math.PI / 2, !rightLit);
  context.closePath();
  context.fill();

  const limbRadius = Math.abs(Math.cos(angle)) * radius;
  const isGibbous = cycle >= 0.25 && cycle < 0.75;
  context.fillStyle = isGibbous ? lit : dark;
  context.beginPath();
  context.ellipse(x, y, limbRadius, radius, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function NightSky({ events, loading }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [now, setNow] = useState(() => new Date());
  const upcoming = useMemo(() => nightSkyEvents(events, now), [events, now]);
  const tomorrow = useMemo(() => tomorrowEvents(events, now), [events, now]);
  const comet = tomorrow[0];
  const night = isNightSkyNight(now);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;
    let raf = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const paint = (timestamp: number) => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const drift = reduced ? 0 : timestamp / 80000;
      context.fillStyle = night ? '#010207' : '#030817';
      context.fillRect(0, 0, width, height);

      const palette = auroraPalette(tomorrow.length);
      context.globalCompositeOperation = 'screen';
      palette.forEach((color, index) => {
        const gradient = context.createRadialGradient(
          width * (0.2 + index * 0.3) + Math.sin(drift * 3 + index) * width * 0.08,
          height * 0.23, 0, width * 0.5, height * 0.15, width * 0.55,
        );
        gradient.addColorStop(0, `${color}${night ? '10' : tomorrow.length >= 8 ? '35' : '25'}`);
        gradient.addColorStop(1, '#00000000');
        context.fillStyle = gradient;
        context.fillRect(0, 0, width, height * 0.72);
      });
      context.globalCompositeOperation = 'source-over';

      const starCount = Math.min(260, Math.max(90, Math.floor((width * height) / 13000)));
      for (let index = 0; index < starCount; index++) {
        const seed = hash(`sky-${index}`);
        const x = ((hash(`x-${index}`) * width + drift * (8 + seed * 12)) % width + width) % width;
        const y = hash(`y-${index}`) * height;
        const radius = 0.45 + seed * 1.15;
        context.fillStyle = `rgba(220,232,255,${night ? 0.18 + seed * 0.35 : 0.28 + seed * 0.5})`;
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
      }

      const groups = new Map<string, CalendarEvent[]>();
      upcoming.forEach((event) => groups.set(event.color, [...(groups.get(event.color) || []), event]));
      Array.from(groups.entries()).forEach(([color, group], groupIndex) => {
        const cx = width * (0.17 + (groupIndex % 4) * 0.22) + Math.sin(drift * 2 + groupIndex) * 18;
        const cy = height * (0.28 + Math.floor(groupIndex / 4) * 0.28) + Math.cos(drift + groupIndex) * 12;
        const points = group.slice(0, 12).map((event, index) => {
          const angle = hash(event.id) * Math.PI * 2 + index * 0.8;
          const radius = 38 + hash(`${event.id}-r`) * Math.min(120, width * 0.07);
          return { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
        });
        context.strokeStyle = `${color}${night ? '35' : '68'}`;
        context.lineWidth = 1;
        context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke();
        points.forEach((point, index) => {
          context.shadowBlur = night ? 5 : 12; context.shadowColor = color;
          context.fillStyle = color; context.beginPath(); context.arc(point.x, point.y, index === 0 ? 3.5 : 2.4, 0, Math.PI * 2); context.fill();
        });
        context.shadowBlur = 0;
      });

      const phase = moonPhase(new Date());
      const moonX = width * 0.86, moonY = height * 0.18, moonR = Math.min(width, height) * 0.044;
      paintMoon(context, moonX, moonY, moonR, phase.age, night);

      if (comet) {
        const progress = reduced ? 0.45 : (timestamp % 60000) / 60000;
        const x = -120 + progress * (width + 240), y = height * 0.72 - progress * height * 0.22;
        const tail = context.createLinearGradient(x - 150, y + 45, x, y);
        tail.addColorStop(0, '#00000000'); tail.addColorStop(1, `${comet.color}aa`);
        context.strokeStyle = tail; context.lineWidth = 3; context.beginPath(); context.moveTo(x - 150, y + 45); context.lineTo(x, y); context.stroke();
        context.fillStyle = comet.color; context.shadowBlur = 18; context.shadowColor = comet.color; context.beginPath(); context.arc(x, y, 5, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
      }
      if (!reduced || frame === 0) raf = requestAnimationFrame(paint);
      frame++;
    };
    raf = requestAnimationFrame(paint);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, [upcoming, tomorrow.length, comet, night]);

  const next = upcoming[0];
  const time = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  return <div className={`fixed inset-0 overflow-hidden text-white ${night ? 'brightness-[.42]' : ''}`} data-testid="night-sky" data-night={night}>
    <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    <div className="pointer-events-none absolute inset-x-[7vw] bottom-[8vh] flex items-end justify-between gap-10 text-white/90 [text-shadow:0_2px_22px_rgba(0,0,0,.9)]">
      <div>
        <time className="block text-[clamp(4rem,9vw,11rem)] font-extralight leading-none tracking-[-.06em]" dateTime={now.toISOString()}>{time}</time>
        <p className="mt-3 text-[clamp(1rem,1.4vw,2rem)] font-light tracking-[.12em] text-white/65">{date}</p>
      </div>
      <div className="max-w-[38vw] border-l border-white/20 pl-7 text-right" aria-live="polite">
        <p className="text-sm uppercase tracking-[.35em] text-white/50">Next up</p>
        <p className="mt-3 text-[clamp(1.2rem,2.1vw,2.7rem)] font-light" style={{ color: next?.color || undefined }}>{loading ? 'Finding the next star…' : next ? next.title : 'The sky is clear'}</p>
        {next && <p className="mt-2 text-[clamp(.9rem,1.1vw,1.35rem)] text-white/65">{next.startTime.toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</p>}
      </div>
    </div>
    {comet && <div className="pointer-events-none absolute left-1/2 top-[70%] -translate-x-1/2 rounded-full border border-white/15 bg-black/20 px-5 py-2 text-[clamp(.8rem,1vw,1.2rem)] font-light tracking-wide text-white/75 backdrop-blur-sm">
      Tomorrow · <span style={{ color: comet.color }}>{comet.startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {comet.title}</span>
    </div>}
    {comet && <div className="sr-only">Tomorrow&apos;s first event: {comet.title} at {comet.startTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>}
  </div>;
}
