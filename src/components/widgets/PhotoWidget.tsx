'use client';

import * as React from 'react';
import { ImageIcon } from 'lucide-react';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { SlideshowCore } from '@/components/photos/SlideshowCore';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { PHOTO_SLIDESHOW_INTERVAL_DEFAULT } from '@/lib/constants';

export interface PhotoWidgetProps {
  className?: string;
}

export function PhotoWidget({ className }: PhotoWidgetProps) {
  const { photos, loading, error } = usePhotos({
    sort: 'random',
    limit: 50,
  });

  return (
    <WidgetContainer
      loading={loading}
      error={error}
      showHeader={false}
      className={className}
    >
      {photos.length === 0 ? (
        <WidgetEmpty
          icon={<ImageIcon className="h-8 w-8" />}
          message="No photos yet"
        />
      ) : (
        <SlideshowCore
          photos={photos}
          interval={PHOTO_SLIDESHOW_INTERVAL_DEFAULT}
          transition="fade"
          className=""
        />
      )}
    </WidgetContainer>
  );
}
