'use client';

/**
 * The wall's focal-point pass (#956). Every few minutes it takes a few photos
 * that have no focal point yet, draws each one's thumbnail small, finds the
 * point and stores it. New uploads and newly synced photos get theirs within
 * minutes; an existing library fills in a few at a time. Nothing leaves the
 * install: the thumbnail comes from this server and the maths runs here.
 */
import { useEffect } from 'react';
import { focalPoint, FOCAL_SAMPLE_PX, type FocalPoint } from './focalPoint';

export const FOCAL_PASS = {
  /** Photos per pass. */
  batch: 3,
  /** First pass after the wall settles, then every few minutes. */
  firstDelayMs: 30_000,
  everyMs: 3 * 60_000,
} as const;

export interface FocalPassDeps {
  /** Photos still without a focal point. */
  list: () => Promise<Array<{ id: string }>>;
  /** The focal point of one photo, or null if it could not be read. */
  measure: (id: string) => Promise<FocalPoint | null>;
  /** Store it; false when the server refused. */
  store: (id: string, p: FocalPoint) => Promise<boolean>;
}

/** One pass; returns how many points were stored. */
export async function runFocalPass(deps: FocalPassDeps): Promise<number> {
  let stored = 0;
  const todo = (await deps.list().catch(() => [])).slice(0, FOCAL_PASS.batch);
  for (const photo of todo) {
    const p = await deps.measure(photo.id).catch(() => null);
    if (!p) continue;
    if (await deps.store(photo.id, p).catch(() => false)) stored++;
  }
  return stored;
}

/** Draw a photo's thumbnail at the sample size and find its focal point. */
async function measureInBrowser(id: string): Promise<FocalPoint | null> {
  const img = new Image();
  img.src = `/api/photos/${id}/file?thumb=1`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = FOCAL_SAMPLE_PX;
  canvas.height = FOCAL_SAMPLE_PX;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  // Stretched to a square: the point is a fraction of each side, so the
  // stretch does not move it.
  ctx.drawImage(img, 0, 0, FOCAL_SAMPLE_PX, FOCAL_SAMPLE_PX);
  const { data } = ctx.getImageData(0, 0, FOCAL_SAMPLE_PX, FOCAL_SAMPLE_PX);
  return focalPoint(data, FOCAL_SAMPLE_PX, FOCAL_SAMPLE_PX);
}

const browserDeps: FocalPassDeps = {
  list: async () => {
    const res = await fetch(`/api/photos?missingFocal=true&sort=random&limit=${FOCAL_PASS.batch}`);
    if (!res.ok) return [];
    return ((await res.json()) as { photos?: Array<{ id: string }> }).photos ?? [];
  },
  measure: measureInBrowser,
  store: async (id, p) => {
    const res = await fetch(`/api/photos/${id}/focal`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-Prism-Background': '1' },
      body: JSON.stringify({ x: p.x, y: p.y }),
    });
    return res.ok;
  },
};

/** Run the pass on this screen while `on` (the wallpaper is showing). */
export function useFocalPointPass(on: boolean) {
  useEffect(() => {
    if (!on) return;
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;
    const tick = async () => {
      await runFocalPass(browserDeps);
      if (!stopped) timer = setTimeout(tick, FOCAL_PASS.everyMs);
    };
    timer = setTimeout(tick, FOCAL_PASS.firstDelayMs);
    return () => { stopped = true; clearTimeout(timer); };
  }, [on]);
}
