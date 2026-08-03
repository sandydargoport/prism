'use client';

import { useState, useRef, useEffect } from 'react';
import { Emoji } from '@/components/ui/Emoji';
import { Plus, Trash2, GripVertical, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useShoppingCategories, type ShoppingCategoryDef } from '@/lib/hooks/useShoppingCategories';
import { ALL_DEFAULT_CATEGORIES } from '@/lib/constants/shoppingPresets';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { PageLoader } from '@/components/ui/spinner';

const EMOJI_OPTIONS = [
  // Grocery
  '🥬', '🥛', '🥩', '🥖', '🧊', '🥫',
  // General defaults
  '👕', '🏠', '🌱', '🔌', '📎', '🎁',
  // Extra pool
  '🧴', '🥤', '🍿', '🧀', '🥚', '🍕', '🧹', '💊',
  '🐾', '🍬', '🧃', '🥜', '🫒', '🌶️', '🍯',
  // Additional common
  '🛒', '🧺', '🍎', '🥦', '🧈', '🥐', '🍳', '🧂',
  '🫧', '🪥', '🧻', '🧽', '💡', '🔋', '🎉', '✏️',
];

interface ManageCategoriesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageCategoriesModal({ open, onOpenChange }: ManageCategoriesModalProps) {
  const {
    categories,
    loading,
    addCategory,
    updateCategory,
    removeCategory,
    reorderCategories,
  } = useShoppingCategories();

  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState<string | null>(null);
  const [localCategories, setLocalCategories] = useState<ShoppingCategoryDef[]>(categories);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [emojiPickerFor, setEmojiPickerFor] = useState<string | null>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const { confirm, dialogProps } = useConfirmDialog();

  // Sync local state when hook categories update
  useEffect(() => {
    if (!loading && categories.length > 0) {
      setLocalCategories(categories);
    }
  }, [loading, categories]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    if (!emojiPickerFor) return;
    const handler = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiPickerFor(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [emojiPickerFor]);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const result = await addCategory(name);
    if (result) {
      // If user picked a custom emoji, apply it
      if (newEmoji) {
        await updateCategory(result.id, { emoji: newEmoji });
      }
      setLocalCategories(prev => [...prev, { ...result, emoji: newEmoji || result.emoji }]);
      setNewName('');
      setNewEmoji(null);
      toast({ title: `Added "${name}" category` });
    } else {
      toast({ title: 'Category already exists', variant: 'warning' });
    }
  };

  const handleRemove = async (cat: ShoppingCategoryDef) => {
    const ok = await confirm(
      `Remove "${cat.name}"?`,
      'This removes the category from all shopping lists. Items in this category will appear under "Other".'
    );
    if (!ok) return;
    await removeCategory(cat.id);
    setLocalCategories(prev => prev.filter(c => c.id !== cat.id));
    toast({ title: `Removed "${cat.name}" category` });
  };

  const handleResetDefaults = async () => {
    const ok = await confirm(
      'Reset to defaults?',
      'This will replace your current categories with the default set (6 grocery + 6 general categories).'
    );
    if (!ok) return;
    await reorderCategories(ALL_DEFAULT_CATEGORIES as ShoppingCategoryDef[]);
    setLocalCategories(ALL_DEFAULT_CATEGORIES as ShoppingCategoryDef[]);
    toast({ title: 'Categories reset to defaults' });
  };

  const handleEmojiSelect = async (categoryId: string, emoji: string) => {
    await updateCategory(categoryId, { emoji });
    setLocalCategories(prev =>
      prev.map(c => c.id === categoryId ? { ...c, emoji } : c)
    );
    setEmojiPickerFor(null);
  };

  const handleDragStart = (categoryId: string) => {
    setDraggedId(categoryId);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const newOrder = [...localCategories];
    const draggedIdx = newOrder.findIndex(c => c.id === draggedId);
    const targetIdx = newOrder.findIndex(c => c.id === targetId);

    if (draggedIdx !== -1 && targetIdx !== -1) {
      const draggedItem = localCategories[draggedIdx]!;
      newOrder.splice(draggedIdx, 1);
      newOrder.splice(targetIdx, 0, draggedItem);
      setLocalCategories(newOrder);
      reorderCategories(newOrder);
    }
  };

  const handleDragEnd = () => {
    setDraggedId(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
            <DialogDescription>
              Organize the categories for your shopping lists. Drag to reorder.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <PageLoader size="sm" label="Loading categories..." className="py-4" />
          ) : (
            <div className="space-y-4">
              {/* Category list */}
              <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                {localCategories.map((cat) => (
                  <div
                    key={cat.id}
                    draggable
                    onDragStart={() => handleDragStart(cat.id)}
                    onDragOver={(e) => handleDragOver(e, cat.id)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-md border border-border cursor-grab active:cursor-grabbing transition-opacity',
                      draggedId === cat.id && 'opacity-50'
                    )}
                  >
                    <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />

                    {/* Emoji button — click to open picker */}
                    <div className="relative">
                      <button
                        type="button"
                        className="text-xl hover:bg-accent rounded p-0.5 transition-colors"
                        onClick={() => setEmojiPickerFor(emojiPickerFor === cat.id ? null : cat.id)}
                        title="Change emoji"
                      >
                        {cat.emoji}
                      </button>

                      {emojiPickerFor === cat.id && (
                        <div
                          ref={emojiPickerRef}
                          className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-2 w-64"
                        >
                          <div className="grid grid-cols-8 gap-1">
                            {EMOJI_OPTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className={cn(
                                  'text-lg p-1 rounded hover:bg-accent transition-colors',
                                  cat.emoji === emoji && 'bg-accent ring-1 ring-primary'
                                )}
                                onClick={() => handleEmojiSelect(cat.id, emoji)}
                              >
                                <Emoji e={emoji} />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <span className="font-medium flex-1 text-sm">{cat.name}</span>
                    <div
                      className="w-4 h-4 rounded-full shrink-0 border border-border"
                      style={{ backgroundColor: cat.color }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRemove(cat)}
                      title={`Remove ${cat.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Add new category */}
              <div className="flex items-center gap-2">
                {/* Emoji picker for new category */}
                <div className="relative">
                  <button
                    type="button"
                    className="text-xl hover:bg-accent rounded p-1 transition-colors border border-border"
                    onClick={() => setEmojiPickerFor(emojiPickerFor === '_new' ? null : '_new')}
                    title="Pick emoji"
                  >
                    <Emoji e={newEmoji || '🛒'} />
                  </button>

                  {emojiPickerFor === '_new' && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute left-0 bottom-full mb-1 z-50 bg-card border border-border rounded-lg shadow-lg p-2 w-64"
                    >
                      <div className="grid grid-cols-8 gap-1">
                        {EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className={cn(
                              'text-lg p-1 rounded hover:bg-accent transition-colors',
                              newEmoji === emoji && 'bg-accent ring-1 ring-primary'
                            )}
                            onClick={() => {
                              setNewEmoji(emoji);
                              setEmojiPickerFor(null);
                            }}
                          >
                            <Emoji e={emoji} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New category name..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdd();
                    }
                  }}
                />
                <Button onClick={handleAdd} disabled={!newName.trim()} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>

              {/* Reset to defaults */}
              <div className="pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={handleResetDefaults} className="gap-1">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset to Defaults
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog {...dialogProps} />
    </>
  );
}
