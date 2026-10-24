'use client';

import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * A ref that always holds the value from the latest committed render.
 *
 * For a function that both effects and event handlers call, and that needs a
 * prop or state value without changing identity when it does. Where only
 * effects read the value, prefer useEffectEvent.
 *
 * Updated in a layout effect rather than during render: writing a ref while
 * rendering is what react-hooks/refs forbids, since a render that React throws
 * away would still have changed it. Layout effects run before every other
 * effect, so an effect reading the ref sees this render's value.
 */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
