'use client';

import { useState, useRef, useEffect } from 'react';

// The app's touch-drag gate, shared with useDragReorder and the dnd-kit
// TouchSensors elsewhere: a finger has to rest before anything is picked up,
// and movement past the tolerance first means the user is scrolling.
export const TOUCH_DRAG_DELAY_MS = 500;
export const TOUCH_DRAG_TOLERANCE_PX = 8;

export type LongPressDragHandlers = {
  /** The press held long enough: the drag is live. */
  onStart?: () => void;
  /** The finger moved during a live drag, in viewport coordinates. */
  onMove?: (x: number, y: number) => void;
  /** The finger lifted during a live drag, where it lifted. */
  onDrop?: (x: number, y: number) => void;
  /** Any end of a live drag: dropped, cancelled or unmounted. */
  onEnd?: () => void;
};

/**
 * A press on a text field starts typing, not a drag: a long press there is
 * the platform's own (caret, selection, magnifier).
 */
function startsInTextField(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')
  );
}

/**
 * Press-and-hold, then drag, for touch. Mouse is left to native HTML5 drag.
 *
 * Listeners are attached natively so touchmove can be non-passive (React's
 * touch listeners are passive). Before the hold completes nothing is
 * prevented, so a gesture that moves first is an ordinary scroll; once the
 * drag is live, touchmove calls preventDefault and the page stops scrolling
 * under the finger. touchcancel, a second finger and unmounting all end the
 * drag cleanly.
 *
 * Callers supply only what the drag means: what to highlight, what to drop
 * where. Callbacks are read at call time, so they can close over fresh state.
 */
export function useLongPressDrag<T extends HTMLElement>(
  handlers: LongPressDragHandlers,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const ref = useRef<T | null>(null);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(handlers);
  useEffect(() => { latest.current = handlers; });

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let start: { x: number; y: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = false;

    const cancelTimer = () => {
      if (timer !== null) { clearTimeout(timer); timer = null; }
    };
    const reset = () => {
      cancelTimer();
      start = null;
      if (active) {
        active = false;
        setDragging(false);
        latest.current.onEnd?.();
      }
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1 || startsInTextField(e.target)) { reset(); return; }
      start = { x: t.clientX, y: t.clientY };
      cancelTimer();
      timer = setTimeout(() => {
        timer = null;
        active = true;
        setDragging(true);
        navigator.vibrate?.(10);
        latest.current.onStart?.();
      }, TOUCH_DRAG_DELAY_MS);
    };

    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || !start) return;
      if (!active) {
        if (Math.abs(t.clientX - start.x) > TOUCH_DRAG_TOLERANCE_PX
          || Math.abs(t.clientY - start.y) > TOUCH_DRAG_TOLERANCE_PX) {
          cancelTimer();
          start = null;
        }
        return;
      }
      if (e.cancelable) e.preventDefault();
      latest.current.onMove?.(t.clientX, t.clientY);
    };

    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (active && t) latest.current.onDrop?.(t.clientX, t.clientY);
      reset();
    };

    // The long press would otherwise open the platform's context menu.
    const onContextMenu = (e: Event) => {
      if (start || active) e.preventDefault();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', reset);
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', reset);
      el.removeEventListener('contextmenu', onContextMenu);
      reset();
    };
  }, [enabled]);

  return { ref, dragging };
}
