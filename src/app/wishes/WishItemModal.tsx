'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { WishItem } from '@/types';
import { useResetOn } from '@/lib/hooks/useResetOn';

interface WishItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; url?: string; notes?: string }) => Promise<void>;
  editingItem?: WishItem | null;
}

export function WishItemModal({ open, onOpenChange, onSave, editingItem }: WishItemModalProps) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Fill the form when the modal opens. Keyed by the item's id, so a refreshed
  // copy of the same item does not overwrite what is being typed.
  useResetOn(open ? (editingItem?.id ?? 'new') : null, () => {
    if (!open) return;
    setName(editingItem?.name || '');
    setUrl(editingItem?.url || '');
    setNotes(editingItem?.notes || '');
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        url: url.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingItem ? 'Edit Wish' : 'Add Wish'}</DialogTitle>
          <DialogDescription>
            {editingItem ? 'Update this wish list item.' : 'Add something to the wish list.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="wish-name" className="text-sm font-medium mb-1.5 block">
              Name
            </label>
            <Input
              id="wish-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What do you want?"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="wish-url" className="text-sm font-medium mb-1.5 block">
              Link (optional)
            </label>
            <Input
              id="wish-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
            />
          </div>

          <div>
            <label htmlFor="wish-notes" className="text-sm font-medium mb-1.5 block">
              Notes (optional)
            </label>
            <Input
              id="wish-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Size, color, etc."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Saving...' : editingItem ? 'Save' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
