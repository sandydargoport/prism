'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
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

/** Which entity this sync drives. Both share the same connections. */
export type SyncEntity = 'recipes' | 'meals';

const ENTITY = {
  recipes: {
    title: 'Sync recipes',
    reviewTitle: 'Review recipe changes',
    entityLabel: 'recipes',
    blurb:
      'Pull the current recipes from a connected server and pick exactly what to apply here — nothing changes without your OK.',
    preview: (id: string) => `/api/recipe-sources/${id}/sync/preview`,
    apply: (id: string) => `/api/recipe-sources/${id}/sync/apply`,
  },
  meals: {
    title: 'Sync meal plan',
    reviewTitle: 'Review meal-plan changes',
    entityLabel: 'meals',
    blurb:
      'Pull the meal plan from a connected server and pick what to apply. Meals whose recipe you haven’t imported will bring the recipe along.',
    preview: (id: string) => `/api/recipe-sources/${id}/meal-sync/preview`,
    apply: (id: string) => `/api/recipe-sources/${id}/meal-sync/apply`,
  },
} as const;

const PROVIDERS = [
  { value: 'tandoor', label: 'Tandoor' },
  { value: 'mealie', label: 'Mealie' },
] as const;

export interface RecipeSyncModalProps {
  entity: SyncEntity;
  onClose: () => void;
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

const providerLabel = (p: string) => PROVIDERS.find((x) => x.value === p)?.label ?? p;

/**
 * Provider-aware review-and-approve sync for recipes and meal plans. Lists
 * connected servers (Tandoor / Mealie), lets you sync any of them or connect a
 * new one, then: Sync → preview → SyncReviewModal → apply. All providers share
 * this component and the underlying framework; only endpoints/copy vary.
 */
export function RecipeSyncModal({ entity, onClose, onSynced }: RecipeSyncModalProps) {
  const cfg = ENTITY[entity];

  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<RecipeSource[]>([]);
  const [error, setError] = useState<string | null>(null);

  // connect form
  const [showConnect, setShowConnect] = useState(false);
  const [provider, setProvider] = useState<string>('tandoor');
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);

  // sync
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const loadSources = async () => {
    try {
      const res = await fetch('/api/recipe-sources');
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources as RecipeSource[]);
      }
    } catch {
      /* fall through to connect form */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleConnect = async () => {
    if (!serverUrl.trim() || !token.trim()) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/recipe-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, serverUrl: serverUrl.trim(), token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to connect.');
        return;
      }
      setServerUrl('');
      setToken('');
      setShowConnect(false);
      await loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSyncNow = async (source: RecipeSource) => {
    setSyncingId(source.id);
    setActiveSourceId(source.id);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(cfg.preview(source.id), { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Sync failed.');
        return;
      }
      if (!data.changes || data.changes.length === 0) {
        setResult('Everything is up to date — nothing to sync.');
        return;
      }
      setPreview(data as PreviewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncingId(null);
    }
  };

  const handleApply = async (selected: Array<{ kind: string; externalId: string }>) => {
    if (!activeSourceId || !preview) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(cfg.apply(activeSourceId), {
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

  const connectForm = (
    <div className="space-y-3 rounded-md border border-border p-3">
      <p className="text-sm text-muted-foreground">
        Connect a recipe server. Create a read API token in the app and paste it below.
      </p>
      <div className="space-y-2">
        <Label htmlFor="sync-provider">Provider</Label>
        <select
          id="sync-provider"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="sync-url">Server URL</Label>
        <Input
          id="sync-url"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          placeholder="http://192.168.1.x:port"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="sync-token">API token</Label>
        <Input
          id="sync-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste token"
          autoComplete="off"
        />
      </div>
      <div className="flex justify-end gap-2">
        {sources.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setShowConnect(false)}>
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleConnect}
          disabled={connecting || !serverUrl.trim() || !token.trim()}
        >
          {connecting ? 'Connecting…' : 'Connect'}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{cfg.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">{cfg.blurb}</p>

              {sources.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{providerLabel(s.provider)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.serverUrl}
                      {s.lastSynced && <> · last synced {new Date(s.lastSynced).toLocaleString()}</>}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleSyncNow(s)} disabled={syncingId === s.id}>
                    {syncingId === s.id ? 'Checking…' : 'Sync now'}
                  </Button>
                </div>
              ))}

              {showConnect || sources.length === 0 ? (
                connectForm
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowConnect(true)}>
                  <Plus className="mr-1 h-4 w-4" />
                  Connect another server
                </Button>
              )}

              {error && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
