'use client';

import { useState, useRef, useEffect } from 'react';
import type { Meal } from '@/types';

// Same long-press gate as useDragReorder and the dnd-kit TouchSensors
// elsewhere: a finger has to rest on a meal before it is picked up, and any
// movement past the tolerance first means the user is scrolling.
export const TOUCH_DRAG_DELAY_MS = 500;
export const TOUCH_DRAG_TOLERANCE_PX = 8;

const HIGHLIGHT = ['ring-2', 'ring-primary'];

function clearHighlights() {
  document.querySelectorAll('[data-meal-day]').forEach(el => el.classList.remove(...HIGHLIGHT));
}

function dayAt(x: number, y: number): Element | undefined {
  // elementsFromPoint is missing in jsdom
  if (typeof document.elementsFromPoint !== 'function') return undefined;
  return document.elementsFromPoint(x, y).find(el => el.hasAttribute('data-meal-day'));
}

/**
 * Touch drag for a meal card onto another day's row (`[data-meal-day]`).
 * Mouse keeps using native HTML5 drag; this only handles touch events.
 *
 * Listeners are attached natively so touchmove can be non-passive: once a
 * drag is active it calls preventDefault so the page stops scrolling under
 * the finger. Before activation nothing is prevented, so scrolling is normal.
 */
export function useMealTouchDrag<T extends HTMLElement>(
  mealId: string,
  onDropMeal?: (id: string, day: Meal['dayOfWeek']) => void,
) {
  const ref = useRef<T | null>(null);
  const [dragging, setDragging] = useState(false);
  const latest = useRef({ mealId, onDropMeal });
  useEffect(() => { latest.current = { mealId, onDropMeal }; });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start: { x: number; y: number } | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = false;

    const cancelTimer = () => {
      if (timer !== null) { clearTimeout(timer); timer = null; }
    };
    const reset = () => {
      cancelTimer();
      start = null;
      if (active) { active = false; setDragging(false); }
      clearHighlights();
    };

    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) { reset(); return; }
      start = { x: t.clientX, y: t.clientY };
      cancelTimer();
      timer = setTimeout(() => {
        timer = null;
        active = true;
        setDragging(true);
        navigator.vibrate?.(10);
      }, TOUCH_DRAG_DELAY_MS);
    };

    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || !start) return;
      if (!active) {
        // Moved before the long-press fired: this is a scroll, let it be.
        if (Math.abs(t.clientX - start.x) > TOUCH_DRAG_TOLERANCE_PX
          || Math.abs(t.clientY - start.y) > TOUCH_DRAG_TOLERANCE_PX) {
          cancelTimer();
          start = null;
        }
        return;
      }
      if (e.cancelable) e.preventDefault();
      clearHighlights();
      dayAt(t.clientX, t.clientY)?.classList.add(...HIGHLIGHT);
    };

    const onEnd = (e: TouchEvent) => {
      const { mealId: id, onDropMeal: drop } = latest.current;
      const t = e.changedTouches[0];
      if (active && t && drop) {
        const day = dayAt(t.clientX, t.clientY)?.getAttribute('data-meal-day');
        if (day) drop(id, day as Meal['dayOfWeek']);
      }
      reset();
    };

    // A long-press also opens the browser's context menu; swallow it while a
    // finger is down so it does not cover the card being picked up.
    const onContextMenu = (e: Event) => {
      if (start || active) e.preventDefault();
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', reset);
    el.addEventListener('contextmenu', onContextMenu);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', reset);
      el.removeEventListener('contextmenu', onContextMenu);
      cancelTimer();
    };
  }, []);

  return { ref, dragging };
}
