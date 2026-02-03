'use client';

import * as React from 'react';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCategoryEmoji } from '@/app/shopping/ShoppingView';
import type { ShoppingItem } from '@/types';

export function ItemModal({
  listId,
  item,
  onClose,
  onSave,
}: {
  listId: string;
  item?: ShoppingItem;
  onClose: () => void;
  onSave: (item: Omit<ShoppingItem, 'id' | 'createdAt'>) => void | Promise<void>;
}) {
  const [name, setName] = useState(item?.name || '');
  const [quantity, setQuantity] = useState(item?.quantity?.toString() || '');
  const [unit, setUnit] = useState(item?.unit || '');
  const [category, setCategory] = useState<ShoppingItem['category']>(item?.category || 'other');
  const [notes, setNotes] = useState(item?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    try {
      await onSave({
        listId,
        name: name.trim(),
        quantity: quantity ? parseInt(quantity) : undefined,
        unit: unit.trim() || undefined,
        category,
        notes: notes.trim() || undefined,
        checked: item?.checked || false,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {item ? 'Edit Item' : 'Add Item'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name..."
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Quantity</label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                min="1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Unit</label>
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="lbs, oz, etc."
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {(['produce', 'dairy', 'meat', 'bakery', 'frozen', 'pantry', 'household', 'other'] as const).map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  variant={category === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategory(cat)}
                  className="capitalize"
                >
                  {getCategoryEmoji(cat)} {cat}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Saving...' : item ? 'Save Changes' : 'Add Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
