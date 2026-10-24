'use client';

import { useMediaQuery } from './useMediaQuery';

/** Returns true when the primary pointing device is a touchscreen (pointer: coarse). */
export function useIsTouch(): boolean {
  return useMediaQuery('(pointer: coarse)');
}
