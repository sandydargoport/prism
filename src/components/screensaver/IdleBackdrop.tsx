'use client';

import * as React from 'react';
import { PhotoStage } from '@/components/layout/PhotoStage';
import { useAutoOrientationSetting, usePhotoTone, usePinnedPhoto } from '@/components/layout/WallpaperBackground';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { useScreenOrientation } from '@/lib/hooks/useScreenOrientation';
import { waterVars } from '@/lib/design/water';
import type { SkyEclipse } from './nightSky/NightSky';

// Only a canvas that shows the sky loads its star catalogue.
const NightSky = React.lazy(() => import('./nightSky/NightSky').then((m) => ({ default: m.NightSky })));

/**
 * What the photo frame draws over its photo (#799, #929): a light dim, and
 * the shades only where text sits. The wall and the editor's canvas (#1348)
 * both draw this, so the canvas is the wall.
 */
export function PhotoShade() {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 bg-black/25" />
      <div
        className="pointer-events-none absolute inset-0"
        data-screensaver-shade
        style={{ backgroundImage: [
          'radial-gradient(45% 40% at 0% 0%, rgb(0 0 0 / var(--ds-shade-tl, 0.35)), transparent)',
          'radial-gradient(45% 40% at 100% 0%, rgb(0 0 0 / var(--ds-shade-tr, 0.35)), transparent)',
          'linear-gradient(to top, rgb(0 0 0 / var(--ds-shade-bottom, 0.35)), transparent 35%)',
        ].join(', ') }}
      />
    </>
  );
}

/** The photo frame's ink: white by day, warm after dusk (#929). */
export const idleInk = (night: boolean) => (night ? 'rgb(255 226 190)' : 'white');

/**
 * Behind the photo frame's arrangement on the editor's canvas (#1348): the
 * photo the wall would show, or the night sky, at the screen's size, under
 * the widgets being arranged.
 */
export function CanvasBackdrop({ look, lat, lon, eclipse }: {
  look: 'photos' | 'sky';
  lat: number;
  lon: number;
  eclipse?: SkyEclipse;
}) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-black" data-canvas-backdrop={look}>
      {look === 'sky' ? (
        <React.Suspense fallback={null}>
          <NightSky lat={lat} lon={lon} eclipse={eclipse} />
        </React.Suspense>
      ) : <CanvasPhoto />}
    </div>
  );
}

/** The wall's photo: its pinned one, or the first of the photos it rotates through. */
function CanvasPhoto() {
  const { enabled: autoOrientation } = useAutoOrientationSetting();
  const { pinnedId } = usePinnedPhoto('screensaver');
  const screenOrientation = useScreenOrientation();
  const override = typeof window !== 'undefined'
    ? (localStorage.getItem('prism-orientation-override') as 'landscape' | 'portrait' | null) || null
    : null;
  const { photos } = usePhotos({
    sort: 'random',
    limit: 50,
    usage: 'screensaver',
    orientation: autoOrientation ? override || screenOrientation : undefined,
  });
  const src = pinnedId ? `/api/photos/${pinnedId}/file` : photos[0] ? `/api/photos/${photos[0].id}/file` : '';
  const tone = usePhotoTone(src || null);
  return (
    <div className="absolute inset-0" style={waterVars(tone, 0.25) as React.CSSProperties} data-canvas-photo={src || undefined}>
      {src && <PhotoStage src={src} />}
      <PhotoShade />
    </div>
  );
}
