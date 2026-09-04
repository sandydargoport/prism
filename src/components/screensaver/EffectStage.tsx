'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef,
} from 'react';
import type { EffectFrame, EffectPhase, ScreensaverEffect } from './effects';

/**
 * One canvas for the whole screensaver, not one per widget.
 *
 * A per-widget canvas is the obvious shape and it is wrong: it clips the effect
 * to the widget's own box. Fireworks looked like a widget quietly fizzing
 * inside its own rectangle instead of throwing pixels across the room, and
 * smoke could not drift anywhere. The demo drew everything onto one full-screen
 * surface for exactly this reason.
 *
 * Effects still draw in their widget's local coordinates — the stage translates
 * for them — so nothing has to know where on screen it is. The difference is
 * only that there is no longer an edge to hit.
 */
interface Active {
  effect: ScreensaverEffect;
  phase: EffectPhase;
  /** The widget's box in VIEWPORT coordinates; the stage converts. Doing this
   *  from offsetParent instead put the burst tens of pixels away from the
   *  widget it came from, which reads as a glitch beside it rather than as the
   *  widget itself coming apart. */
  viewportLeft: number; viewportTop: number; width: number; height: number;
  pixels: ImageData | null;
  state: unknown;
  t0: number;
  onFrame: (f: EffectFrame) => void;
  onDone: () => void;
  /**
   * Runs until it is cancelled instead of finishing. Water does not stop moving
   * because the glass is full — the surface still stirs and the bubbles still
   * rise — so an effect can hold a resting state open rather than ending.
   */
  persistent?: boolean;
}

interface Stage {
  begin(key: string, a: Omit<Active, 't0' | 'state'>): () => void;
}

const StageContext = createContext<Stage | null>(null);

export function useEffectStage(): Stage | null {
  return useContext(StageContext);
}

export function EffectStage({ children }: { children: React.ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef(new Map<string, Active>());
  const raf = useRef(0);
  const last = useRef(0);

  const tick = useCallback((now: number) => {
    const el = canvas.current;
    if (!el) { raf.current = 0; return; }
    // Deliberately 1, not devicePixelRatio.
    //
    // At 2 this is a 3840x2160 surface, and the whole of it is cleared every
    // frame — about 8 million pixels of pure overhead before anything is drawn.
    // Fill and drain pays it continuously, because its surface never stops
    // moving, and that alone held it at 17fps against a 54fps baseline. Nothing
    // drawn here has any fine detail to lose: the fragments are a couple of
    // pixels across and the water is a soft gradient.
    const dpr = 1;
    const w = Math.round(el.clientWidth * dpr);
    const h = Math.round(el.clientHeight * dpr);
    if (el.width !== w || el.height !== h) { el.width = w; el.height = h; }
    const ctx = el.getContext('2d');
    if (!ctx) { raf.current = 0; return; }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const origin = el.getBoundingClientRect();

    // Clear only where something is actually drawing. An effect says how far
    // beyond its widget it reaches — fireworks throws fragments most of the way
    // across the screen, water stays in its box — so the cleared area is the
    // union of what is live rather than the whole display.
    for (const a of active.current.values()) {
      const pad = a.effect.spread ?? 0;
      ctx.clearRect(
        (a.viewportLeft - origin.left - pad) * dpr,
        (a.viewportTop - origin.top - pad) * dpr,
        (a.width + pad * 2) * dpr,
        (a.height + pad * 2) * dpr,
      );
    }

    const dt = last.current ? now - last.current : 16;
    last.current = now;

    for (const [key, a] of Array.from(active.current)) {
      const duration = a.effect.durationMs[a.phase];
      const progress = a.persistent ? 1 : Math.min(1, (now - a.t0) / duration);
      const frame: EffectFrame = {
        progress, phase: a.phase, width: a.width, height: a.height,
        dt, now, pixels: a.pixels, state: a.state,
      };
      a.onFrame(frame);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(a.viewportLeft - origin.left, a.viewportTop - origin.top);
      a.effect.frame?.(ctx, frame);
      if (progress >= 1 && !a.persistent) { active.current.delete(key); a.onDone(); }
    }

    raf.current = active.current.size ? requestAnimationFrame(tick) : 0;
    if (!raf.current) last.current = 0;
  }, []);

  const begin = useCallback<Stage['begin']>((key, a) => {
    const entry: Active = {
      ...a,
      t0: performance.now(),
      state: a.effect.init?.({
        progress: 0, phase: a.phase, width: a.width, height: a.height,
        dt: 0, now: performance.now(), pixels: a.pixels,
      }) ?? null,
    };
    active.current.set(key, entry);
    if (!raf.current) raf.current = requestAnimationFrame(tick);
    return () => { active.current.delete(key); };
  }, [tick]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  // Memoised, and it matters more than it looks. A fresh object here is a new
  // context value on every render of this component — which happens on every
  // rotation — and every widget's transition effect depends on it. Each
  // rotation therefore cancelled and restarted a transition on EVERY widget at
  // once, so a single swap detonated the whole board.
  const value = useMemo(() => ({ begin }), [begin]);

  return (
    <StageContext.Provider value={value}>
      {children}
      {/* Above the widgets so fragments pass in front of them, and never in the
          way of a tap — the calendar's on-screensaver controls are underneath. */}
      <canvas
        ref={canvas}
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
      />
    </StageContext.Provider>
  );
}
