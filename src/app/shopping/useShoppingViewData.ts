'use client';

import { useState, useMemo } from 'react';
import { useShoppingLists } from '@/lib/hooks';
import { useAuth, useFamily } from '@/components/providers';
import type { ShoppingItem, ShoppingList } from '@/types';

export function useShoppingViewData() {
  const { requireAuth } = useAuth();

  const {
    lists,
    loading,
    error,
    refresh: refreshLists,
    toggleItem: apiToggleItem,
    addItem: apiAddItem,
    deleteItem: apiDeleteItem,
  } = useShoppingLists({});

  const { members: familyMembers } = useFamily();

  const [activeListId, setActiveListId] = useState(lists[0]?.id || '');
  const [showChecked, setShowChecked] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [showListModal, setShowListModal] = useState(false);
  const [editingList, setEditingList] = useState<ShoppingList | null>(null);

  const activeList = lists.find((l) => l.id === activeListId) || lists[0];

  const filteredItems = useMemo(() => {
    if (!activeList) return {};
    let items = [...activeList.items];
    if (!showChecked) {
      items = items.filter((item) => !item.checked);
    }
    return items.reduce((acc, item) => {
      const category = item.category || 'other';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {} as Record<string, ShoppingItem[]>);
  }, [activeList, showChecked]);

  const toggleItem = async (itemId: string) => {
    const item = activeList?.items.find((i) => i.id === itemId);
    if (!item) return;
    await apiToggleItem(itemId, !item.checked);
  };

  const deleteItem = async (itemId: string) => {
    try {
      await apiDeleteItem(itemId);
    } catch (err) {
      console.error('Error deleting item:', err);
    }
  };

  const totalItems = activeList?.items.length || 0;
  const checkedItems = activeList?.items.filter((item) => item.checked).length || 0;
  const progress = totalItems > 0 ? (checkedItems / totalItems) * 100 : 0;

  return {
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
  };
}
