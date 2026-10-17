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

export interface ImportUrlModalProps {
  onClose: () => void;
  onImport: (url: string, preview?: boolean) => Promise<unknown>;
}

export function ImportUrlModal({ onClose, onImport }: ImportUrlModalProps) {
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!url.trim()) return;

    setImporting(true);
    setError(null);

    try {
      await onImport(url.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import recipe');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Recipe from URL</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Paste a recipe URL and we&apos;ll extract the recipe details.
            Works with Food.com, Bon App&eacute;tit, NYT Cooking, and most sites
            with schema.org markup. Some sites (AllRecipes, Serious Eats) may
            block automated access.
          </p>

          <div className="space-y-2">
            <Label htmlFor="url">Recipe URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.allrecipes.com/recipe/..."
              autoCapitalize="none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim()) {
                  handleImport();
                }
              }}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!url.trim() || importing}>
            {importing ? 'Importing...' : 'Import Recipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
