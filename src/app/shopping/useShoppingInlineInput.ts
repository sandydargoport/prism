'use client';

import { useState, KeyboardEvent, FocusEvent } from 'react';
import { toast } from '@/components/ui/use-toast';

const BASE_EMPTY_LINES = 6;

interface UseShoppingInlineInputProps {
  activeList: { id: string } | null | undefined;
  requireAuth: (prompt: string) => Promise<{ id: string; role: string } | null>;
  apiAddItem: (listId: string, data: { name: string; category: string }) => Promise<unknown>;
}

export { BASE_EMPTY_LINES };

export function useShoppingInlineInput({
  activeList,
  requireAuth,
  apiAddItem,
}: UseShoppingInlineInputProps) {
  const [inlineInputs, setInlineInputs] = useState<Record<string, string>>({});
  const [extraRows, setExtraRows] = useState<Record<string, number>>({});

  const handleInlineAdd = async (category: string) => {
    const name = inlineInputs[category]?.trim();
    if (!name || !activeList) return;

    const user = await requireAuth("Who's adding an item?");
    if (!user) return;

    try {
      await apiAddItem(activeList.id, {
        name,
        category,
      });
      setInlineInputs(prev => ({ ...prev, [category]: '' }));
    } catch (err) {
      console.error('Failed to add item:', err);
      toast({ title: 'Failed to add item. Please try again.', variant: 'destructive' });
    }
  };

  const handleInlineKeyDown = (e: KeyboardEvent<HTMLInputElement>, category: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineAdd(category);
    }
  };

  const handleInlineBlur = (e: FocusEvent<HTMLInputElement>, category: string) => {
    handleInlineAdd(category);
  };

  const addExtraRows = (category: string, count: number) => {
    setExtraRows(prev => {
      const current = prev[category] || 0;
      const newValue = Math.max(-BASE_EMPTY_LINES + 1, current + count);
      return { ...prev, [category]: newValue };
    });
  };

  return {
    inlineInputs,
    setInlineInputs,
    extraRows,
    handleInlineAdd,
    handleInlineKeyDown,
    handleInlineBlur,
    addExtraRows,
  };
}
