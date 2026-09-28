'use client';

import { useEffect, useState } from 'react';
import { Image as ImageIcon, MapPin, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { floatingUtcToDateKey } from '@/lib/utils/zonedDate';

/**
 * The day a photo was taken, for its label. takenAt is the camera's clock
 * time written as UTC, so its date is the UTC one; read on the local clock
 * it moved an evening photo to the next day east of UTC and a morning one to
 * the previous day west of it.
 */
function takenDate(takenAt: string): Date {
  return parseISO(floatingUtcToDateKey(new Date(takenAt)));
}
import { cn } from '@/lib/utils';

interface NearbyPhoto {
  id: string;
  thumbnailPath: string | null;
  takenAt: string | null;
  latitude: number;
  longitude: number;
  width: number | null;
  height: number | null;
}

interface PinPhotoGridProps {
  pinId: string;
  radiusKm?: number;
}

export function PinPhotoGrid({ pinId, radiusKm }: PinPhotoGridProps) {
  const [photos, setPhotos] = useState<NearbyPhoto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightbox, setLightbox] = useState<NearbyPhoto | null>(null);

  const fetchPhotos = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/travel/pins/${pinId}/nearby-photos?limit=24`);
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      setPhotos(data.photos ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [pinId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="rounded-lg border border-border p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Loading nearby photos…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
        Could not load photos.
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-border p-3 text-center">
        <ImageIcon className="h-5 w-5 mx-auto mb-1 text-muted-foreground/50" />
        <p className="text-xs text-muted-foreground">
          No geotagged photos within {radiusKm ?? 50} km
        </p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
          Photos with GPS data sync from OneDrive automatically
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
            <MapPin className="h-3 w-3 text-muted-foreground" />
            Nearby Photos
            <span className="font-normal text-muted-foreground normal-case tracking-normal">
              ({total} within {radiusKm ?? 50} km)
            </span>
          </p>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {photos.map((photo) => (
            <button
              key={photo.id}
              onClick={() => setLightbox(photo)}
              className="relative aspect-square rounded overflow-hidden bg-muted hover:opacity-90 transition-opacity focus-visible:ring-2 focus-visible:ring-primary"
              title={photo.takenAt ? format(takenDate(photo.takenAt), 'MMM d, yyyy') : undefined}
            >
              {photo.thumbnailPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/photos/${photo.id}/file?thumb=1`}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-muted-foreground/40" />
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Simple lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="max-w-2xl max-h-full flex flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${lightbox.id}/file`}
              alt=""
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />
            <div className="text-white/80 text-xs text-center">
              {lightbox.takenAt && format(takenDate(lightbox.takenAt), 'MMMM d, yyyy')}
              {' · '}
              {lightbox.latitude.toFixed(4)}, {lightbox.longitude.toFixed(4)}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
