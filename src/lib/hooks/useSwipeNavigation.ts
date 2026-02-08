'use client';

import { useRef, useEffect, useCallback } from 'react';

interface SwipeNavigationOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
  enabled?: boolean;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
}

export function useSwipeNavigation<T extends HTMLElement = HTMLDivElement>({
  onSwipeLeft,
  onSwipeRight,
  threshold = 50,
  enabled = true,
}: SwipeNavigationOptions) {
  const containerRef = useRef<T>(null);
  const touchState = useRef<TouchState | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    const touch = e.touches[0];
    if (!touch) return;

    touchState.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTime: Date.now(),
    };
  }, [enabled]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!enabled || !touchState.current) return;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchState.current.startX;
    const deltaY = touch.clientY - touchState.current.startY;
    const deltaTime = Date.now() - touchState.current.startTime;

    // Ignore if:
    // - Swipe took too long (> 500ms) - probably scrolling
    // - Vertical movement is greater than horizontal (scrolling)
    // - Horizontal movement is less than threshold
    if (deltaTime > 500) {
      touchState.current = null;
      return;
    }

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      touchState.current = null;
      return;
    }

    if (Math.abs(deltaX) < threshold) {
      touchState.current = null;
      return;
    }

    // Swipe detected
    if (deltaX > 0 && onSwipeRight) {
      onSwipeRight();
    } else if (deltaX < 0 && onSwipeLeft) {
      onSwipeLeft();
    }

    touchState.current = null;
  }, [enabled, threshold, onSwipeLeft, onSwipeRight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchEnd]);

  return containerRef;
}
