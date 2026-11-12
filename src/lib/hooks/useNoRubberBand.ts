'use client';

import { useEffect } from 'react';

/**
 * No rubber-band drag on a phone (#1034, #1074, #1076).
 *
 * `overscroll-behavior: none` on the root and the body is not enough: the
 * iPhone home-screen app still dragged pages and sprang them back. So a
 * one-finger vertical drag is cancelled unless something under the finger can
 * scroll that way: a scrolling box, or the page itself, that is not already
 * at that end. A page that fits the screen does not move at all; a long page
 * scrolls but does not pull past its top or bottom. Pinch-zoom (two fingers)
 * and sideways swipes are left alone.
 */
export function useNoRubberBand(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const els = [document.documentElement, document.body];
    const before = els.map((el) => el.style.overscrollBehaviorY);
    for (const el of els) el.style.overscrollBehaviorY = 'none';

    let startX = 0;
    let startY = 0;
    const onStart = (e: TouchEvent) => {
      startX = e.touches[0]?.clientX ?? 0;
      startY = e.touches[0]?.clientY ?? 0;
    };
    // Can anything from the target up to the page scroll in this direction?
    // A finger moving down (dy > 0) scrolls content up, towards its top.
    const canScroll = (from: EventTarget | null, dy: number) => {
      const can = (top: number, height: number, view: number) =>
        height > view + 1 && (dy > 0 ? top > 0 : top + view < height - 1);
      for (let el = from instanceof Element ? from : null; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
        const { overflowY } = getComputedStyle(el);
        if ((overflowY === 'auto' || overflowY === 'scroll') && can(el.scrollTop, el.scrollHeight, el.clientHeight)) return true;
      }
      const root = document.scrollingElement ?? document.documentElement;
      return can(root.scrollTop, root.scrollHeight, window.innerHeight);
    };
    const onMove = (e: TouchEvent) => {
      if (e.touches.length !== 1 || !e.cancelable) return;
      const t = e.touches[0]!;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (dy === 0 || Math.abs(dx) > Math.abs(dy)) return;
      if (!canScroll(e.target, dy)) e.preventDefault();
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      els.forEach((el, i) => { el.style.overscrollBehaviorY = before[i]!; });
    };
  }, [enabled]);
}
