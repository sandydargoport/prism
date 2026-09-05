'use client';

import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef,
} from 'react';
import type { EffectFrame, EffectPhase, ScreensaverEffect } from './effects';
import { scaledDuration } from './screensaverPrefs';

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
  /** When this entry last drew, so a throttled effect can skip frames. */
  drawnAt: number;
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
  begin(key: string, a: Omit<Active, 't0' | 'state' | 'drawnAt'>): () => void;
}

const StageContext = createContext<Stage | null>(null);

export function useEffectStage(): Stage | null {
  return useContext(StageContext);
}

export function EffectStage({ children }: { children: React.ReactNode }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const active = useRef(new Map<string, Active>());
  const raf = useRef(0);

  const clearEntry = useCallback((a: Active) => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const origin = el.getBoundingClientRect();
    const pad = a.effect.spread ?? 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(
      a.viewportLeft - origin.left - pad,
      a.viewportTop - origin.top - pad,
      a.width + pad * 2,
      a.height + pad * 2,
    );
  }, []);

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

    // Only the entries that are actually drawing this frame, and only where
    // they reach. An effect says how far beyond its widget it goes — fireworks
    // throws fragments most of the way across the screen, water stays in its
    // box — and a throttled effect leaves its last frame on the canvas rather
    // than clearing to nothing and redrawing the same thing.
    // Throttling is all-or-nothing for the frame, not per entry.
    //
    // An effect reaches beyond its widget, so neighbouring entries overlap. With
    // each entry on its own schedule, one drawing at full rate cleared its
    // region — including the part its neighbour had drawn into — while the
    // neighbour, throttled, only redrew every third frame. The overlap
    // flickered, and for a widget with settled water on both sides it never
    // stopped.
    //
    // So the frame is either drawn or skipped. A transition is short and is the
    // thing being watched, so its presence pulls the whole frame up to full
    // rate; when only settled water is left, everything idles together.
    const entries = [...active.current.entries()];
    const anyDue = entries.some(([, a]) => {
      const gap = a.persistent ? (a.effect.frameMs ?? 0) : 0;
      return gap <= 0 || now - a.drawnAt >= gap;
    });
    const due = anyDue ? entries : [];
    if (!due.length) {
      raf.current = active.current.size ? requestAnimationFrame(tick) : 0;
      return;
    }
    for (const [, a] of due) {
      const pad = a.effect.spread ?? 0;
      ctx.clearRect(
        (a.viewportLeft - origin.left - pad) * dpr,
        (a.viewportTop - origin.top - pad) * dpr,
        (a.width + pad * 2) * dpr,
        (a.height + pad * 2) * dpr,
      );
    }

    for (const [key, a] of due) {
      const dt = a.drawnAt ? now - a.drawnAt : 16;
      a.drawnAt = now;
      const duration = scaledDuration(a.effect.durationMs[a.phase]);
      const progress = a.persistent ? 1 : Math.min(1, (now - a.t0) / duration);
      const frame: EffectFrame = {
        progress, phase: a.phase, width: a.width, height: a.height,
        dt, now, pixels: a.pixels, state: a.state,
      };
      a.onFrame(frame);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(a.viewportLeft - origin.left, a.viewportTop - origin.top);
      a.effect.frame?.(ctx, frame);
      if (progress >= 1 && !a.persistent) {
        if (a.effect.ambient && a.phase === 'in') {
          // A finished arrival BECOMES the resting state rather than ending and
          // being replaced by one.
          //
          // Deleting it, clearing its patch and waiting for a fresh entry to be
          // registered left a frame or two with nothing drawn — and the new
          // entry started with new state, so the bubbles jumped as well. Both
          // showed at the end of a fill, which is where a widget hands over from
          // arriving to simply sitting there. Keeping the entry keeps its water
          // exactly where it was.
          // Deliberately NOT calling onDone. That hands the element back to its
          // resting styles, which clears the clip — and the very next frame this
          // same entry reapplies it. The widget's top snapped open and shut
          // again in consecutive frames, which is the flicker at the end of a
          // fill "as the mask turns back on". The entry still owns the element,
          // so it keeps it.
          a.persistent = true;
        } else {
          active.current.delete(key);
          clearEntry(a);
          a.onDone();
        }
      }
    }

    raf.current = active.current.size ? requestAnimationFrame(tick) : 0;
  }, [clearEntry]);

  const begin = useCallback<Stage['begin']>((key, a) => {
    const entry: Active = {
      ...a,
      t0: performance.now(),
      drawnAt: 0,
      state: a.effect.init?.({
        progress: 0, phase: a.phase, width: a.width, height: a.height,
        dt: 0, now: performance.now(), pixels: a.pixels,
      }) ?? null,
    };
    active.current.set(key, entry);
    if (!raf.current) raf.current = requestAnimationFrame(tick);
    return () => {
      // Only if this entry is still the one under that key. A widget keys its
      // entries by id alone, so starting a new transition replaces the old one
      // — and the old one's cancel must not then delete its replacement.
      if (active.current.get(key) !== entry) return;
      active.current.delete(key);
      // The loop may already have stopped, so clear this entry's own patch here
      // rather than waiting for a frame that is not coming.
      clearEntry(entry);
    };
  }, [tick, clearEntry]);

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
