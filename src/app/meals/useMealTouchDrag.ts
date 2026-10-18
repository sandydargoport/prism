'use client';

import type { Meal } from '@/types';
import { useLongPressDrag } from '@/lib/hooks/useLongPressDrag';

export { TOUCH_DRAG_DELAY_MS, TOUCH_DRAG_TOLERANCE_PX } from '@/lib/hooks/useLongPressDrag';

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
 * Touch drag for a meal card onto another day's row (`[data-meal-day]`), after
 * a press-and-hold (useLongPressDrag). Mouse keeps using native HTML5 drag.
 */
export function useMealTouchDrag<T extends HTMLElement>(
  mealId: string,
  onDropMeal?: (id: string, day: Meal['dayOfWeek']) => void,
) {
  return useLongPressDrag<T>({
    onMove: (x, y) => {
      clearHighlights();
      dayAt(x, y)?.classList.add(...HIGHLIGHT);
    },
    onDrop: (x, y) => {
      const day = dayAt(x, y)?.getAttribute('data-meal-day');
      if (day && onDropMeal) onDropMeal(mealId, day as Meal['dayOfWeek']);
    },
    onEnd: clearHighlights,
  });
}
