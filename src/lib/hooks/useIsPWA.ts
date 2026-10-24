'use client';

import { useMediaQuery } from './useMediaQuery';

export function useIsPWA(): boolean {
  return useMediaQuery('(display-mode: standalone)');
}
