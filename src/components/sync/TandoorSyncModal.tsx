'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SyncReviewModal, type SyncReviewChange } from '@/components/sync/SyncReviewModal';

/** Which entity this Tandoor sync drives. Both reuse the same connection. */
export type TandoorSyncEntity = 'recipes' | 'meals';

interface EntityConfig {
  /** Connect/sync dialog title. */
  title: string;
  /** Review modal title. */
  reviewTitle: string;
  /** Plural noun used in review copy. */
  entityLabel: string;
  /** What "Sync now" fetches, for the connected-state blurb. */
  syncBlurb: string;
  preview: (sourceId: string) => string;
  apply: (sourceId: string) => string;
}

const ENTITY: Record<TandoorSyncEntity, EntityConfig> = {
  recipes: {
    title: 'Sync from Tandoor',
    reviewTitle: 'Review Tandoor recipe changes',
    entityLabel: 'recipes',
    syncBlurb:
      'Sync fetches the current recipes from Tandoor and shows you exactly what would change here — you pick what to apply. Nothing is changed without your OK.',
    preview: (id) => `/api/recipe-sources/${id}/sync/preview`,
    apply: (id) => `/api/recipe-sources/${id}/sync/apply`,
  },
  meals: {
    title: 'Sync meal plan from Tandoor',
    reviewTitle: 'Review Tandoor meal-plan changes',
    entityLabel: 'meals',
    syncBlurb:
      'Sync fetches your Tandoor meal plan and shows you exactly what would change here — you pick what to apply. Meals that reference a recipe you haven’t imported will bring the recipe along.',
    preview: (id) => `/api/recipe-sources/${id}/meal-sync/preview`,
    apply: (id) => `/api/recipe-sources/${id}/meal-sync/apply`,
  },
};

export interface TandoorSyncModalProps {
  entity: TandoorSyncEntity;
  onClose: () => void;
  /** Called after changes are applied so the page can refresh. */
  onSynced: () => void;
}

interface RecipeSource {
  id: string;
  provider: string;
  name: string | null;
  serverUrl: string;
  lastSynced: string | null;
}

interface PreviewResult {
  diffId: string;
  changes: SyncReviewChange[];
  counts: { add: number; update: number; delete: number };
  massDeleteGuardTripped: boolean;
  withheldDeletes: number;
  notes?: string[];
}

/**
 * Reusable review-and-approve Tandoor sync, driven by `entity`. Connects a
 * Tandoor server if none exists yet, then: Sync now → preview → SyncReviewModal
 * (pick changes) → apply. The recipe and meal-plan flows share this component
 * and the same underlying connection; only the endpoints + copy differ.
 */
export function TandoorSyncModal({ entity, onClose, onSynced }: TandoorSyncModalProps) {
  const cfg = ENTITY[entity];

  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<RecipeSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  // connect form
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);

  // sync
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/recipe-sources');
        if (res.ok) {
          const data = await res.json();
          const tandoor = (data.sources as RecipeSource[]).find((s) => s.provider === 'tandoor');
          if (tandoor) setSource(tandoor);
        }
      } catch {
        /* fall through to connect form */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleConnect = async () => {
    if (!serverUrl.trim() || !token.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/recipe-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'tandoor', serverUrl: serverUrl.trim(), token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to connect.');
        return;
      }
      setSource({ id: data.id, provider: 'tandoor', name: null, serverUrl: serverUrl.trim(), lastSynced: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncNow = async () => {
    if (!source) return;
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(cfg.preview(source.id), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sync failed.');
        return;
      }
      // No-op sync: skip the review modal and land on the terminal done screen.
      if (!data.changes || data.changes.length === 0) {
        setResult("Everything is up to date — nothing to sync.");
        return;
      }
      setPreview(data as PreviewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleApply = async (selected: Array<{ kind: string; externalId: string }>) => {
    if (!source || !preview) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(cfg.apply(source.id), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ diffId: preview.diffId, selected }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to apply.');
        return;
      }
      const a = data.applied;
      setResult(`Applied ${a.add} added, ${a.update} updated, ${a.delete} removed.`);
      setPreview(null);
      onSynced();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply.');
    } finally {
      setApplying(false);
    }
  };

  // While a preview is open, show the review modal instead of this dialog.
  if (preview) {
    return (
      <SyncReviewModal
        title={cfg.reviewTitle}
        entityLabel={cfg.entityLabel}
        changes={preview.changes}
        counts={preview.counts}
        massDeleteGuardTripped={preview.massDeleteGuardTripped}
        withheldDeletes={preview.withheldDeletes}
        notes={preview.notes}
        applying={applying}
        onApply={handleApply}
        onClose={() => setPreview(null)}
      />
    );
  }

  // Terminal success state: a clean "done" screen instead of dropping back to
  // the "Sync now" prompt (which reads like a loop). One button, and we're out.
  if (result) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              Sync complete
            </DialogTitle>
          </DialogHeader>
          <p className="py-4 text-sm text-muted-foreground">{result}</p>
          <DialogFooter>
            <Button onClick={onClose} autoFocus>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : source ? (
            <>
              <p className="text-sm text-muted-foreground">
                Connected to <span className="font-medium">{source.serverUrl}</span>
                {source.lastSynced && (
                  <> · last synced {new Date(source.lastSynced).toLocaleString()}</>
                )}
                .
              </p>
              <p className="text-sm text-muted-foreground">{cfg.syncBlurb}</p>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Connect your Tandoor server once. Create a read-only API token in Tandoor
                (Settings → API Token, scope <code>read</code>) and paste it below.
              </p>
              <div className="space-y-2">
                <Label htmlFor="sync-tandoor-url">Tandoor server URL</Label>
                <Input
                  id="sync-tandoor-url"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="https://tandoor.example.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-tandoor-token">API token</Label>
                <Input
                  id="sync-tandoor-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="tda_…"
                  autoComplete="off"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          {source ? (
            <Button onClick={handleSyncNow} disabled={syncing}>
              {syncing ? 'Checking…' : 'Sync now'}
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={connecting || !serverUrl.trim() || !token.trim()}>
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
