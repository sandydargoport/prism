'use client';

import { useState, useRef, useCallback } from 'react';
import type { ShoppingCategoryDef } from '@/lib/hooks/useShoppingCategories';

interface UseShoppingDragReorderProps {
  categoryOrder: string[];
  dynamicCategories: ShoppingCategoryDef[];
  reorderCategories: (categories: ShoppingCategoryDef[]) => void;
}

export function useShoppingDragReorder({
  categoryOrder,
  dynamicCategories,
  reorderCategories,
}: UseShoppingDragReorderProps) {
  const [draggedCategory, setDraggedCategory] = useState<string | null>(null);

  const saveCategoryOrder = useCallback((order: string[]) => {
    const reordered = order.map(id => dynamicCategories.find(c => c.id === id)).filter(Boolean) as typeof dynamicCategories;
    reorderCategories(reordered);
  }, [dynamicCategories, reorderCategories]);

  const handleDragStart = useCallback((category: string) => {
    setDraggedCategory(category);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetCategory: string) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === targetCategory) return;

    const newOrder = [...categoryOrder];
    const draggedIndex = newOrder.indexOf(draggedCategory);
    const targetIndex = newOrder.indexOf(targetCategory);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedCategory);
      saveCategoryOrder(newOrder);
    }
  }, [draggedCategory, categoryOrder, saveCategoryOrder]);

  const handleDragEnd = useCallback(() => {
    setDraggedCategory(null);
  }, []);

  // Touch drags come through useLongPressDrag on each card (press-and-hold,
  // like meals). The dragged id is also kept in a ref: the first move can
  // arrive before React has re-rendered with the new state.
  const touchDraggedRef = useRef<string | null>(null);

  const startTouchDrag = useCallback((category: string) => {
    touchDraggedRef.current = category;
    setDraggedCategory(category);
  }, []);

  const moveTouchDrag = useCallback((x: number, y: number) => {
    const dragged = touchDraggedRef.current;
    if (!dragged || typeof document.elementsFromPoint !== 'function') return;
    for (const el of document.elementsFromPoint(x, y)) {
      const target = el.getAttribute('data-category');
      if (!target) continue;
      if (target !== dragged) {
        const newOrder = [...categoryOrder];
        const draggedIndex = newOrder.indexOf(dragged);
        const targetIndex = newOrder.indexOf(target);
        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
          newOrder.splice(draggedIndex, 1);
          newOrder.splice(targetIndex, 0, dragged);
          saveCategoryOrder(newOrder);
        }
      }
      break;
    }
  }, [categoryOrder, saveCategoryOrder]);

  const endTouchDrag = useCallback(() => {
    touchDraggedRef.current = null;
    setDraggedCategory(null);
  }, []);

  return {
    draggedCategory,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    startTouchDrag,
    moveTouchDrag,
    endTouchDrag,
  };
}
