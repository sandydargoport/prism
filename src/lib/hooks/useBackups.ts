'use client';

import { useState, useCallback, useEffect } from 'react';

export interface BackupInfo {
  filename: string;
  size: number;
  sizeFormatted: string;
  createdAt: string;
  createdAtFormatted: string;
}

export function useBackups() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/admin/backups');
      if (!res.ok) {
        throw new Error('Failed to fetch backups');
      }
      const data = await res.json();
      setBackups(data.backups || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch backups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  const createBackup = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setCreating(true);
      setError(null);
      const res = await fetch('/api/admin/backups', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create backup');
      }

      await fetchBackups();
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create backup';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setCreating(false);
    }
  }, [fetchBackups]);

  const restoreBackup = useCallback(async (filename: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setRestoring(filename);
      setError(null);
      const res = await fetch(`/api/admin/backups/${encodeURIComponent(filename)}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to restore backup');
      }

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to restore backup';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setRestoring(null);
    }
  }, []);

  const deleteBackup = useCallback(async (filename: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setDeleting(filename);
      setError(null);
      const res = await fetch(`/api/admin/backups/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete backup');
      }

      await fetchBackups();
      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete backup';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setDeleting(null);
    }
  }, [fetchBackups]);

  const downloadBackup = useCallback((filename: string) => {
    // Trigger download via hidden link
    const link = document.createElement('a');
    link.href = `/api/admin/backups/${encodeURIComponent(filename)}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const [truncating, setTruncating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const truncateDatabase = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setTruncating(true);
      setError(null);
      const res = await fetch('/api/admin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'truncate' }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to clear database');
      }

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to clear database';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setTruncating(false);
    }
  }, []);

  const seedDatabase = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      setSeeding(true);
      setError(null);
      const res = await fetch('/api/admin/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed' }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to seed database');
      }

      return { success: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to seed database';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setSeeding(false);
    }
  }, []);

  return {
    backups,
    loading,
    error,
    creating,
    restoring,
    deleting,
    truncating,
    seeding,
    refresh: fetchBackups,
    createBackup,
    restoreBackup,
    deleteBackup,
    downloadBackup,
    truncateDatabase,
    seedDatabase,
  };
}
