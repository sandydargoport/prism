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
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useShoppingLists } from '@/lib/hooks';
import { PageWrapper } from '@/components/layout';
import { useAuth } from '@/components/providers';
import { ShoppingItemRow } from '@/app/shopping/ShoppingItemRow';
import { ItemModal } from '@/app/shopping/ItemModal';
import { ListModal } from '@/app/shopping/ListModal';
import type { ShoppingItem, ShoppingList, FamilyMember } from '@/types';

export function getCategoryEmoji(category: string): string {
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

  const lists = apiLists;

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
    if (!activeList) return {};
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
        {/* HEADER */}
      <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between">
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

          <Button onClick={() => setShowAddItemModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </Button>
        </div>
      </header>

      {/* LIST TABS & FILTERS */}
      <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center justify-between">
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

      {/* PROGRESS */}
      {activeList && totalItems > 0 && (
        <div className="flex-shrink-0 px-4 py-3 bg-card/85 backdrop-blur-sm">
          <div className="max-w-4xl mx-auto">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center mt-2">
              {checkedItems} of {totalItems} items checked ({Math.round(progress)}%)
            </p>
          </div>
        </div>
      )}

      {/* ITEM LIST */}
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
            <p className="text-sm mt-2">Please check your connection</p>
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
                quantity: item.quantity ?? undefined,
                unit: item.unit ?? undefined,
                category: item.category ?? undefined,
                notes: item.notes ?? undefined,
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
