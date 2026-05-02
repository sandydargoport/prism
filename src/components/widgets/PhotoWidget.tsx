'use client';

import * as React from 'react';
import { ImageIcon } from 'lucide-react';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { SlideshowCore } from '@/components/photos/SlideshowCore';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';
import { PHOTO_SLIDESHOW_INTERVAL_DEFAULT } from '@/lib/constants';

export interface PhotoWidgetProps {
  className?: string;
}

export const PhotoWidget = React.memo(function PhotoWidget({ className }: PhotoWidgetProps) {
  const { enabled: perfMode } = usePerformanceMode();
  const { photos, loading, error } = usePhotos({
    sort: 'random',
    limit: perfMode ? 1 : 50,
  });

  const isEmpty = photos.length === 0;
  const firstPhoto = photos[0];

  return (
    <WidgetContainer
      widgetType="Photo"
      loading={loading}
      error={error}
      showHeader={false}
      className={className}
    >
      {isEmpty ? (
        <WidgetEmpty
          icon={<ImageIcon className="h-8 w-8" />}
          message="No photos yet"
        />
      ) : perfMode && firstPhoto ? (
        <div className="relative w-full h-full overflow-hidden rounded">
          <img
            src={`/api/photos/${firstPhoto.id}/file?thumb=1`}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
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
});
