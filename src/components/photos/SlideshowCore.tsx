'use client';

import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { Photo } from '@/lib/hooks/usePhotos';
import type { PhotoTransitionType } from '@/lib/constants';

interface SlideshowCoreProps {
  photos: Photo[];
  interval?: number;
  transition?: PhotoTransitionType;
  className?: string;
}

export function SlideshowCore({
  photos,
  interval = 15,
  transition = 'fade',
  className,
}: SlideshowCoreProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [nextIndex, setNextIndex] = useState(1);
  const preloadRef = useRef<HTMLImageElement | null>(null);

  const currentPhoto = photos[currentIndex];
  const nextPhoto = photos[nextIndex];

  // Preload next image
  useEffect(() => {
    if (!nextPhoto) return;
    const img = new window.Image();
    img.src = `/api/photos/${nextPhoto.id}/file`;
    preloadRef.current = img;
  }, [nextPhoto]);

  // Auto-advance
  useEffect(() => {
    if (photos.length <= 1) return;

    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % photos.length);
        setNextIndex((prev) => (prev + 1) % photos.length);
        setIsTransitioning(false);
      }, 800);
    }, interval * 1000);

    return () => clearInterval(timer);
  }, [photos.length, interval]);

  if (photos.length === 0) return null;

  const transitionClasses = {
    fade: isTransitioning ? 'opacity-0' : 'opacity-100',
    slide: isTransitioning ? '-translate-x-full' : 'translate-x-0',
    zoom: isTransitioning ? 'scale-110 opacity-0' : 'scale-100 opacity-100',
  };

  return (
    <div className={cn('relative w-full h-full overflow-hidden rounded-lg', className)}>
      {currentPhoto && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={currentPhoto.id}
          src={`/api/photos/${currentPhoto.id}/file`}
          alt={currentPhoto.originalFilename}
          className={cn(
            'absolute inset-0 w-full h-full object-contain transition-all duration-700',
            transitionClasses[transition]
          )}
        />
      )}
    </div>
  );
}
