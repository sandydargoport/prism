'use client';

import { useState, useEffect } from 'react';

export type Orientation = 'landscape' | 'portrait';

/**
 * Hook to detect screen orientation.
 * Returns 'landscape' when width > height, 'portrait' otherwise.
 */
export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>('landscape');

  useEffect(() => {
    const checkOrientation = () => {
      const isLandscape = window.innerWidth > window.innerHeight;
      setOrientation(isLandscape ? 'landscape' : 'portrait');
    };

    checkOrientation();
    window.addEventListener('resize', checkOrientation);

    // Also listen for orientation change events on mobile
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  return orientation;
}
