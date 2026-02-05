'use client';

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
import { PageWrapper } from '@/components/layout';
import { ShoppingItemRow } from '@/app/shopping/ShoppingItemRow';
import { ItemModal } from '@/app/shopping/ItemModal';
import { ListModal } from '@/app/shopping/ListModal';
import { useShoppingViewData } from './useShoppingViewData';
import type { ShoppingItem } from '@/types';

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

export function ShoppingView() {
  const {
    lists, loading, error, refreshLists, familyMembers,
    requireAuth, apiAddItem,
    activeListId, setActiveListId,
    showChecked, setShowChecked,
    showAddItemModal, setShowAddItemModal,
    editingItem, setEditingItem,
    showListModal, setShowListModal,
    editingList, setEditingList,
    activeList, filteredItems,
    toggleItem, deleteItem,
    totalItems, checkedItems, progress,
  } = useShoppingViewData();

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/" aria-label="Back to dashboard"><Home className="h-5 w-5" /></Link>
              </Button>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Shopping Lists</h1>
                {activeList && <Badge variant="secondary">{checkedItems}/{totalItems} checked</Badge>}
              </div>
            </div>
            <Button onClick={() => setShowAddItemModal(true)}>
              <Plus className="h-4 w-4 mr-1" />Add Item
            </Button>
          </div>
        </header>

        <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex gap-2 items-center">
              {lists.map((list) => {
                const assignedMember = list.assignedTo ? familyMembers.find(m => m.id === list.assignedTo) : null;
                return (
                  <Button key={list.id} variant={activeListId === list.id ? 'secondary' : 'ghost'} size="sm"
                    onClick={() => setActiveListId(list.id)} className="relative">
                    {list.name}
                    {assignedMember && (
                      <span className="ml-1.5 w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: assignedMember.color }} title={`Assigned to ${assignedMember.name}`} />
                    )}
                    <Badge variant="outline" className="ml-2 text-xs">{list.items.length}</Badge>
                  </Button>
                );
              })}
              <Button variant="outline" size="sm" className="border-dashed"
                onClick={async () => {
                  const user = await requireAuth("Who's creating a list?");
                  if (user) { setEditingList(null); setShowListModal(true); }
                }}>
                <Plus className="h-3 w-3 mr-1" />New List
              </Button>
            </div>
            <div className="flex gap-2">
              {activeList && (
                <Button variant="ghost" size="sm" title="Edit list settings"
                  onClick={async () => {
                    const user = await requireAuth("Who's editing this list?");
                    if (user && user.role === 'parent') { setEditingList(activeList); setShowListModal(true); }
                    else if (user) alert('Only parents can edit list settings');
                  }}>
                  <Settings className="h-4 w-4 mr-1" />Edit List
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setShowChecked(!showChecked)}>
                {showChecked ? 'Hide' : 'Show'} checked items
              </Button>
            </div>
          </div>
        </div>

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

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50 animate-pulse" /><p>Loading shopping lists...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-destructive">Error: {error}</p>
              <p className="text-sm mt-2">Please check your connection</p>
            </div>
          ) : !activeList || totalItems === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50" /><p>No items on your list</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddItemModal(true)}>Add your first item</Button>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-4">
              {Object.entries(filteredItems).map(([category, items]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2 capitalize flex items-center gap-2">
                    <span>{getCategoryEmoji(category)}</span><span>{category}</span>
                  </h3>
                  <div className="space-y-1">
                    {(items as ShoppingItem[]).map((item) => (
                      <ShoppingItemRow key={item.id} item={item}
                        onToggle={() => toggleItem(item.id)}
                        onEdit={() => setEditingItem(item)}
                        onDelete={() => deleteItem(item.id)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showAddItemModal && activeList && (
          <ItemModal listId={activeList.id} lists={lists}
            onClose={() => setShowAddItemModal(false)}
            onSave={async (item) => {
              try {
                await apiAddItem(item.listId, {
                  name: item.name, quantity: item.quantity ?? undefined,
                  unit: item.unit ?? undefined, category: item.category ?? undefined,
                  notes: item.notes ?? undefined,
                });
                setShowAddItemModal(false);
                if (item.listId !== activeList.id) setActiveListId(item.listId);
              } catch (err) {
                console.error('Failed to add item:', err);
                alert('Failed to add item. Please try again.');
              }
            }} />
        )}

        {editingItem && (
          <ItemModal listId={editingItem.listId} item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={async (updatedItem) => {
              try {
                const response = await fetch(`/api/shopping-items/${editingItem.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: updatedItem.name, quantity: updatedItem.quantity,
                    unit: updatedItem.unit, category: updatedItem.category, notes: updatedItem.notes,
                  }),
                });
                if (!response.ok) throw new Error('Failed to update item');
                setEditingItem(null);
              } catch (err) {
                console.error('Failed to update item:', err);
                alert('Failed to update item. Please try again.');
              }
            }} />
        )}

        {showListModal && (
          <ListModal list={editingList} familyMembers={familyMembers}
            onClose={() => { setShowListModal(false); setEditingList(null); }}
            onSave={async (listData) => {
              try {
                if (editingList) {
                  const response = await fetch(`/api/shopping-lists/${editingList.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(listData),
                  });
                  if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || 'Failed to update list');
                  }
                } else {
                  const response = await fetch('/api/shopping-lists', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(listData),
                  });
                  if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || 'Failed to create list');
                  }
                  const newList = await response.json();
                  setActiveListId(newList.id);
                }
                setShowListModal(false);
                setEditingList(null);
                refreshLists();
              } catch (err) {
                console.error('Failed to save list:', err);
                alert(err instanceof Error ? err.message : 'Failed to save list. Please try again.');
              }
            }} />
        )}
      </div>
    </PageWrapper>
  );
}
