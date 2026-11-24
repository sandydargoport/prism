'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { START_AT_END } from '@/lib/utils/startAtNext';
import { useShouldSkipMotion } from './useShouldSkipMotion';

/** How long a list stays where a person left it before it returns. */
export const START_AT_NEXT_QUIET_MS = 30_000;

/**
 * Keeps a widget's own scroll list opened at its next item (#1369, #1370).
 *
 * `anchor` names the element to put at the top of the list, by its
 * `data-scroll-anchor` value (see startAnchor); START_AT_END means the bottom
 * and null the top. The list is moved only inside its own scroll box, never
 * with scrollIntoView: that would move the whole dashboard.
 *
 * - A list that fits never scrolls.
 * - The first placement is instant; later moves (the next item changed while
 *   nobody is touching it) glide, unless motion is reduced.
 * - A touch, click, wheel or key inside the list holds it where the person put
 *   it; it returns to the next item after `quietMs` of no input.
 *
 * Returns a ref callback for the scroll box.
 */
export function useStartAtNext(
  anchor: string | null,
  { quietMs = START_AT_NEXT_QUIET_MS }: { quietMs?: number } = {},
): (el: HTMLElement | null) => void {
  const boxRef = useRef<HTMLElement | null>(null);
  // Bumped when the scroll box mounts or changes, so the effects re-attach.
  const [boxVersion, setBoxVersion] = useState(0);
  const skipMotion = useShouldSkipMotion();
  const lastInput = useRef<number>(-Infinity);
  const placed = useRef(false);
  const anchorRef = useRef(anchor);

  const setBox = useCallback((el: HTMLElement | null) => {
    if (boxRef.current === el) return;
    boxRef.current = el;
    setBoxVersion((v) => v + 1);
  }, []);

  const align = useCallback((smooth: boolean) => {
    const box = boxRef.current;
    if (!box) return;
    if (Date.now() - lastInput.current < quietMs) return;
    const max = Math.max(0, box.scrollHeight - box.clientHeight);
    const a = anchorRef.current;
    let top = 0;
    if (max > 0 && a === START_AT_END) {
      top = max;
    } else if (max > 0 && a) {
      const target = box.querySelector(`[data-scroll-anchor="${CSS.escape(a)}"]`);
      if (target) top = target.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    }
    top = Math.max(0, Math.min(max, Math.round(top)));
    if (Math.abs(box.scrollTop - top) < 1) return;
    if (smooth && !skipMotion && typeof box.scrollTo === 'function') box.scrollTo({ top, behavior: 'smooth' });
    else box.scrollTop = top;
  }, [quietMs, skipMotion]);

  // A new next item (time passed, data arrived): first placement is instant.
  useLayoutEffect(() => {
    anchorRef.current = anchor;
    if (!boxRef.current) return;
    align(placed.current);
    placed.current = true;
  }, [anchor, align, boxVersion]);

  // The list's size changed (rows loaded, fonts, the widget resized).
  useEffect(() => {
    const box = boxRef.current;
    if (!box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => align(false));
    ro.observe(box);
    if (box.firstElementChild) ro.observe(box.firstElementChild);
    return () => ro.disconnect();
  }, [boxVersion, align]);

  // A person is using the list: leave it, and come back after a quiet spell.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onInput = () => {
      lastInput.current = Date.now();
      clearTimeout(timer);
      timer = setTimeout(() => align(true), quietMs + 50);
    };
    const events = ['pointerdown', 'pointerup', 'touchstart', 'touchmove', 'wheel', 'keydown'] as const;
    for (const e of events) box.addEventListener(e, onInput, { passive: true });
    return () => {
      clearTimeout(timer);
      for (const e of events) box.removeEventListener(e, onInput);
    };
  }, [boxVersion, align, quietMs]);

  return setBox;
}
