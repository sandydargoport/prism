/**
 * ============================================================================
 * PRISM - Shopping View Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * The main interactive shopping view with multiple lists and item management.
 *
 * FEATURES:
 * - Multiple shopping lists
 * - Switch between lists
 * - Check off items
 * - Add/edit/delete items
 * - Filter by checked status
 * - Group by category
 * - Progress tracking
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingCart,
  Plus,
  Home,
  Trash2,
  Edit2,
  X,
  Settings,
  User,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useShoppingLists } from '@/lib/hooks';
import { PageWrapper } from '@/components/layout';
import { useAuth } from '@/components/providers';

/**
 * SHOPPING ITEM INTERFACE
 */
interface ShoppingItem {
  id: string;
  listId: string;
  name: string;
  quantity?: number;
  unit?: string;
  category?: 'produce' | 'dairy' | 'meat' | 'bakery' | 'frozen' | 'pantry' | 'household' | 'other';
  checked: boolean;
  notes?: string;
  createdAt: Date;
}

/**
 * SHOPPING LIST INTERFACE
 */
interface ShoppingList {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  assignedTo?: string;
  items: ShoppingItem[];
  createdAt: Date;
}

/**
 * FAMILY MEMBER INTERFACE (for dropdown)
 */
interface FamilyMember {
  id: string;
  name: string;
  color: string;
  role: 'parent' | 'child' | 'guest';
}

/**
 * DEMO DATA
 */
function getDemoLists(): ShoppingList[] {
  const today = new Date();

  return [
    {
      id: 'grocery',
      name: 'Grocery',
      sortOrder: 1,
      createdAt: today,
      items: [
        {
          id: '1',
          listId: 'grocery',
          name: 'Milk',
          quantity: 1,
          unit: 'gallon',
          category: 'dairy',
          checked: false,
          createdAt: today,
        },
        {
          id: '2',
          listId: 'grocery',
          name: 'Bananas',
          quantity: 6,
          category: 'produce',
          checked: false,
          createdAt: today,
        },
        {
          id: '3',
          listId: 'grocery',
          name: 'Chicken breast',
          quantity: 2,
          unit: 'lbs',
          category: 'meat',
          checked: false,
          createdAt: today,
        },
        {
          id: '4',
          listId: 'grocery',
          name: 'Bread',
          quantity: 1,
          unit: 'loaf',
          category: 'bakery',
          checked: true,
          createdAt: today,
        },
        {
          id: '5',
          listId: 'grocery',
          name: 'Ice cream',
          category: 'frozen',
          checked: false,
          createdAt: today,
        },
        {
          id: '6',
          listId: 'grocery',
          name: 'Eggs',
          quantity: 12,
          category: 'dairy',
          checked: false,
          createdAt: today,
        },
        {
          id: '7',
          listId: 'grocery',
          name: 'Tomatoes',
          quantity: 4,
          category: 'produce',
          checked: false,
          createdAt: today,
        },
      ],
    },
    {
      id: 'target',
      name: 'Target',
      sortOrder: 2,
      createdAt: today,
      items: [
        {
          id: '8',
          listId: 'target',
          name: 'Paper towels',
          quantity: 2,
          category: 'household',
          checked: false,
          createdAt: today,
        },
        {
          id: '9',
          listId: 'target',
          name: 'Laundry detergent',
          quantity: 1,
          category: 'household',
          checked: false,
          createdAt: today,
        },
        {
          id: '10',
          listId: 'target',
          name: 'Dish soap',
          category: 'household',
          checked: true,
          createdAt: today,
        },
      ],
    },
  ];
}

/**
 * SHOPPING VIEW COMPONENT
 */
