'use client';

import dynamic from 'next/dynamic';
import { useIdleLogout } from '@/lib/hooks/useIdleLogout';

const Screensaver = dynamic(
  () => import('@/components/screensaver/Screensaver').then(m => ({ default: m.Screensaver })),
  { ssr: false }
);
const AwayModeOverlay = dynamic(
  () => import('@/components/away-mode/AwayModeOverlay').then(m => ({ default: m.AwayModeOverlay })),
  { ssr: false }
);
const BabysitterModeOverlay = dynamic(
  () => import('@/components/babysitter-mode/BabysitterModeOverlay').then(m => ({ default: m.BabysitterModeOverlay })),
  { ssr: false }
);

export function LazyOverlays() {
  // Mounted here because this component is already in the root layout, so the
  // check runs on every page rather than only on the dashboard.
  useIdleLogout();

  return (
    <>
      <BabysitterModeOverlay />
      <AwayModeOverlay />
      <Screensaver />
    </>
  );
}
