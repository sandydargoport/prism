'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { ImageIcon, Upload, Star, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePhotos } from '@/lib/hooks/usePhotos';
import type { PhotoOrientation } from '@/lib/hooks/usePhotos';
import { PhotoGallery } from '@/components/photos/PhotoGallery';
import { PhotoUpload } from '@/components/photos/PhotoUpload';
import { PhotoLightbox } from '@/components/photos/PhotoLightbox';
import { SlideshowCore } from '@/components/photos/SlideshowCore';
import { PageWrapper, SubpageHeader, FilterBar, FilterDropdown } from '@/components/layout';
import { useAutoOrientationSetting } from '@/components/layout/WallpaperBackground';
import { useAuth } from '@/components/providers';
import { EmptyState } from '@/components/ui/empty-state';

const ORIENTATION_OPTIONS = [
  { value: 'landscape', label: 'Landscape' },
  { value: 'portrait', label: 'Portrait' },
  { value: 'square', label: 'Square' },
];

const USAGE_OPTIONS = [
  { value: 'wallpaper', label: 'Wallpaper' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'screensaver', label: 'Screensaver' },
];

export function PhotosView() {
  const { requireAuth } = useAuth();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [galleryMode, setGalleryMode] = useState(false);
  const { enabled: autoOrientationEnabled } = useAutoOrientationSetting();

  const handleUploadWithAuth = async () => {
    const user = await requireAuth('Upload Photo', 'Please log in to upload photos');
    if (!user) return;
    setShowUpload(!showUpload);
  };

  // Filter state
  const [orientationFilters, setOrientationFilters] = useState<Set<string>>(new Set());
  const [usageFilters, setUsageFilters] = useState<Set<string>>(new Set());
  const [favoriteFilter, setFavoriteFilter] = useState<boolean | undefined>(undefined);

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
        return tags.some((t) => usageFilters.has(t));
      });
    }
    return filtered;
  }, [rawPhotos, orientationFilters, usageFilters]);

  const hasActiveFilters = orientationFilters.size > 0 || usageFilters.size > 0 || !!favoriteFilter;

  const clearFilters = () => {
    setOrientationFilters(new Set());
    setUsageFilters(new Set());
    setFavoriteFilter(undefined);
  };

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
        <SubpageHeader
          icon={<ImageIcon className="h-5 w-5 text-primary" />}
          title="Photos"
          badge={total > 0 ? <Badge variant="secondary">{total}</Badge> : undefined}
          actions={<>
            <Button variant="outline" size="sm" onClick={() => setGalleryMode(true)} disabled={photos.length === 0}>
              <Play className="h-4 w-4 mr-1" />
              Gallery
            </Button>
            <Button size="sm" onClick={handleUploadWithAuth}>
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
          </>}
        />

        <FilterBar>
          <FilterDropdown
            label="Orientation"
            options={ORIENTATION_OPTIONS}
            selected={orientationFilters}
            onSelectionChange={setOrientationFilters}
            mode="multi"
          />
          <FilterDropdown
            label="Usage"
            options={USAGE_OPTIONS}
            selected={usageFilters}
            onSelectionChange={setUsageFilters}
            mode="multi"
          />
          <Button
            variant={favoriteFilter ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setFavoriteFilter(favoriteFilter ? undefined : true)}
            className="h-8 gap-1 shrink-0"
          >
            <Star className="h-3.5 w-3.5" />
            Favorites
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 text-muted-foreground h-8">
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </FilterBar>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {showUpload && (
            <PhotoUpload onUploadComplete={() => { refresh(); setShowUpload(false); }} />
          )}

          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}

          {photos.length === 0 && !loading ? (
            <EmptyState
              icon={<ImageIcon />}
              title="No photos yet"
              description="Add photos, or connect OneDrive in Settings."
              action={<Button variant="outline" size="sm" onClick={handleUploadWithAuth}>Add your first photo</Button>}
              className="py-20"
            />
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

      {galleryMode && photos.length > 0 && (
        <div
          className="fixed inset-0 z-[9999] bg-black cursor-pointer"
          onClick={() => setGalleryMode(false)}
        >
          <SlideshowCore photos={photos} interval={10} transition="fade" />
        </div>
      )}

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
