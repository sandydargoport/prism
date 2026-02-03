'use client';

import * as React from 'react';
import type { Photo } from '@/lib/hooks/usePhotos';
import { getResolutionQuality } from '@/lib/hooks/usePhotos';

interface PhotoGalleryProps {
  photos: Photo[];
  loading: boolean;
  onPhotoClick: (index: number) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

function usageBadge(usage: Photo['usage']): string {
  switch (usage) {
    case 'wallpaper': return 'W';
    case 'gallery': return 'G';
    case 'screensaver': return 'S';
    case 'all': return 'A';
    case 'none': return '—';
    default: return '—';
  }
}

const qualityColors = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' };

export function PhotoGallery({
  photos,
  loading,
  onPhotoClick,
  onLoadMore,
  hasMore,
}: PhotoGalleryProps) {
  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted"
            onClick={() => onPhotoClick(index)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${photo.id}/file?thumb=true`}
              alt={photo.originalFilename}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />
            {/* Resolution quality dot */}
            <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${qualityColors[getResolutionQuality(photo.width, photo.height)]} ring-1 ring-black/30`} />
            {/* Usage badge */}
            <span className="absolute bottom-1.5 left-1.5 px-1 py-0.5 text-[10px] font-bold leading-none rounded bg-black/50 text-white/80">
              {usageBadge(photo.usage)}
            </span>
          </div>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      )}

      {hasMore && !loading && onLoadMore && (
        <div className="flex justify-center py-6">
          <button
            onClick={onLoadMore}
            className="px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
