'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import type { Photo } from '@/lib/hooks/usePhotos';
import { getResolutionQuality } from '@/lib/hooks/usePhotos';
import { cn } from '@/lib/utils';
import { PageLoader } from '@/components/ui/spinner';

interface PhotoGalleryProps {
  photos: Photo[];
  loading: boolean;
  onPhotoClick: (index: number) => void;
  onLoadMore?: () => void;
  hasMore?: boolean;
  /** When true, tiles toggle selection instead of opening the lightbox. */
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

function usageBadge(usage: Photo['usage']): string {
  if (!usage) return '—';
  const tags = usage.split(',').filter(Boolean);
  if (tags.length === 0) return '—';

  // Build badge from first letter of each tag
  const letters: string[] = [];
  if (tags.includes('wallpaper')) letters.push('W');
  if (tags.includes('gallery')) letters.push('G');
  if (tags.includes('screensaver')) letters.push('S');

  return letters.length > 0 ? letters.join('') : '—';
}

const qualityColors = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' };

function orientationBadge(width: number | null, height: number | null): string {
  if (!width || !height) return '?';
  if (width > height) return 'L';
  if (height > width) return 'P';
  return 'S'; // square
}

export function PhotoGallery({
  photos,
  loading,
  onPhotoClick,
  onLoadMore,
  hasMore,
  selectMode = false,
  selectedIds,
  onToggleSelect,
}: PhotoGalleryProps) {
  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {photos.map((photo, index) => {
          const selected = !!selectedIds?.has(photo.id);
          return (
          <div
            key={photo.id}
            className={cn(
              'group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-muted',
              selectMode && selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
            )}
            onClick={() =>
              selectMode ? onToggleSelect?.(photo.id) : onPhotoClick(index)
            }
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/photos/${photo.id}/file?thumb=true`}
              alt={photo.originalFilename}
              className={cn(
                'h-full w-full object-cover transition-transform group-hover:scale-105',
                selectMode && selected && 'opacity-80',
              )}
              loading="lazy"
            />
            {/* Selection checkbox (select mode only) */}
            {selectMode && (
              <span
                className={cn(
                  'absolute top-1.5 left-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                  selected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-white/80 bg-black/30',
                )}
              >
                {selected && <Check className="h-4 w-4" />}
              </span>
            )}
            {/* Resolution quality dot */}
            <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${qualityColors[getResolutionQuality(photo.width, photo.height)]} ring-1 ring-black/30`} />
            {/* Usage badge */}
            <span className="absolute bottom-1.5 left-1.5 px-1 py-0.5 text-[10px] font-bold leading-none rounded bg-black/50 text-white/80">
              {usageBadge(photo.usage)}
            </span>
            {/* Orientation badge */}
            <span className="absolute bottom-1.5 right-1.5 px-1 py-0.5 text-[10px] font-bold leading-none rounded bg-black/50 text-white/80">
              {orientationBadge(photo.width, photo.height)}
            </span>
          </div>
          );
        })}
      </div>

      {loading && <PageLoader className="py-8" />}

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
