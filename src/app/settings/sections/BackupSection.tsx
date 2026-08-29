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

type DangerStep = null | 'warn-truncate' | 'confirm-truncate' | 'warn-seed' | 'confirm-seed';

/** How many backups to show before collapsing the rest behind a toggle. */
const RECENT_BACKUP_COUNT = 5;

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

  // Older ones are collapsed rather than dropped: nothing is deleted here, and
  // an old backup is still restorable. The list has no retention policy, so it
  // grows forever and buries the actions above it.
  const [showAllBackups, setShowAllBackups] = useState(false);

  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [dangerStep, setDangerStep] = useState<DangerStep>(null);
  const [challengeInput, setChallengeInput] = useState('');
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
    setDangerStep(null);
    setChallengeInput('');
    if (result.success) {
      showSuccess('All data has been cleared. Refresh the page to see changes.');
    }
  };

  const handleSeed = async () => {
    const result = await seedDatabase();
    setDangerStep(null);
    setChallengeInput('');
    if (result.success) {
      showSuccess('Database seeded with demo data! Refresh the page to see changes.');
    }
  };

  const cancelDanger = () => {
    setDangerStep(null);
    setChallengeInput('');
  };

  const TRUNCATE_CHALLENGE = 'DELETE ALL DATA';
  const SEED_CHALLENGE = 'SEED DEMO DATA';

  return (
    <div className="space-y-6">
      {/* Cache Management */}
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-primary" />
              Clear Cache &amp; Reload
            </h4>
            <p className="text-sm text-muted-foreground mt-1">
              Unregisters the service worker and clears cached assets. Use after an update if the app seems stale.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                if ('serviceWorker' in navigator) {
                  const registrations = await navigator.serviceWorker.getRegistrations();
                  await Promise.all(registrations.map(r => r.unregister()));
                }
                if ('caches' in window) {
                  const keys = await caches.keys();
                  await Promise.all(keys.map(k => caches.delete(k)));
                }
                window.location.reload();
              } catch {
                window.location.reload();
              }
            }}
            className="ml-4 flex-shrink-0"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

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
            {(showAllBackups ? backups : backups.slice(0, RECENT_BACKUP_COUNT)).map((backup) => (
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
                    <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                      <span className="text-xs text-amber-700 dark:text-amber-400 max-w-48">
                        This will overwrite all current data. Changes since {backup.createdAtFormatted} will be lost.
                      </span>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRestore(backup.filename)}
                        disabled={!!restoring}
                      >
                        {restoring === backup.filename ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Restore'
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
            {backups.length > RECENT_BACKUP_COUNT && (
              <button
                type="button"
                onClick={() => setShowAllBackups((v) => !v)}
                className="w-full p-3 text-sm text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              >
                {showAllBackups
                  ? 'Show fewer'
                  : `Show ${backups.length - RECENT_BACKUP_COUNT} older backup${
                      backups.length - RECENT_BACKUP_COUNT === 1 ? '' : 's'
                    }`}
              </button>
            )}
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

        {/* Step 1: Warning for truncate */}
        {dangerStep === 'warn-truncate' && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-600 dark:text-red-400">Warning: This will permanently delete all data</p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-1">
                  All family members, chores, tasks, calendar events, meals, recipes, shopping lists, messages, and settings will be removed. This cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={() => { setDangerStep('confirm-truncate'); setChallengeInput(''); }}>
                I understand, proceed
              </Button>
              <Button variant="outline" size="sm" onClick={cancelDanger}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Step 2: Type-to-confirm for truncate */}
        {dangerStep === 'confirm-truncate' && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400">
              Type <span className="font-mono font-bold">{TRUNCATE_CHALLENGE}</span> to confirm:
            </p>
            <input
              type="text"
              value={challengeInput}
              onChange={(e) => setChallengeInput(e.target.value)}
              placeholder={TRUNCATE_CHALLENGE}
              className="w-full px-3 py-2 rounded-md border border-red-300 dark:border-red-700 bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && challengeInput === TRUNCATE_CHALLENGE) handleTruncate();
                if (e.key === 'Escape') cancelDanger();
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleTruncate}
                disabled={truncating || challengeInput !== TRUNCATE_CHALLENGE}
              >
                {truncating ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Deleting...</>
                ) : (
                  'Delete Everything'
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={cancelDanger} disabled={truncating}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Step 1: Warning for seed */}
        {dangerStep === 'warn-seed' && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-600 dark:text-amber-400">Warning: This will overwrite your data</p>
                <p className="text-sm text-amber-600/80 dark:text-amber-400/80 mt-1">
                  Seeding will populate the database with demo family data (Alex, Jordan, Sam, Riley). Existing data may be affected.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="default" size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => { setDangerStep('confirm-seed'); setChallengeInput(''); }}>
                I understand, proceed
              </Button>
              <Button variant="outline" size="sm" onClick={cancelDanger}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Step 2: Type-to-confirm for seed */}
        {dangerStep === 'confirm-seed' && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg space-y-3">
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Type <span className="font-mono font-bold">{SEED_CHALLENGE}</span> to confirm:
            </p>
            <input
              type="text"
              value={challengeInput}
              onChange={(e) => setChallengeInput(e.target.value)}
              placeholder={SEED_CHALLENGE}
              className="w-full px-3 py-2 rounded-md border border-amber-300 dark:border-amber-700 bg-background text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && challengeInput === SEED_CHALLENGE) handleSeed();
                if (e.key === 'Escape') cancelDanger();
              }}
            />
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleSeed}
                disabled={seeding || challengeInput !== SEED_CHALLENGE}
              >
                {seeding ? (
                  <><RefreshCw className="h-4 w-4 mr-1 animate-spin" /> Seeding...</>
                ) : (
                  'Seed Demo Data'
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={cancelDanger} disabled={seeding}>Cancel</Button>
            </div>
          </div>
        )}

        {/* Buttons (only show when no confirmation is active) */}
        {!dangerStep && (
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setDangerStep('warn-truncate')}
              className="border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Eraser className="h-4 w-4 mr-2" />
              Clear All Data
            </Button>
            <Button
              variant="outline"
              onClick={() => setDangerStep('warn-seed')}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Seed Demo Data
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          &quot;Clear All Data&quot; removes everything from the database.
          &quot;Seed Demo Data&quot; populates with a sample family (Alex, Jordan, Sam, Riley) for testing.
        </p>
      </div>
    </div>
  );
}
