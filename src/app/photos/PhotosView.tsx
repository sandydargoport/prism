'use client';

import * as React from 'react';
import { useState, useCallback } from 'react';
import { ImageIcon, Upload, Star, Play, X, CheckSquare, Trash2 } from 'lucide-react';
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
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/use-toast';

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
  const { confirm, dialogProps } = useConfirmDialog();

  // Multi-select "remove from Prism" mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const handleUploadWithAuth = async () => {
    const user = await requireAuth('Upload Photo', 'Please log in to upload photos');
    if (!user) return;
    setShowUpload(!showUpload);
  };

  // Filter state
  const [orientationFilters, setOrientationFilters] = useState<Set<string>>(new Set());
  const [usageFilters, setUsageFilters] = useState<Set<string>>(new Set());
  const [favoriteFilter, setFavoriteFilter] = useState<boolean | undefined>(undefined);
  const [belowHdFilter, setBelowHdFilter] = useState(false);

  const { photos: rawPhotos, loading, error, total, refresh, loadMore, updateUsage } =
    usePhotos({
      sort: 'chronological',
      limit: 50,
      favorite: favoriteFilter,
      belowHd: belowHdFilter,
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
    // belowHd is applied server-side (usePhotos) so it filters the whole
    // library, not just the loaded page — nothing to do here.
    return filtered;
  }, [rawPhotos, orientationFilters, usageFilters]);

  const hasActiveFilters =
    orientationFilters.size > 0 || usageFilters.size > 0 || !!favoriteFilter || belowHdFilter;

  // Currently-selected photos (for bulk usage toggles' aggregate state)
  const selectedPhotos = React.useMemo(
    () => photos.filter((p) => selectedIds.has(p.id)),
    [photos, selectedIds],
  );
  const allSelectedHaveTag = (tag: string) =>
    selectedPhotos.length > 0 &&
    selectedPhotos.every((p) => p.usage.split(',').includes(tag));

  const clearFilters = () => {
    setOrientationFilters(new Set());
    setUsageFilters(new Set());
    setFavoriteFilter(undefined);
    setBelowHdFilter(false);
  };

  const handleDelete = useCallback(async (photoId: string) => {
    try {
      await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
      refresh();
    } catch (err) {
      console.error('Error deleting photo:', err);
    }
  }, [refresh]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = await confirm(
      `Remove ${ids.length} photo${ids.length === 1 ? '' : 's'} from Prism?`,
      'This removes them from Prism only — your OneDrive/source photos are never touched, and synced photos stay removed instead of re-downloading.',
      { confirmLabel: 'Remove from Prism' },
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/photos/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      toast({
        title: `Removed ${data.deleted ?? ids.length} photo${(data.deleted ?? ids.length) === 1 ? '' : 's'} from Prism`,
        variant: 'success',
      });
      exitSelectMode();
      refresh();
    } catch (err) {
      console.error('Error removing photos:', err);
      toast({ title: 'Failed to remove photos', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, confirm, exitSelectMode, refresh]);

  // Select all — covers the WHOLE filtered library (not just the loaded page)
  // by asking the server for every matching id. Orientation/usage are filtered
  // client-side and can't be expressed in that query, so when either is active
  // we fall back to selecting the currently-loaded photos.
  const [selectingAll, setSelectingAll] = useState(false);
  const handleSelectAll = useCallback(async () => {
    if (selectedIds.size > 0) {
      setSelectedIds(new Set());
      return;
    }
    if (orientationFilters.size > 0 || usageFilters.size > 0) {
      setSelectedIds(new Set(photos.map((p) => p.id)));
      return;
    }
    setSelectingAll(true);
    try {
      const params = new URLSearchParams();
      if (favoriteFilter !== undefined) params.set('favorite', String(favoriteFilter));
      if (belowHdFilter) params.set('belowHd', 'true');
      params.set('idsOnly', 'true');
      const res = await fetch(`/api/photos?${params}`);
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      setSelectedIds(new Set<string>(data.ids ?? []));
    } catch {
      setSelectedIds(new Set(photos.map((p) => p.id)));
    } finally {
      setSelectingAll(false);
    }
  }, [selectedIds, orientationFilters, usageFilters, favoriteFilter, belowHdFilter, photos]);

  const handleBulkUsage = useCallback(
    async (tag: string, action: 'add' | 'remove') => {
      const ids = Array.from(selectedIds);
      if (ids.length === 0) return;
      try {
        const res = await fetch('/api/photos/bulk-usage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, tag, action }),
        });
        if (!res.ok) throw new Error('Request failed');
        refresh();
      } catch (err) {
        console.error('Error updating usage:', err);
        toast({ title: 'Failed to update photos', variant: 'destructive' });
      }
    },
    [selectedIds, refresh],
  );

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <SubpageHeader
          icon={<ImageIcon className="h-5 w-5 text-primary" />}
          title="Photos"
          badge={total > 0 ? <Badge variant="secondary">{total}</Badge> : undefined}
          actions={selectMode ? (
            <Button variant="ghost" size="sm" onClick={exitSelectMode}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectMode(true)} disabled={photos.length === 0}>
                <CheckSquare className="h-4 w-4 mr-1" />
                Select
              </Button>
              <Button variant="outline" size="sm" onClick={() => setGalleryMode(true)} disabled={photos.length === 0}>
                <Play className="h-4 w-4 mr-1" />
                Gallery
              </Button>
              <Button size="sm" onClick={handleUploadWithAuth}>
                <Upload className="h-4 w-4 mr-1" />
                Upload
              </Button>
            </>
          )}
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
          <Button
            variant={belowHdFilter ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setBelowHdFilter((v) => !v)}
            className="h-8 gap-1.5 shrink-0"
            title="Show only photos below 1920×1080 (yellow/red dots) — low-res for HD wallpaper"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 ring-1 ring-black/30" />
            Below HD
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 text-muted-foreground h-8">
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </FilterBar>

        {selectMode && (
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2">
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={handleSelectAll}
              disabled={photos.length === 0 || selectingAll}
            >
              {selectingAll
                ? 'Selecting…'
                : selectedIds.size > 0
                  ? 'Clear all'
                  : `Select all${total > photos.length ? ` (${total})` : ''}`}
            </Button>

            {/* Bulk-toggle W/G/S across the selection */}
            <div className="flex items-center gap-1 border-l pl-2 ml-1">
              <span className="text-xs text-muted-foreground mr-0.5">Show in:</span>
              {USAGE_OPTIONS.map((opt) => {
                const active = allSelectedHaveTag(opt.value);
                return (
                  <Button
                    key={opt.value}
                    variant={active ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-8"
                    disabled={selectedIds.size === 0}
                    onClick={() => handleBulkUsage(opt.value, active ? 'remove' : 'add')}
                    title={`${active ? 'Remove selected from' : 'Add selected to'} ${opt.label}`}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>

            <div className="ml-auto">
              <Button
                variant="destructive"
                size="sm"
                className="h-8"
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? 'Removing…' : 'Remove from Prism'}
              </Button>
            </div>
          </div>
        )}

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
              selectMode={selectMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
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

      <ConfirmDialog {...dialogProps} />
    </PageWrapper>
  );
}
