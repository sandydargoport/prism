'use client';

import * as React from 'react';
import { useState, useMemo } from 'react';
import { User, Trash2, ShoppingCart, Package, Store, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { cn } from '@/lib/utils';
import type { ShoppingList, FamilyMember } from '@/types';
import type { ShoppingCategoryDef } from '@/lib/hooks/useShoppingCategories';
import {
  GROCERY_CATEGORIES,
  GENERAL_CATEGORIES,
  ALL_DEFAULT_CATEGORIES,
} from '@/lib/constants/shoppingPresets';

type ListType = 'grocery' | 'general' | 'other';
type VisualType = ListType | 'custom';

const GROCERY_IDS = new Set(GROCERY_CATEGORIES.map(c => c.id));
const GENERAL_IDS = new Set(GENERAL_CATEGORIES.map(c => c.id));
const ALL_IDS = new Set(ALL_DEFAULT_CATEGORIES.map(c => c.id));

export interface ListModalSaveData {
  name: string;
  description?: string;
  assignedTo?: string;
  listType?: ListType;
  visibleCategories?: string[] | null;
}

/** Determine which visual type preset matches a given selection (against available categories) */
function deriveVisualType(selected: Set<string>, allCategoryIds: Set<string>): VisualType {
  // Check exact matches against presets (only considering categories that exist in the available set)
  const effectiveGrocery = new Set([...GROCERY_IDS].filter(id => allCategoryIds.has(id)));
  const effectiveGeneral = new Set([...GENERAL_IDS].filter(id => allCategoryIds.has(id)));

  const setsEqual = (a: Set<string>, b: Set<string>) =>
    a.size === b.size && [...a].every(id => b.has(id));

  if (setsEqual(selected, effectiveGrocery)) return 'grocery';
  if (setsEqual(selected, effectiveGeneral)) return 'general';
  if (setsEqual(selected, allCategoryIds)) return 'other';
  return 'custom';
}

/** Get preset categories for a visual type */
function presetForType(type: VisualType, allCategoryIds: Set<string>): Set<string> {
  switch (type) {
    case 'grocery':
      return new Set([...GROCERY_IDS].filter(id => allCategoryIds.has(id)));
    case 'general':
      return new Set([...GENERAL_IDS].filter(id => allCategoryIds.has(id)));
    case 'other':
      return new Set(allCategoryIds);
    case 'custom':
      return new Set();
  }
}

export function ListModal({
  list,
  familyMembers,
  categories,
  onClose,
  onSave,
  onDelete,
}: {
  list: ShoppingList | null;
  familyMembers: FamilyMember[];
  categories: ShoppingCategoryDef[];
  onClose: () => void;
  onSave: (data: ListModalSaveData) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [name, setName] = useState(list?.name || '');
  const [description, setDescription] = useState(list?.description || '');
  const [assignedTo, setAssignedTo] = useState<string>(list?.assignedTo || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();

  const allCategoryIds = useMemo(() => new Set(categories.map(c => c.id)), [categories]);

  // Initialize selected categories from list or type preset
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(() => {
    if (list) {
      // Editing: use existing visible categories, or all if null
      if (list.visibleCategories && list.visibleCategories.length > 0) {
        return new Set(list.visibleCategories);
      }
      if (list.visibleCategories && list.visibleCategories.length === 0) {
        // Was "blank" (no categories) — now "custom" with none selected
        return new Set<string>();
      }
      // null means all visible
      return new Set(categories.map(c => c.id));
    }
    // New list: default to grocery preset
    return new Set([...GROCERY_IDS].filter(id => allCategoryIds.has(id)));
  });

  // Derive the visual type from current selection
  const visualType = useMemo(
    () => deriveVisualType(selectedCategories, allCategoryIds),
    [selectedCategories, allCategoryIds]
  );

  const handleTypeClick = (type: VisualType) => {
    setSelectedCategories(presetForType(type, allCategoryIds));
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    if (!await confirm(`Delete "${list?.name}"?`, 'All items on this list will also be deleted.')) return;

    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    try {
      const allSelected = selectedCategories.size === categories.length &&
        [...selectedCategories].every(id => allCategoryIds.has(id));

      const data: ListModalSaveData = {
        name: name.trim(),
        description: description.trim() || undefined,
        assignedTo: assignedTo || undefined,
        listType: visualType === 'custom' ? 'other' : visualType,
        visibleCategories: allSelected ? null : Array.from(selectedCategories),
      };
      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{list ? 'Edit List' : 'Create New List'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">List Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Grocery, Target, Hardware..."
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this list for?"
            />
          </div>

          <div>
            <label className="text-sm font-medium">List Type</label>
            <p className="text-xs text-muted-foreground mb-2">
              Pick a preset or toggle individual categories below.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={visualType === 'grocery' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeClick('grocery')}
                className="gap-1"
              >
                <ShoppingCart className="h-4 w-4" />
                Grocery
              </Button>
              <Button
                type="button"
                variant={visualType === 'general' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeClick('general')}
                className="gap-1"
              >
                <Store className="h-4 w-4" />
                General
              </Button>
              <Button
                type="button"
                variant={visualType === 'other' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeClick('other')}
                className="gap-1"
              >
                <Package className="h-4 w-4" />
                All
              </Button>
              <Button
                type="button"
                variant={visualType === 'custom' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleTypeClick('custom')}
                className="gap-1"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Custom
              </Button>
            </div>

            {/* Interactive category chips */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {categories.map((cat) => {
                const isSelected = selectedCategories.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => toggleCategory(cat.id)}
                    className={cn(
                      'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors',
                      isSelected
                        ? 'border-primary/50 bg-primary/10 text-foreground'
                        : 'border-border bg-muted/30 text-muted-foreground opacity-50'
                    )}
                  >
                    <span>{cat.emoji}</span>
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
            {selectedCategories.size === 0 && (
              <p className="text-xs text-muted-foreground mt-1.5 italic">
                No categories selected. Items will appear in an uncategorized list.
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Assign To
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              Only the assigned person (or parents) can check items off. Leave empty for family-wide access.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={!assignedTo ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAssignedTo('')}
              >
                Everyone
              </Button>
              {/* Filter out members whose id wasn't exposed (unauthenticated
                  /api/family responses return id='' instead of a real UUID).
                  Otherwise selecting them sets assignedTo to an empty string
                  and the create endpoint fails validation. */}
              {familyMembers.filter((m) => m.id).map((member) => (
                <Button
                  key={member.id}
                  type="button"
                  variant={assignedTo === member.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignedTo(member.id)}
                  className="gap-1"
                >
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: member.color }}
                  />
                  {member.name}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex justify-between gap-2 pt-4">
            {list && onDelete ? (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={saving || deleting}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleting ? 'Deleting...' : 'Delete List'}
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={saving || deleting}>
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim() || saving || deleting}>
                {saving ? 'Saving...' : list ? 'Save Changes' : 'Create List'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
      <ConfirmDialog {...confirmDialogProps} />
    </Dialog>
  );
}
