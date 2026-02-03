'use client';

import * as React from 'react';
import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import type { Photo, PhotoUsageTag } from '@/lib/hooks/usePhotos';
import { getResolutionQuality, parseUsageTags } from '@/lib/hooks/usePhotos';

interface PhotoLightboxProps {
  photos: Photo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  onDelete: (photoId: string) => void;
  onUpdateUsage?: (photoId: string, usage: string) => void;
  autoOrientationEnabled?: boolean;
}

const qualityColors = { green: 'bg-green-500', yellow: 'bg-yellow-500', red: 'bg-red-500' };
const usageTags: { value: PhotoUsageTag; label: string }[] = [
  { value: 'wallpaper', label: 'Wallpaper' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'screensaver', label: 'Screensaver' },
];

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
  onDelete,
  onUpdateUsage,
  autoOrientationEnabled,
}: PhotoLightboxProps) {
  const photo = photos[currentIndex];

  const goNext = useCallback(() => {
    onNavigate((currentIndex + 1) % photos.length);
  }, [currentIndex, photos.length, onNavigate]);

  const goPrev = useCallback(() => {
    onNavigate((currentIndex - 1 + photos.length) % photos.length);
  }, [currentIndex, photos.length, onNavigate]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, goNext, goPrev]);

  if (!photo) return null;

  const quality = getResolutionQuality(photo.width, photo.height);
  const dims = photo.width && photo.height ? `${photo.width}×${photo.height}` : 'Unknown';
  const orient = photo.orientation ?? (photo.width && photo.height
    ? (photo.width > photo.height ? 'landscape' : photo.width < photo.height ? 'portrait' : 'square')
    : null);

  const activeTags = parseUsageTags(photo.usage);

  const toggleTag = (tag: PhotoUsageTag) => {
    if (!onUpdateUsage) return;
    const current = new Set(activeTags);
    if (current.has(tag)) {
      current.delete(tag);
    } else {
      current.add(tag);
    }
    onUpdateUsage(photo.id, Array.from(current).join(','));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center">
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className="absolute left-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white"
          >
            <ChevronLeft className="w-8 h-8" />
          </button>
          <button
            onClick={goNext}
            className="absolute right-4 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 text-white"
          >
            <ChevronRight className="w-8 h-8" />
          </button>
        </>
      )}

      {/* Image */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/photos/${photo.id}/file`}
        alt={photo.originalFilename}
        className="max-w-full max-h-[calc(100vh-100px)] object-contain"
      />

      {/* Bottom bar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2.5">
        <button
          onClick={() => {
            if (confirm('Delete this photo?')) {
              onDelete(photo.id);
              onClose();
            }
          }}
          className="p-1.5 rounded-full hover:bg-white/10 text-white"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* Resolution info */}
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${qualityColors[quality]}`} />
          <span className="text-white/80 text-xs">{dims}</span>
        </div>

        {/* Orientation */}
        {orient && (
          <>
            <div className="w-px h-6 bg-white/20" />
            <span className="text-white/60 text-xs capitalize">{orient}</span>
          </>
        )}

        <div className="w-px h-6 bg-white/20" />

        {/* Usage multi-select chips */}
        {onUpdateUsage && (
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              {usageTags.map((opt) => {
                const active = activeTags.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    onClick={() => toggleTag(opt.value)}
                    className={`px-2 py-0.5 text-xs rounded transition-colors ${
                      active
                        ? autoOrientationEnabled ? 'bg-white/15 text-white/70 font-medium' : 'bg-white/25 text-white font-medium'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {autoOrientationEnabled && (
              <span className="text-[10px] text-white/40">Auto-orientation active</span>
            )}
          </div>
        )}

        <div className="w-px h-6 bg-white/20" />

        <span className="text-white/50 text-xs">
          {currentIndex + 1} / {photos.length}
        </span>
      </div>
    </div>
  );
}
