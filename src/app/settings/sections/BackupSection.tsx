'use client';

import { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  Clock,
  Eraser,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBackups } from '@/lib/hooks/useBackups';

export function BackupSection() {
  const {
    backups,
    loading,
    error,
    creating,
    restoring,
    deleting,
    truncating,
    seeding,
    refresh,
    createBackup,
    restoreBackup,
    deleteBackup,
    downloadBackup,
    truncateDatabase,
    seedDatabase,
  } = useBackups();

  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmTruncate, setConfirmTruncate] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  const handleCreateBackup = async () => {
    const result = await createBackup();
    if (result.success) {
      showSuccess('Backup created successfully!');
    }
  };

  const handleRestore = async (filename: string) => {
    const result = await restoreBackup(filename);
    setConfirmRestore(null);
    if (result.success) {
      showSuccess('Database restored successfully! You may need to refresh the page.');
    }
  };

  const handleDelete = async (filename: string) => {
    const result = await deleteBackup(filename);
    setConfirmDelete(null);
    if (result.success) {
      showSuccess('Backup deleted.');
    }
  };

  const handleTruncate = async () => {
    const result = await truncateDatabase();
    setConfirmTruncate(false);
    if (result.success) {
      showSuccess('All data has been cleared. Refresh the page to see changes.');
    }
  };

  const handleSeed = async () => {
    const result = await seedDatabase();
    if (result.success) {
      showSuccess('Database seeded with demo data! Refresh the page to see changes.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Backup button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Database Backups</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleCreateBackup}
            disabled={creating}
            size="sm"
          >
            {creating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <HardDrive className="h-4 w-4 mr-1" />
                Backup Now
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400">
          <CheckCircle className="h-4 w-4" />
          {successMessage}
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Backup list */}
      <div className="border border-border rounded-lg overflow-hidden">
        {loading && backups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <RefreshCw className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
            <p>Loading backups...</p>
          </div>
        ) : backups.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No backups yet</p>
            <p className="text-sm mt-1">Click &quot;Backup Now&quot; to create your first backup</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {backups.map((backup) => (
              <div
                key={backup.filename}
                className="p-4 flex items-center justify-between hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{backup.filename}</p>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {backup.sizeFormatted}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {backup.createdAtFormatted}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {/* Download button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadBackup(backup.filename)}
                    title="Download backup"
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  {/* Restore button */}
                  {confirmRestore === backup.filename ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRestore(backup.filename)}
                        disabled={!!restoring}
                      >
                        {restoring === backup.filename ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Confirm'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmRestore(null)}
                        disabled={!!restoring}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmRestore(backup.filename)}
                      title="Restore from this backup"
                      disabled={!!restoring}
                    >
                      <Upload className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Delete button */}
                  {confirmDelete === backup.filename ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(backup.filename)}
                        disabled={!!deleting}
                      >
                        {deleting === backup.filename ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Delete'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDelete(null)}
                        disabled={!!deleting}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmDelete(backup.filename)}
                      title="Delete backup"
                      disabled={!!deleting}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info text */}
      <p className="text-sm text-muted-foreground">
        Backups contain all database data including family members, chores, tasks, calendar events, and settings.
        Restoring a backup will overwrite all current data.
      </p>

      {/* Danger Zone */}
      <div className="border border-red-200 dark:border-red-800 rounded-lg p-4 space-y-4">
        <h4 className="font-semibold text-red-600 dark:text-red-400 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Danger Zone
        </h4>

        <div className="flex flex-wrap gap-3">
          {/* Clear All Data */}
          {confirmTruncate ? (
            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg">
              <span className="text-sm text-red-600 dark:text-red-400">
                This will DELETE all data. Are you sure?
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleTruncate}
                disabled={truncating}
              >
                {truncating ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  'Yes, Delete Everything'
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmTruncate(false)}
                disabled={truncating}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              onClick={() => setConfirmTruncate(true)}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Eraser className="h-4 w-4 mr-2" />
              Clear All Data
            </Button>
          )}

          {/* Seed Demo Data */}
          <Button
            variant="outline"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Seeding...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Seed Demo Data
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          &quot;Clear All Data&quot; removes everything from the database.
          &quot;Seed Demo Data&quot; populates with a sample family (Alex, Jordan, Sam, Riley) for testing.
        </p>
      </div>
    </div>
  );
}
