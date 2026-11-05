'use client';

/**
 * The household's photo settings for the wall (#958, #959), read once per
 * page load. The date shows unless turned off; the place and the "On this
 * day" mix only when turned on.
 */
import { useEffect, useState } from 'react';
import { PHOTO_DATE_SETTING, PHOTO_ON_THIS_DAY_SETTING, PHOTO_PLACE_SETTING } from './caption';

export interface PhotoSettings { date: boolean; place: boolean; onThisDay: boolean }

const DEFAULTS: PhotoSettings = { date: true, place: false, onThisDay: false };
let read: Promise<PhotoSettings> | null = null;

function readPhotoSettings(): Promise<PhotoSettings> {
  read ??= fetch('/api/settings')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => ({
      date: d?.settings?.[PHOTO_DATE_SETTING] !== false,
      place: d?.settings?.[PHOTO_PLACE_SETTING] === true,
      onThisDay: d?.settings?.[PHOTO_ON_THIS_DAY_SETTING] === true,
    }))
    .catch(() => DEFAULTS);
  return read;
}

/** null until read. */
export function usePhotoSettings(): PhotoSettings | null {
  const [s, setS] = useState<PhotoSettings | null>(null);
  useEffect(() => { void readPhotoSettings().then(setS); }, []);
  return s;
}
