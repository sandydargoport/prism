'use client';

import { useState } from 'react';
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

export interface ImportTandoorModalProps {
  onClose: () => void;
  /** Called after a successful import so the recipe list can refresh. */
  onImported: () => void;
}

export function ImportTandoorModal({ onClose, onImported }: ImportTandoorModalProps) {
  const [serverUrl, setServerUrl] = useState('');
  const [token, setToken] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const canSubmit = Boolean(serverUrl.trim() && token.trim()) && !importing;

  const handleImport = async () => {
    if (!canSubmit) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/recipes/import-tandoor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl: serverUrl.trim(), token: token.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Import failed.');
        return;
      }
      setResult(
        `Imported ${data.imported} of ${data.total} recipe${data.total === 1 ? '' : 's'}.`,
      );
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Recipes from Tandoor</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Pull your recipes from a{' '}
            <a
              href="https://tandoor.dev"
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              Tandoor
            </a>{' '}
            server. In Tandoor, create a read-only API token (Settings &rarr; API Token,
            scope <code>read</code>) and paste it below. Imported recipes link back to
            Tandoor and can be edited there.
          </p>

          <div className="space-y-2">
            <Label htmlFor="tandoor-url">Tandoor server URL</Label>
            <Input
              id="tandoor-url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://tandoor.example.com"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tandoor-token">API token</Label>
            <Input
              id="tandoor-token"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="tda_…"
              autoComplete="off"
            />
          </div>

          {/* whitespace-pre-wrap so the actionable "add host to allowlist"
              message from the SSRF guard displays in full. */}
          {error && <p className="text-sm text-destructive whitespace-pre-wrap">{error}</p>}
          {result && (
            <p className="text-sm text-green-600 dark:text-green-400">{result}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {result ? 'Done' : 'Cancel'}
          </Button>
          <Button onClick={handleImport} disabled={!canSubmit}>
            {importing ? 'Importing…' : 'Import Recipes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
