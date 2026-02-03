'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Cloud, HardDrive, RefreshCw, Trash2, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoSource {
  id: string;
  type: 'local' | 'onedrive';
  name: string;
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

export function SourceManager() {
  const [sources, setSources] = useState<PhotoSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [pickingFolder, setPickingFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<OneDriveFolder[]>([]);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch('/api/photo-sources');
      const data = await res.json();
      setSources(data.sources || []);
    } catch (err) {
      console.error('Error fetching sources:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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

  const handlePickFolder = async (sourceId: string) => {
    setPickingFolder(sourceId);
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return;

    try {
      const res = await fetch(`/api/photo-sources/${sourceId}/folders`);
      if (res.ok) {
        const data = await res.json();
        setFolders(data.folders || []);
      }
    } catch {
      // Folder listing endpoint may not exist yet; user can enter ID manually
    }
  };

  const handleSelectFolder = async (sourceId: string, folderId: string) => {
    try {
      await fetch(`/api/photo-sources/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ onedriveFolderId: folderId }),
      });
      setPickingFolder(null);
      setFolders([]);
      await fetchSources();
    } catch (err) {
      console.error('Error setting folder:', err);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Connect OneDrive */}
      <div>
        <a
          href="/api/auth/microsoft"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Cloud className="w-4 h-4" />
          Connect OneDrive
        </a>
      </div>

      {/* Sources list */}
      <div className="space-y-3">
        {sources.map((source) => (
          <div key={source.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              {source.type === 'onedrive' ? (
                <Cloud className="w-5 h-5 text-blue-500" />
              ) : (
                <HardDrive className="w-5 h-5 text-muted-foreground" />
              )}
              <div>
                <p className="font-medium">{source.name}</p>
                <p className="text-xs text-muted-foreground">
                  {source.photoCount} photos
                  {source.lastSynced && (
                    <> &middot; Last synced {new Date(source.lastSynced).toLocaleDateString()}</>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {source.type === 'onedrive' && !source.onedriveFolderId && (
                <button
                  onClick={() => handlePickFolder(source.id)}
                  className="p-2 rounded hover:bg-muted transition-colors"
                  title="Pick folder"
                >
                  <FolderOpen className="w-4 h-4" />
                </button>
              )}
              {source.type === 'onedrive' && source.onedriveFolderId && (
                <button
                  onClick={() => handleSync(source.id)}
                  disabled={syncing === source.id}
                  className="p-2 rounded hover:bg-muted transition-colors"
                  title="Sync now"
                >
                  <RefreshCw className={cn('w-4 h-4', syncing === source.id && 'animate-spin')} />
                </button>
              )}
              <button
                onClick={() => handleDelete(source.id)}
                className="p-2 rounded hover:bg-destructive/10 text-destructive transition-colors"
                title="Delete source"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {sources.length === 0 && (
          <p className="text-center text-muted-foreground py-8">
            No photo sources configured. Upload photos or connect OneDrive.
          </p>
        )}
      </div>

      {/* Folder picker modal (simple inline) */}
      {pickingFolder && folders.length > 0 && (
        <div className="border rounded-lg p-4 bg-card space-y-2">
          <p className="font-medium text-sm">Select a OneDrive folder:</p>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => handleSelectFolder(pickingFolder, f.id)}
              className="block w-full text-left px-3 py-2 rounded hover:bg-muted transition-colors text-sm"
            >
              {f.name}
              {f.folder && <span className="text-muted-foreground ml-2">({f.folder.childCount} items)</span>}
            </button>
          ))}
          <button
            onClick={() => { setPickingFolder(null); setFolders([]); }}
            className="text-xs text-muted-foreground hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
