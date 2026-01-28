/**
 * ============================================================================
 * PRISM - Add Shopping Item Modal
 * ============================================================================
 *
 * A modal dialog for creating and editing shopping list items.
 * Includes form fields for name, quantity, unit, category, and notes.
 *
 * USAGE:
 *   <AddShoppingItemModal
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     defaultListId="list-123"
 *     onItemCreated={(item) => console.log('Created:', item)}
 *   />
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';

/**
 * Shopping list for selector
 */
interface ShoppingList {
  id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

/**
 * Shopping item data returned after creation
 */
export interface CreatedShoppingItem {
  id: string;
  listId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: 'produce' | 'dairy' | 'meat' | 'bakery' | 'frozen' | 'pantry' | 'household' | 'other' | null;
  notes: string | null;
  checked: boolean;
}

/**
 * Shopping item data for editing
 */
export interface ShoppingItemToEdit {
  id: string;
  listId: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: 'produce' | 'dairy' | 'meat' | 'bakery' | 'frozen' | 'pantry' | 'household' | 'other';
  notes?: string;
  checked: boolean;
}

/**
 * AddShoppingItemModal Props
 */
export interface AddShoppingItemModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when item is successfully created or updated */
  onItemCreated?: (item: CreatedShoppingItem) => void;
  /** Pre-select a shopping list */
  defaultListId?: string;
  /** Item to edit (if provided, modal is in edit mode) */
  item?: ShoppingItemToEdit;
}

/**
 * Category emoji mapping
 */
function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'produce': return '🥬';
    case 'dairy': return '🥛';
    case 'meat': return '🥩';
    case 'bakery': return '🥖';
    case 'frozen': return '🧊';
    case 'pantry': return '🥫';
    case 'household': return '🧴';
    default: return '🛒';
  }
}

/**
 * ADD SHOPPING ITEM MODAL COMPONENT
 */
export function AddShoppingItemModal({
  open,
  onOpenChange,
  onItemCreated,
  defaultListId,
  item,
}: AddShoppingItemModalProps) {
  const isEditMode = !!item;

  // Form state
  const [listId, setListId] = useState(defaultListId || '');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState<'produce' | 'dairy' | 'meat' | 'bakery' | 'frozen' | 'pantry' | 'household' | 'other'>('other');
  const [notes, setNotes] = useState('');

  // Loading/error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Shopping lists for selector
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [loadingLists, setLoadingLists] = useState(true);

  // Fetch shopping lists when modal opens
  useEffect(() => {
    if (open) {
      fetchShoppingLists();
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (open && item) {
      setListId(item.listId);
      setName(item.name);
      setQuantity(item.quantity?.toString() || '');
      setUnit(item.unit || '');
      setCategory(item.category || 'other');
      setNotes(item.notes || '');
    }
  }, [open, item]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setListId(defaultListId || '');
      setName('');
      setQuantity('');
      setUnit('');
      setCategory('other');
      setNotes('');
      setError(null);
    }
  }, [open, defaultListId]);

  async function fetchShoppingLists() {
    try {
      setLoadingLists(true);
      const response = await fetch('/api/shopping/lists');
      if (response.ok) {
        const data = await response.json();
        setShoppingLists(data.lists || []);

        // Auto-select first list if no default
        if (!defaultListId && !item && data.lists.length > 0) {
          setListId(data.lists[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch shopping lists:', err);
    } finally {
      setLoadingLists(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !listId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        listId,
        name: name.trim(),
        quantity: quantity ? parseInt(quantity) : undefined,
        unit: unit.trim() || undefined,
        category,
        notes: notes.trim() || undefined,
      };

      const url = isEditMode ? `/api/shopping/items/${item.id}` : '/api/shopping/items';
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save item');
      }

      const savedItem = await response.json();

      if (onItemCreated) {
        onItemCreated(savedItem);
      }

      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save shopping item:', err);
      setError(err instanceof Error ? err.message : 'Failed to save item');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Item' : 'Add Item'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update shopping item details.' : 'Add a new item to your shopping list.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shopping List Selector */}
          {!isEditMode && shoppingLists.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="shopping-list">Shopping List</Label>
              {loadingLists ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading lists...
                </div>
              ) : (
                <Select value={listId} onValueChange={setListId}>
                  <SelectTrigger id="shopping-list">
                    <SelectValue placeholder="Select a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {shoppingLists.map((list) => (
                      <SelectItem key={list.id} value={list.id}>
                        {list.icon} {list.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="item-name">Name</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name..."
              autoFocus
              required
            />
          </div>

          {/* Quantity and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item-quantity">Quantity</Label>
              <Input
                id="item-quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-unit">Unit</Label>
              <Input
                id="item-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="lbs, oz, etc."
              />
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex gap-2 flex-wrap">
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="item-notes">Notes (optional)</Label>
            <Input
              id="item-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any details..."
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || !listId || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? 'Saving...' : 'Adding...'}
                </>
              ) : (
                isEditMode ? 'Save Changes' : 'Add Item'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
