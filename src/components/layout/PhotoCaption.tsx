'use client';

/**
 * The line on the wallpaper and the screensaver that says when a photo was
 * taken, and where if the household shows places (#958). Small, in the one
 * light ink, in the first corner no widget uses.
 */
import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { captionSpot, captionText, datePhrase, type CaptionSpot } from '@/lib/photos/caption';
import { usePhotoSettings } from '@/lib/photos/usePhotoSettings';
import { coveredRects } from '@/lib/photos/frameDom';

const SPOT_CLASS: Record<CaptionSpot, string> = {
  'bottom-right': 'bottom-[3rem] right-[3rem] text-right',
  'bottom-left': 'bottom-[3rem] left-[3rem]',
  'top-centre': 'top-[2.5rem] left-1/2 -translate-x-1/2 text-center',
  'bottom-centre': 'bottom-[3rem] left-1/2 -translate-x-1/2 text-center',
};

export function PhotoCaption({ photo }: { photo: { id: string; takenAt?: string | null } | null }) {
  const locale = useLocale();
  const opts = usePhotoSettings();
  const [place, setPlace] = useState<{ id: string; name: string | null } | null>(null);
  const [spot, setSpot] = useState<CaptionSpot | null>(null);


  // Keyed on the id: callers may pass a new object each render.
  const id = photo?.id ?? null;
  useEffect(() => {
    if (!id || !opts?.place) return;
    let active = true;
    fetch(`/api/photos/${id}/place`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { place?: string | null } | null) => { if (active) setPlace({ id, name: d?.place ?? null }); })
      .catch(() => {});
    return () => { active = false; };
  }, [id, opts?.place]);

  // Placed once the widgets have drawn, then checked every few seconds, since
  // widgets load and move; with no free corner the line hides.
  useEffect(() => {
    if (!id) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const place = () => setSpot(captionSpot({ width: window.innerWidth, height: window.innerHeight }, coveredRects(), undefined, 3 * rem));
    const first = setTimeout(place, 1500);
    const again = setInterval(place, 5000);
    return () => { clearTimeout(first); clearInterval(again); };
  }, [id]);

  if (!photo || !opts || !spot) return null;
  const date = opts.date ? datePhrase(photo.takenAt ?? null, new Date(), locale) : null;
  const where = opts.place && place?.id === photo.id ? place.name : null;
  const text = captionText(date, where);
  if (!text) return null;

  return (
    <p
      className={`pointer-events-none absolute m-0 max-w-[24rem] text-caption text-white/90 [text-shadow:var(--ds-idle-text-shadow)] ${SPOT_CLASS[spot]}`}
      data-photo-caption={spot}
    >
      {text}
    </p>
  );
}
