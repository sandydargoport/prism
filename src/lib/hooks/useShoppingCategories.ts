'use client';

import { useState, useCallback } from 'react';
import { ALL_DEFAULT_CATEGORIES, type ShoppingCategoryPreset } from '@/lib/constants/shoppingPresets';
import { useFetchOnMount } from './useFetchOnMount';

// Re-export shared types and helpers for consumers
export type ShoppingCategoryDef = ShoppingCategoryPreset;
export { GROCERY_PRESET_IDS, GENERAL_PRESET_IDS, getPresetsForListType } from '@/lib/constants/shoppingPresets';

const EMOJI_POOL = ['🧴', '🥤', '🍿', '🧀', '🥚', '🍕', '🧹', '💊', '🐾', '🎁', '🍬', '🧃', '🥜', '🫒', '🌶️', '🍯'];

const COLOR_POOL = [
  '#EC4899', // pink
  '#14B8A6', // teal
  '#6366F1', // indigo
  '#84CC16', // lime
  '#F43F5E', // rose
  '#06B6D4', // cyan
  '#A855F7', // purple
  '#D97706', // amber darker
  '#10B981', // emerald
  '#0EA5E9', // sky
  '#E11D48', // rose-600
  '#7C3AED', // violet
];

export function useShoppingCategories() {
  const [categories, setCategories] = useState<ShoppingCategoryDef[]>(ALL_DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        const saved = data.settings?.shoppingCategories;
        if (Array.isArray(saved) && saved.length > 0) {
          // Filter to well-formed objects only, then backfill any missing defaults
          const valid = saved.filter(
            (c: unknown): c is ShoppingCategoryDef =>
              typeof c === 'object' && c !== null &&
              typeof (c as ShoppingCategoryDef).id === 'string' &&
              typeof (c as ShoppingCategoryDef).name === 'string'
          );
          const savedIds = new Set(valid.map(c => c.id));
          const missingDefaults = ALL_DEFAULT_CATEGORIES.filter(c => !savedIds.has(c.id));
          setCategories([...missingDefaults, ...valid]);
        }
      }
    } catch {
      // Use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useFetchOnMount(fetchCategories);

  const saveCategories = useCallback(async (newCategories: ShoppingCategoryDef[]) => {
    setCategories(newCategories);
    try {
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'shoppingCategories', value: newCategories }),
      });
    } catch {
      // Ignore save errors
    }
  }, []);

  const addCategory = useCallback(async (name: string) => {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (categories.some(c => c.id === id)) return null;

    // Pick next available emoji and color
    const usedEmojis = new Set(categories.map(c => c.emoji));
    const usedColors = new Set(categories.map(c => c.color));
    const emoji = EMOJI_POOL.find(e => !usedEmojis.has(e)) ?? EMOJI_POOL[categories.length % EMOJI_POOL.length] ?? '🛒';
    const color = COLOR_POOL.find(c => !usedColors.has(c)) ?? COLOR_POOL[categories.length % COLOR_POOL.length] ?? '#3B82F6';

    const newCat: ShoppingCategoryDef = { id, name, emoji, color };
    const updated = [...categories, newCat];
    await saveCategories(updated);
    return newCat;
  }, [categories, saveCategories]);

  const updateCategory = useCallback(async (categoryId: string, updates: Partial<Omit<ShoppingCategoryDef, 'id'>>) => {
    const updated = categories.map(c =>
      c.id === categoryId ? { ...c, ...updates } : c
    );
    await saveCategories(updated);
  }, [categories, saveCategories]);

  const removeCategory = useCallback(async (categoryId: string) => {
    const updated = categories.filter(c => c.id !== categoryId);
    await saveCategories(updated);
  }, [categories, saveCategories]);

  const reorderCategories = useCallback(async (newOrder: ShoppingCategoryDef[]) => {
    await saveCategories(newOrder);
  }, [saveCategories]);

  const getCategoryEmoji = useCallback((categoryId: string): string => {
    return categories.find(c => c.id === categoryId)?.emoji || '🛒';
  }, [categories]);

  const getCategoryColor = useCallback((categoryId: string): string => {
    return categories.find(c => c.id === categoryId)?.color || '#3B82F6';
  }, [categories]);

  return {
    categories,
    loading,
    addCategory,
    updateCategory,
    removeCategory,
    reorderCategories,
    getCategoryEmoji,
    getCategoryColor,
    refresh: fetchCategories,
  };
}
