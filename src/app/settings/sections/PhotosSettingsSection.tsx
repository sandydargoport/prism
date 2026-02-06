'use client';

import * as React from 'react';
import { Plus, RefreshCw, Trash2, Cloud, HardDrive, Pin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useDisplayContextFilters, useTargetResolution } from '../SettingsView';
import { usePinnedPhoto } from '@/components/layout/WallpaperBackground';
import { usePhotos } from '@/lib/hooks/usePhotos';

interface PhotoSource {
  id: string;
  type: 'local' | 'onedrive';
  name: string;
  onedriveFolderId: string | null;
  enabled: boolean;
  lastSynced: string | null;
  photoCount: number;
}

export function PhotosSettingsSection() {
  const [sources, setSources] = React.useState<PhotoSource[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState<string | null>(null);

  const fetchSources = React.useCallback(async () => {
    try {
      const res = await fetch('/api/photo-sources');
      const data = await res.json();
      setSources(data.sources || []);
    } catch (err) {
      console.error('Error fetching photo sources:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  const handleSync = async (sourceId: string) => {
    setSyncing(sourceId);
    try {
      await fetch(`/api/photo-sources/${sourceId}/sync`, { method: 'POST' });
      await fetchSources();
    } catch (err) {
      console.error('Sync error:', err);
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!confirm('Delete this source and all its photos?')) return;
    try {
      await fetch(`/api/photo-sources/${sourceId}`, { method: 'DELETE' });
      await fetchSources();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const connectOneDrive = () => {
    window.location.href = '/api/auth/microsoft';
  };

  const { filters, setFilters } = useDisplayContextFilters();
  const { resolution, setResolution, screenSize } = useTargetResolution();

  type DisplayContextKey = keyof typeof filters;

  const toggleOrientation = (context: DisplayContextKey, orientation: 'landscape' | 'portrait' | 'square') => {
    const current = filters[context].orientation;
    const updated = current.includes(orientation)
      ? current.filter((o) => o !== orientation)
      : [...current, orientation];
    setFilters({ ...filters, [context]: { ...filters[context], orientation: updated } });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Photos</h2>
        <p className="text-muted-foreground">
          Manage photo sources, display contexts, and resolution settings
        </p>
      </div>

      <PinnedPhotosCard />

      <Card>
        <CardHeader>
          <CardTitle>Target Resolution</CardTitle>
          <CardDescription>
            Photos below this resolution will show a quality warning
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Input
              type="number"
              value={resolution.width}
              onChange={(e) => setResolution({ ...resolution, width: parseInt(e.target.value) || 1920 })}
              className="w-24 text-sm"
            />
            <span className="text-muted-foreground">x</span>
            <Input
              type="number"
              value={resolution.height}
              onChange={(e) => setResolution({ ...resolution, height: parseInt(e.target.value) || 1080 })}
              className="w-24 text-sm"
            />
            <span className="text-xs text-muted-foreground ml-2">
              Screen: {screenSize.width}x{screenSize.height}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> &ge; target</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> &ge; 75%</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> &lt; 75%</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Display Context Filters</CardTitle>
          <CardDescription>
            Choose which photo orientations are allowed in each display context
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(['gallery', 'wallpaper', 'screensaver'] as const).map((ctx) => (
            <div key={ctx} className="space-y-2">
              <span className="text-sm font-medium capitalize">{ctx}</span>
              <div className="flex gap-2">
                {(['landscape', 'portrait', 'square'] as const).map((ori) => {
                  const active = filters[ctx].orientation.includes(ori);
                  return (
                    <button
                      key={ori}
                      onClick={() => toggleOrientation(ctx, ori)}
                      className={cn(
                        'px-3 py-1 rounded text-xs font-medium border transition-colors',
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border text-muted-foreground hover:bg-accent'
                      )}
                    >
                      {ori}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Photo Sources</CardTitle>
              <CardDescription>
                Manage where your photos come from
              </CardDescription>
            </div>
            <Button onClick={connectOneDrive} size="sm" variant="outline" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Add Source
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <div className="h-12 bg-muted animate-pulse rounded" />
              <div className="h-12 bg-muted animate-pulse rounded" />
            </div>
          ) : sources.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No photo sources configured yet. Click &quot;Add Source&quot; to connect OneDrive.
            </p>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <div key={source.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    {source.type === 'onedrive' ? (
                      <Cloud className="h-5 w-5 text-blue-500" />
                    ) : (
                      <HardDrive className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium text-sm">{source.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {source.photoCount} photos
                        {source.lastSynced && (
                          <> &middot; Synced {new Date(source.lastSynced).toLocaleDateString()}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {source.type === 'onedrive' && source.onedriveFolderId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSync(source.id)}
                        disabled={syncing === source.id}
                        title="Sync now"
                      >
                        <RefreshCw className={cn('h-4 w-4', syncing === source.id && 'animate-spin')} />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(source.id)}
                      title="Delete source"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PinnedPhotosCard() {
  const { pinnedId: pinnedWallpaper, setPinnedId: setPinnedWallpaper } = usePinnedPhoto('wallpaper');
  const { pinnedId: pinnedScreensaver, setPinnedId: setPinnedScreensaver } = usePinnedPhoto('screensaver');
  const { photos, loading } = usePhotos({ limit: 50 });
  const [selectingFor, setSelectingFor] = React.useState<'wallpaper' | 'screensaver' | null>(null);

  const pinnedWallpaperPhoto = photos.find(p => p.id === pinnedWallpaper);
  const pinnedScreensaverPhoto = photos.find(p => p.id === pinnedScreensaver);

  const handleSelect = (photoId: string) => {
    if (selectingFor === 'wallpaper') {
      setPinnedWallpaper(photoId);
    } else if (selectingFor === 'screensaver') {
      setPinnedScreensaver(photoId);
    }
    setSelectingFor(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Pin className="h-4 w-4" />
          Pinned Photos
        </CardTitle>
        <CardDescription>
          Pin a specific photo instead of random rotation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wallpaper Pin */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Dashboard Wallpaper</span>
            {pinnedWallpaper ? (
              <Button variant="ghost" size="sm" onClick={() => setPinnedWallpaper(null)} className="h-7 gap-1 text-xs">
                <X className="h-3 w-3" /> Clear
              </Button>
            ) : null}
          </div>
          {pinnedWallpaperPhoto ? (
            <div className="flex items-center gap-3 p-2 rounded-md border">
              <div
                className="w-16 h-10 rounded bg-cover bg-center flex-shrink-0"
                style={{ backgroundImage: `url(/api/photos/${pinnedWallpaperPhoto.id}/file)` }}
              />
              <span className="text-sm truncate flex-1">{pinnedWallpaperPhoto.originalFilename}</span>
              <Button variant="outline" size="sm" onClick={() => setSelectingFor('wallpaper')} className="text-xs">
                Change
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setSelectingFor('wallpaper')} className="w-full justify-start gap-2">
              <Pin className="h-4 w-4" />
              Select a photo (uses random rotation)
            </Button>
          )}
        </div>

        {/* Screensaver Pin */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Screensaver Background</span>
            {pinnedScreensaver ? (
              <Button variant="ghost" size="sm" onClick={() => setPinnedScreensaver(null)} className="h-7 gap-1 text-xs">
                <X className="h-3 w-3" /> Clear
              </Button>
            ) : null}
          </div>
          {pinnedScreensaverPhoto ? (
            <div className="flex items-center gap-3 p-2 rounded-md border">
              <div
                className="w-16 h-10 rounded bg-cover bg-center flex-shrink-0"
                style={{ backgroundImage: `url(/api/photos/${pinnedScreensaverPhoto.id}/file)` }}
              />
              <span className="text-sm truncate flex-1">{pinnedScreensaverPhoto.originalFilename}</span>
              <Button variant="outline" size="sm" onClick={() => setSelectingFor('screensaver')} className="text-xs">
                Change
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setSelectingFor('screensaver')} className="w-full justify-start gap-2">
              <Pin className="h-4 w-4" />
              Select a photo (uses random rotation)
            </Button>
          )}
        </div>

        {/* Photo picker modal */}
        {selectingFor && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium">
                Select photo for {selectingFor === 'wallpaper' ? 'wallpaper' : 'screensaver'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setSelectingFor(null)} className="h-7">
                Cancel
              </Button>
            </div>
            {loading ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                Loading photos...
              </div>
            ) : photos.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                No photos available
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto">
                {photos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => handleSelect(photo.id)}
                    className={cn(
                      'aspect-video rounded bg-cover bg-center border-2 transition-all hover:opacity-80',
                      (selectingFor === 'wallpaper' && photo.id === pinnedWallpaper) ||
                      (selectingFor === 'screensaver' && photo.id === pinnedScreensaver)
                        ? 'border-primary ring-2 ring-primary/50'
                        : 'border-transparent hover:border-primary/50'
                    )}
                    style={{ backgroundImage: `url(/api/photos/${photo.id}/file)` }}
                    title={photo.originalFilename}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
