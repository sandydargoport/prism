'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { ImageIcon, Upload, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhotos } from '@/lib/hooks/usePhotos';
import type { PhotoOrientation } from '@/lib/hooks/usePhotos';
import { PhotoGallery } from '@/components/photos/PhotoGallery';
import { PhotoUpload } from '@/components/photos/PhotoUpload';
import { PhotoLightbox } from '@/components/photos/PhotoLightbox';
import { PageWrapper } from '@/components/layout';
import { useAutoOrientationSetting } from '@/components/layout/WallpaperBackground';
import { useAuth } from '@/components/providers';

export function PhotosView() {
  const { requireAuth } = useAuth();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const { enabled: autoOrientationEnabled } = useAutoOrientationSetting();

  const handleUploadWithAuth = async () => {
    const user = await requireAuth('Upload Photo', 'Please log in to upload photos');
    if (!user) return;
    setShowUpload(!showUpload);
  };

  // Filter state — multi-select for orientation and usage
  const [orientationFilters, setOrientationFilters] = useState<Set<PhotoOrientation>>(new Set());
  const [usageFilters, setUsageFilters] = useState<Set<'wallpaper' | 'gallery' | 'screensaver'>>(new Set());
  const [favoriteFilter, setFavoriteFilter] = useState<boolean | undefined>(undefined);

  const toggleOrientation = (ori: PhotoOrientation) => {
    setOrientationFilters((prev) => {
      const next = new Set(prev);
      if (next.has(ori)) next.delete(ori); else next.add(ori);
      return next;
    });
  };

  const toggleUsage = (u: 'wallpaper' | 'gallery' | 'screensaver') => {
    setUsageFilters((prev) => {
      const next = new Set(prev);
      if (next.has(u)) next.delete(u); else next.add(u);
      return next;
    });
  };

  const { photos: rawPhotos, loading, error, total, refresh, loadMore, updateUsage } =
    usePhotos({
      sort: 'chronological',
      limit: 50,
      favorite: favoriteFilter,
    });

  // Client-side multi-select filtering
  const photos = React.useMemo(() => {
    let filtered = rawPhotos;
    if (orientationFilters.size > 0) {
      filtered = filtered.filter((p) => p.orientation && orientationFilters.has(p.orientation));
    }
    if (usageFilters.size > 0) {
      filtered = filtered.filter((p) => {
        const tags = p.usage.split(',');
        return tags.some((t) => usageFilters.has(t as 'wallpaper' | 'gallery' | 'screensaver'));
      });
    }
    return filtered;
  }, [rawPhotos, orientationFilters, usageFilters]);

  const handleDelete = useCallback(async (photoId: string) => {
    try {
      await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
      refresh();
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  }, [refresh]);

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Photos</h1>
              {total > 0 && (
                <span className="text-sm text-muted-foreground">({total})</span>
              )}
            </div>
            <button
              onClick={handleUploadWithAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload
            </button>
          </div>
        </header>

        {/* Filter Chips */}
        <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground mr-1">Orientation:</span>
            {(['landscape', 'portrait', 'square'] as const).map((ori) => (
              <button
                key={ori}
                onClick={() => toggleOrientation(ori)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-full border transition-colors capitalize',
                  orientationFilters.has(ori)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent/50'
                )}
              >
                {ori}
              </button>
            ))}

            <span className="text-xs text-muted-foreground ml-3 mr-1">Usage:</span>
            {(['wallpaper', 'gallery', 'screensaver'] as const).map((u) => (
              <button
                key={u}
                onClick={() => toggleUsage(u)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-full border transition-colors capitalize',
                  usageFilters.has(u)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-accent/50'
                )}
              >
                {u}
              </button>
            ))}

            <button
              onClick={() => setFavoriteFilter(favoriteFilter ? undefined : true)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-full border transition-colors flex items-center gap-1 ml-3',
                favoriteFilter
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-accent/50'
              )}
            >
              <Star className="h-3 w-3" />
              Favorites
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Upload zone (collapsible) */}
          {showUpload && (
            <PhotoUpload onUploadComplete={() => { refresh(); setShowUpload(false); }} />
          )}

          {/* Gallery */}
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          {photos.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-lg font-medium">No photos yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click Upload to add photos, or connect OneDrive in Settings.
              </p>
            </div>
          ) : (
            <PhotoGallery
              photos={photos}
              loading={loading}
              onPhotoClick={(i) => setLightboxIndex(i)}
              onLoadMore={loadMore}
              hasMore={photos.length < total}
            />
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
          onDelete={handleDelete}
          onUpdateUsage={updateUsage}
          autoOrientationEnabled={autoOrientationEnabled}
        />
      )}
    </PageWrapper>
  );
}
