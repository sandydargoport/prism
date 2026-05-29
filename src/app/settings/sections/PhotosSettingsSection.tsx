'use client';

import * as React from 'react';
import { Plus, RefreshCw, Trash2, Cloud, HardDrive, Pin, X, FolderOpen, MapPin, ChevronRight, ChevronUp, ChevronDown, Image as ImageIcon } from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useDisplayContextFilters, useTargetResolution } from '../SettingsView';
import { usePinnedPhoto } from '@/components/layout/WallpaperBackground';
import { usePhotos } from '@/lib/hooks/usePhotos';
import { toast } from '@/components/ui/use-toast';

interface PhotoSource {
  id: string;
  type: 'local' | 'onedrive' | 'immich' | 'icloud_shared';
  name: string;
  priority: number;
  onedriveFolderId: string | null;
  enabled: boolean;
  lastSynced: string | null;
  photoCount: number;
}

interface OneDriveFolder {
  id: string;
  name: string;
  folder?: { childCount: number };
}

export function PhotosSettingsSection() {
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();
  const [sources, setSources] = React.useState<PhotoSource[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState<string | null>(null);
  const [backfillingGps, setBackfillingGps] = React.useState(false);
  const [pickingFolder, setPickingFolder] = React.useState<string | null>(null);
  const [folderStack, setFolderStack] = React.useState<{ id: string; name: string }[]>([]);
  const [folders, setFolders] = React.useState<OneDriveFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = React.useState(false);

  const [showImmichForm, setShowImmichForm] = React.useState(false);
  const [immichShareUrl, setImmichShareUrl] = React.useState('');
  const [immichPassword, setImmichPassword] = React.useState('');
  const [immichPasswordRequired, setImmichPasswordRequired] = React.useState(false);
  const [immichSubmitting, setImmichSubmitting] = React.useState(false);
  const [immichError, setImmichError] = React.useState<string | null>(null);

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

  // Auto-open folder picker after OAuth redirect
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const sourceId = params.get('sourceId');
    if (success === 'onedrive_connected' && sourceId) {
      // Clean URL then open picker
      window.history.replaceState({}, '', '/settings?section=photos');
      setPickingFolder(sourceId);
      setFolderStack([]);
    }
  }, []);

  // Load folders whenever picker opens or stack changes
  React.useEffect(() => {
    if (!pickingFolder) return;
    const parentId = folderStack.at(-1)?.id;
    setFoldersLoading(true);
    const url = parentId
      ? `/api/photo-sources/${pickingFolder}/folders?parentId=${parentId}`
      : `/api/photo-sources/${pickingFolder}/folders`;
    fetch(url)
      .then((r) => r.ok ? r.json() : { folders: [] })
      .then((d) => setFolders(d.folders || []))
      .catch(() => setFolders([]))
      .finally(() => setFoldersLoading(false));
  }, [pickingFolder, folderStack]);

  const openFolderPicker = (sourceId: string) => {
    setPickingFolder(sourceId);
    setFolderStack([]);
    setFolders([]);
  };

  const closeFolderPicker = () => {
    setPickingFolder(null);
    setFolderStack([]);
    setFolders([]);
  };

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

  const handleBackfillGps = async () => {
    setBackfillingGps(true);
    try {
      const res = await fetch('/api/photos/backfill-gps', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: 'GPS backfill complete',
          description: `Updated ${data.updated} photo${data.updated !== 1 ? 's' : ''} (${data.skipped} had no GPS data)`,
          variant: 'success',
        });
      } else {
        toast({ title: 'GPS backfill failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'GPS backfill failed', variant: 'destructive' });
    } finally {
      setBackfillingGps(false);
    }
  };

  const handleSelectFolder = async (sourceId: string, folderId: string, folderName: string) => {
    try {
      await fetch(`/api/photo-sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onedriveFolderId: folderId, name: `OneDrive – ${folderName}` }),
      });
      closeFolderPicker();
      await fetchSources();
      handleSync(sourceId);
    } catch (err) {
      console.error('Error setting folder:', err);
    }
  };

  const resetImmichForm = () => {
    setShowImmichForm(false);
    setImmichShareUrl('');
    setImmichPassword('');
    setImmichPasswordRequired(false);
    setImmichError(null);
  };

  const handleConnectImmich = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!immichShareUrl.trim()) {
      setImmichError('Share URL is required');
      return;
    }

    setImmichSubmitting(true);
    setImmichError(null);
    try {
      const res = await fetch('/api/photo-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'immich',
          shareUrl: immichShareUrl.trim(),
          password: immichPassword || undefined,
        }),
      });

      if (res.ok) {
        const created = await res.json().catch(() => null);
        resetImmichForm();
        await fetchSources();
        if (created?.id) {
          handleSync(created.id);
        }
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data.error === 'password_required') {
        setImmichPasswordRequired(true);
        setImmichError('This shared link is password-protected. Enter the password below.');
      } else if (data.error === 'invalid_password') {
        setImmichPasswordRequired(true);
        setImmichError('Incorrect password.');
      } else if (data.error === 'not_found') {
        setImmichError('Shared link not found at that URL.');
      } else {
        setImmichError(data.message || data.error || 'Failed to connect to Immich.');
      }
    } catch (err) {
      setImmichError(err instanceof Error ? err.message : 'Failed to connect to Immich.');
    } finally {
      setImmichSubmitting(false);
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!await confirm('Delete this source?', 'This will delete the source and all its photos.')) return;
    try {
      await fetch(`/api/photo-sources/${sourceId}`, { method: 'DELETE' });
      await fetchSources();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Move a source up/down the dedup priority order. When the same photo
  // exists in multiple sources, the one nearer the top of this list wins.
  // We swap the two sources' priority values and persist both, then refetch.
  const handleReorder = async (sourceId: string, direction: 'up' | 'down') => {
    const idx = sources.findIndex((s) => s.id === sourceId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sources.length) return;

    const a = sources[idx];
    const b = sources[swapIdx];
    if (!a || !b) return;
    // If priorities are equal (e.g. legacy rows all at default 100),
    // synthesize a gap so the swap is meaningful.
    const aPrio = a.priority;
    const bPrio = b.priority === aPrio ? aPrio + (direction === 'up' ? -1 : 1) : b.priority;

    // Optimistic local reorder for snappy UI; refetch reconciles.
    setSources((prev) => {
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx]!, next[idx]!];
      return next;
    });

    try {
      await Promise.all([
        fetch(`/api/photo-sources/${a.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: bPrio }),
        }),
        fetch(`/api/photo-sources/${b.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ priority: aPrio }),
        }),
      ]);
      await fetchSources();
    } catch (err) {
      console.error('Reorder error:', err);
      await fetchSources();
    }
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
              <CardDescription>Manage where your photos come from</CardDescription>
            </div>
            <Button
              onClick={handleBackfillGps}
              disabled={backfillingGps}
              size="sm"
              variant="outline"
              className="gap-1.5"
              title="Extract GPS from EXIF on photos that are missing coordinates"
            >
              <MapPin className={cn('h-4 w-4', backfillingGps && 'animate-pulse')} />
              {backfillingGps ? 'Scanning…' : 'Backfill GPS'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <div className="h-14 bg-muted animate-pulse rounded-lg" />
              <div className="h-14 bg-muted animate-pulse rounded-lg" />
            </div>
          ) : (
            <>
              {sources.map((source) => (
                <div key={source.id} className="space-y-0">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3 min-w-0">
                      {source.type === 'onedrive' ? (
                        <Cloud className="h-5 w-5 text-blue-500 shrink-0" />
                      ) : source.type === 'immich' ? (
                        <ImageIcon className="h-5 w-5 text-purple-500 shrink-0" />
                      ) : (
                        <HardDrive className="h-5 w-5 text-muted-foreground shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{source.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {source.photoCount} photos
                          {source.lastSynced && <> · Synced {new Date(source.lastSynced).toLocaleDateString()}</>}
                          {source.type === 'onedrive' && !source.onedriveFolderId && (
                            <span className="text-amber-600 dark:text-amber-400"> · No folder selected</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {/* Dedup priority reorder — only meaningful with 2+
                          sources. Top of the list = preferred when the same
                          photo appears in multiple sources. */}
                      {sources.length > 1 && (
                        <div className="flex flex-col mr-1">
                          <button
                            type="button"
                            aria-label="Higher priority"
                            title="Prefer this source for duplicate photos"
                            disabled={sources[0]?.id === source.id}
                            onClick={() => handleReorder(source.id, 'up')}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-default leading-none"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Lower priority"
                            title="Prefer other sources for duplicate photos"
                            disabled={sources[sources.length - 1]?.id === source.id}
                            onClick={() => handleReorder(source.id, 'down')}
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-default leading-none"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      {source.type === 'immich' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleSync(source.id)}
                          disabled={syncing === source.id}
                          title="Sync now"
                        >
                          <RefreshCw className={cn('h-4 w-4', syncing === source.id && 'animate-spin')} />
                        </Button>
                      )}
                      {source.type === 'onedrive' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openFolderPicker(source.id)}
                            className="gap-1.5 text-xs h-8"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            {source.onedriveFolderId ? 'Change' : 'Select folder'}
                          </Button>
                          {source.onedriveFolderId && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleSync(source.id)}
                              disabled={syncing === source.id}
                              title="Sync now"
                            >
                              <RefreshCw className={cn('h-4 w-4', syncing === source.id && 'animate-spin')} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { window.location.href = '/api/auth/microsoft'; }}
                            className="text-xs h-8 text-muted-foreground"
                            title="Re-authenticate with Microsoft"
                          >
                            Reconnect
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(source.id)}
                        title="Delete source"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Inline folder browser */}
                  {pickingFolder === source.id && (
                    <div className="border border-t-0 rounded-b-lg bg-muted/20">
                      {/* Breadcrumb bar */}
                      <div className="flex items-center gap-1 px-3 py-2 border-b text-xs text-muted-foreground flex-wrap">
                        <button
                          onClick={() => { setFolderStack([]); }}
                          className="hover:text-foreground font-medium transition-colors"
                        >
                          OneDrive
                        </button>
                        {folderStack.map((f, i) => (
                          <React.Fragment key={f.id}>
                            <ChevronRight className="h-3 w-3 shrink-0" />
                            <button
                              className="hover:text-foreground font-medium transition-colors"
                              onClick={() => setFolderStack(folderStack.slice(0, i + 1))}
                            >
                              {f.name}
                            </button>
                          </React.Fragment>
                        ))}
                      </div>

                      {/* "Use this folder" row — selects the current level */}
                      <div className="px-3 py-2 border-b flex items-center justify-between">
                        <span className="text-xs text-muted-foreground italic">
                          {folderStack.length === 0 ? 'OneDrive root' : folderStack.at(-1)!.name}
                        </span>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            const current = folderStack.at(-1);
                            if (current) {
                              handleSelectFolder(source.id, current.id, current.name);
                            }
                          }}
                          disabled={folderStack.length === 0}
                          title={folderStack.length === 0 ? 'Navigate into a folder first' : 'Use this folder'}
                        >
                          Use this folder
                        </Button>
                      </div>

                      {/* Subfolder list — click to navigate in */}
                      <div className="max-h-56 overflow-y-auto">
                        {foldersLoading ? (
                          <p className="text-xs text-muted-foreground p-3">Loading…</p>
                        ) : folders.length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3">No subfolders</p>
                        ) : (
                          folders.map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setFolderStack((prev) => [...prev, { id: f.id, name: f.name }])}
                              className="flex items-center justify-between w-full px-3 py-2 text-sm hover:bg-muted transition-colors text-left"
                            >
                              <span className="flex items-center gap-2">
                                <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                {f.name}
                              </span>
                              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </button>
                          ))
                        )}
                      </div>

                      <div className="px-3 py-2 border-t">
                        <button onClick={closeFolderPicker} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Connect OneDrive CTA if no OneDrive source exists */}
              {!sources.some((s) => s.type === 'onedrive') && (
                <button
                  onClick={() => { window.location.href = '/api/auth/microsoft'; }}
                  className="flex items-center gap-3 w-full p-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
                >
                  <Cloud className="h-5 w-5 text-blue-500" />
                  Connect OneDrive to sync photos
                </button>
              )}

              {/* Connect Immich CTA — always available, since multiple albums are fine */}
              {!showImmichForm && (
                <button
                  onClick={() => setShowImmichForm(true)}
                  className="flex items-center gap-3 w-full p-3 rounded-lg border border-dashed hover:bg-muted/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
                >
                  <ImageIcon className="h-5 w-5 text-purple-500" />
                  Connect Immich shared album
                </button>
              )}

              {showImmichForm && (
                <form
                  onSubmit={handleConnectImmich}
                  className="rounded-lg border p-4 space-y-3 bg-muted/20"
                >
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <ImageIcon className="h-4 w-4 text-purple-500" />
                    Connect Immich shared album
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" htmlFor="immich-share-url">
                      Shared link URL
                    </label>
                    <Input
                      id="immich-share-url"
                      type="url"
                      required
                      placeholder="https://immich.example.com/share/abc123"
                      value={immichShareUrl}
                      onChange={(e) => setImmichShareUrl(e.target.value)}
                      disabled={immichSubmitting}
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Photos are pulled from the album each time you sync.
                    </p>
                  </div>

                  {immichPasswordRequired && (
                    <div>
                      <label className="block text-xs font-medium mb-1" htmlFor="immich-password">
                        Password
                      </label>
                      <Input
                        id="immich-password"
                        type="password"
                        value={immichPassword}
                        onChange={(e) => setImmichPassword(e.target.value)}
                        disabled={immichSubmitting}
                        autoFocus
                        className="text-sm"
                      />
                    </div>
                  )}

                  {immichError && (
                    <p className="text-xs text-destructive">{immichError}</p>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={immichSubmitting}>
                      {immichSubmitting ? 'Connecting…' : 'Connect'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={resetImmichForm}
                      disabled={immichSubmitting}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog {...confirmDialogProps} />
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
