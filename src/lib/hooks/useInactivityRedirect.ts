'use client';

import { useEffect, useRef, useEffectEvent } from 'react';
import { useRouter } from 'next/navigation';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes

function isDashboard(path: string) {
  return path === '/' || path.startsWith('/d/');
}

/**
 * Redirects to the dashboard (/) after 5 minutes of user inactivity.
 * Only applies when the user is not already on a dashboard page.
 *
 * Deliberately avoids usePathname() to prevent adding a second pathname
 * subscription to AppShell (useAutoHideUI already has one), which would
 * cause double re-renders on every navigation on slow devices.
 */
export function useInactivityRedirect() {
  const router = useRouter();
  const goHome = useEffectEvent(() => router.push('/'));

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // Read pathname at fire time — no subscription needed
        if (!isDashboard(window.location.pathname)) {
          goHome();
        }
      }, INACTIVITY_TIMEOUT);
    }

    const events = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const;
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);
}