export function ShoppingView() {
  // Auth context
  const { requireAuth } = useAuth();

  // Fetch shopping lists from API
  const {
    lists: apiLists,
    loading,
    error,
    refresh: refreshLists,
    toggleItem: apiToggleItem,
    addItem: apiAddItem,
    deleteItem: apiDeleteItem
  } = useShoppingLists({});

  // Fetch family members for assignment dropdown
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  useEffect(() => {
    fetch('/api/family')
      .then(res => res.json())
      .then(data => setFamilyMembers(data.members || []))
      .catch(err => console.error('Failed to fetch family members:', err));
  }, []);

  // Fallback to demo data if no API data is returned
  const lists = apiLists.length > 0 ? apiLists : getDemoLists();

  // State
  const [activeListId, setActiveListId] = useState(lists[0]?.id || '');
  const [showChecked, setShowChecked] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [editingList, setEditingList] = useState<ShoppingList | null>(null);

  // Get active list
  const activeList = lists.find((l) => l.id === activeListId) || lists[0];

  // Filter items
  const filteredItems = useMemo(() => {
    if (!activeList) return [];
    let items = [...activeList.items];

    if (!showChecked) {
      items = items.filter((item) => !item.checked);
    }

    // Group by category
    const grouped = items.reduce((acc, item) => {
      const category = item.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, ShoppingItem[]>);

    // Return flattened array with category headers
    return grouped;
  }, [activeList, showChecked]);

  // Toggle item checked status - use API hook
  const toggleItem = async (itemId: string) => {
    const item = activeList?.items.find((i) => i.id === itemId);
    if (!item) return;

    // Use the hook's toggleItem function which handles optimistic updates
    await apiToggleItem(itemId, !item.checked);
  };

  // Delete item - use API hook
  const deleteItem = async (itemId: string) => {
    try {
      await apiDeleteItem(itemId);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  // Calculate progress
  const totalItems = activeList?.items.length || 0;
  const checkedItems = activeList?.items.filter((item) => item.checked).length || 0;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* ================================================================ */}
        {/* HEADER */}
      {/* ================================================================== */}
      <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Back and title */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Back to dashboard">
                <Home className="h-5 w-5" />
              </Link>
            </Button>

            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Shopping Lists</h1>
              {activeList && (
                <Badge variant="secondary">
                  {checkedItems}/{totalItems} checked
                </Badge>
              )}
            </div>
          </div>

          {/* Right: Add button */}
          <Button onClick={() => setShowAddItemModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>
      </header>

      {/* ================================================================== */}
      {/* LIST TABS & FILTERS */}
      {/* ================================================================== */}
      <div className="flex-shrink-0 border-b border-border bg-card/50 px-4 py-2">
        <div className="flex items-center justify-between">
          {/* List tabs */}
          <div className="flex gap-2 items-center">
            {lists.map((list) => {
              const assignedMember = list.assignedTo
                ? familyMembers.find(m => m.id === list.assignedTo)
                : null;
              return (
                <Button
                  key={list.id}
                  variant={activeListId === list.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveListId(list.id)}
                  className="relative"
                >
                  {list.name}
                  {assignedMember && (
                    <span
                      className="ml-1.5 w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: assignedMember.color }}
                      title={`Assigned to ${assignedMember.name}`}
                    />
                  )}
                  <Badge variant="outline" className="ml-2 text-xs">
                    {list.items.length}
                  </Badge>
                </Button>
              );
            })}
            {/* Add New List button */}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const user = await requireAuth("Who's creating a list?");
                if (user) {
                  setEditingList(null);
                  setShowListModal(true);
                }
              }}
              className="border-dashed"
            >
              <Plus className="h-3 w-3 mr-1" />
              New List
            </Button>
          </div>

          {/* Right side: Edit list and show checked toggle */}
          <div className="flex gap-2">
            {activeList && (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const user = await requireAuth("Who's editing this list?");
                  if (user && user.role === 'parent') {
                    setEditingList(activeList);
                    setShowListModal(true);
                  } else if (user) {
                    alert('Only parents can edit list settings');
                  }
                }}
                title="Edit list settings"
              >
                <Settings className="h-4 w-4 mr-1" />
                Edit List
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowChecked(!showChecked)}
            >
              {showChecked ? 'Hide' : 'Show'} checked items
            </Button>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* PROGRESS */}
      {/* ================================================================== */}
      {activeList && totalItems > 0 && (
        <div className="flex-shrink-0 px-4 py-3 bg-card/30">
          <div className="max-w-4xl mx-auto">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center mt-2">
              {checkedItems} of {totalItems} items checked ({Math.round(progress)}%)
            </p>
          </div>
        </div>
      )}

      {/* ================================================================== */}
      {/* ITEM LIST */}
      {/* ================================================================== */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-4 opacity-50 animate-pulse" />
            <p>Loading shopping lists...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-destructive">Error: {error}</p>
            <p className="text-sm mt-2">Using demo data instead</p>
          </div>
        ) : !activeList || totalItems === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
            <p>No items on your list</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowAddItemModal(true)}
            >
              Add your first item
            </Button>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-4">
            {Object.entries(filteredItems).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 capitalize flex items-center gap-2">
                  <span>{getCategoryEmoji(category)}</span>
                  <span>{category}</span>
                </h3>
                <div className="space-y-1">
                  {(items as ShoppingItem[]).map((item) => (
                    <ShoppingItemRow
                      key={item.id}
                      item={item}
                      onToggle={() => toggleItem(item.id)}
                      onEdit={() => setEditingItem(item)}
                      onDelete={() => deleteItem(item.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && activeList && (
        <ItemModal
          listId={activeList.id}
          onClose={() => setShowAddItemModal(false)}
          onSave={async (item) => {
            try {
              await apiAddItem(activeList.id, {
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                category: item.category,
                notes: item.notes,
              });
              setShowAddItemModal(false);
            } catch (error) {
              console.error('Failed to add item:', error);
              alert('Failed to add item. Please try again.');
            }
          }}
        />
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <ItemModal
          listId={editingItem.listId}
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={async (updatedItem) => {
            try {
              // Update via API
              const response = await fetch(`/api/shopping-items/${editingItem.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: updatedItem.name,
                  quantity: updatedItem.quantity,
                  unit: updatedItem.unit,
                  category: updatedItem.category,
                  notes: updatedItem.notes,
                }),
              });

              if (!response.ok) {
                throw new Error('Failed to update item');
              }

              setEditingItem(null);
              // The hook will refresh the data automatically
            } catch (error) {
              console.error('Failed to update item:', error);
              alert('Failed to update item. Please try again.');
            }
          }}
        />
      )}

      {/* List Modal (Create/Edit) */}
      {showListModal && (
        <ListModal
          list={editingList}
          familyMembers={familyMembers}
          onClose={() => {
            setShowListModal(false);
            setEditingList(null);
          }}
          onSave={async (listData) => {
            try {
              if (editingList) {
                // Update existing list
                const response = await fetch(`/api/shopping-lists/${editingList.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(listData),
                });
                if (!response.ok) throw new Error('Failed to update list');
              } else {
                // Create new list
                const response = await fetch('/api/shopping-lists', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(listData),
                });
                if (!response.ok) throw new Error('Failed to create list');
                const newList = await response.json();
                setActiveListId(newList.id);
              }
              setShowListModal(false);
              setEditingList(null);
              refreshLists();
            } catch (error) {
              console.error('Failed to save list:', error);
              alert('Failed to save list. Please try again.');
            }
          }}
        />
      )}
      </div>
    </PageWrapper>
  );
}

/**
 * SHOPPING ITEM ROW COMPONENT
 */
function ShoppingItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const quantityDisplay = item.quantity
    ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
    : null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border border-border',
        'hover:bg-accent/30 transition-colors group',
        item.checked && 'opacity-60 bg-muted/30'
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={item.checked}
        onCheckedChange={onToggle}
        className="flex-shrink-0"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium',
              item.checked && 'line-through text-muted-foreground'
            )}
          >
            {item.name}
          </span>

          {quantityDisplay && (
            <Badge variant="secondary" className="text-xs">
              {quantityDisplay}
            </Badge>
          )}
        </div>

        {item.notes && (
          <p className="text-sm text-muted-foreground mt-0.5">{item.notes}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * GET CATEGORY EMOJI
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
 * LIST MODAL COMPONENT
 * For creating/editing shopping lists with user assignment
 */
function ListModal({
  list,
  familyMembers,
  onClose,
  onSave,
}: {
  list: ShoppingList | null;
  familyMembers: FamilyMember[];
  onClose: () => void;
  onSave: (data: { name: string; description?: string; assignedTo?: string }) => Promise<void>;
}) {
  const [name, setName] = useState(list?.name || '');
  const [description, setDescription] = useState(list?.description || '');
  const [assignedTo, setAssignedTo] = useState<string>(list?.assignedTo || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        assignedTo: assignedTo || undefined,
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
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {list ? 'Edit List' : 'Create New List'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

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
              {familyMembers.map((member) => (
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

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || saving}>
              {saving ? 'Saving...' : list ? 'Save Changes' : 'Create List'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * ITEM MODAL COMPONENT
 */
function ItemModal({
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
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
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
