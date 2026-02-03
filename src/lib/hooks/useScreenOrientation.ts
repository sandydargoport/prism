'use client';

import { useState, useEffect } from 'react';

export type ScreenOrientation = 'portrait' | 'landscape';

export function useScreenOrientation(): ScreenOrientation {
  const [orientation, setOrientation] = useState<ScreenOrientation>(() => {
    if (typeof window === 'undefined') return 'landscape';
    return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
  });

  useEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)');
    const handler = (e: MediaQueryListEvent) => {
      setOrientation(e.matches ? 'portrait' : 'landscape');
    };
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return orientation;
}
