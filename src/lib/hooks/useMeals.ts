/**
 * ============================================================================
 * PRISM - useMeals Hook
 * ============================================================================
 *
 * Provides a React hook for fetching and managing meal plans.
 *
 * ============================================================================
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

// Re-export Meal type from shared types for consumers that import from this hook
export type { Meal } from '@/types';
import type { Meal } from '@/types';

interface UseMealsOptions {
  /** Filter by week (YYYY-MM-DD format) */
  weekOf?: string;
  /** Auto-refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
}

interface UseMealsResult {
  meals: Meal[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markCooked: (mealId: string, cookedBy?: string) => Promise<void>;
}

/**
 * Hook for fetching meals from the API
 */
export function useMeals(options: UseMealsOptions = {}): UseMealsResult {
  const {
    weekOf,
    refreshInterval = 5 * 60 * 1000,
  } = options;

  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch meals from the API
   */
  const fetchMeals = useCallback(async () => {
    try {
      setError(null);

      const params = new URLSearchParams();
      if (weekOf) params.set('weekOf', weekOf);

      const response = await fetch(`/api/meals?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch meals');
      }

      const data = await response.json();

      // Transform API response to Meal format
      const transformedMeals: Meal[] = data.meals.map(
        (meal: {
          id: string;
          name: string;
          description: string | null;
          recipe: string | null;
          recipeUrl: string | null;
          prepTime: number | null;
          cookTime: number | null;
          servings: number | null;
          ingredients: string | null;
          weekOf: string;
          dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
          mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
          cookedAt: string | null;
          cookedBy: {
            id: string;
            name: string;
            color: string;
          } | null;
          createdBy: {
            id: string;
            name: string;
            color: string;
          } | null;
          createdAt: string;
        }) => ({
          id: meal.id,
          name: meal.name,
          description: meal.description || undefined,
          recipe: meal.recipe || undefined,
          recipeUrl: meal.recipeUrl || undefined,
          prepTime: meal.prepTime || undefined,
          cookTime: meal.cookTime || undefined,
          servings: meal.servings || undefined,
          ingredients: meal.ingredients || undefined,
          weekOf: meal.weekOf,
          dayOfWeek: meal.dayOfWeek,
          mealType: meal.mealType,
          cookedAt: meal.cookedAt ? new Date(meal.cookedAt) : undefined,
          cookedBy: meal.cookedBy || undefined,
          createdBy: meal.createdBy || undefined,
          createdAt: new Date(meal.createdAt),
        })
      );

      setMeals(transformedMeals);
    } catch (err) {
      console.error('Error fetching meals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch meals');
    } finally {
      setLoading(false);
    }
  }, [weekOf]);

  /**
   * Mark a meal as cooked
   */
  const markCooked = useCallback(
    async (mealId: string, cookedBy?: string) => {
      try {
        const response = await fetch(`/api/meals/${mealId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cookedAt: new Date().toISOString(),
            cookedBy: cookedBy || null,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to mark meal as cooked');
        }

        // Refresh to get updated state
        await fetchMeals();
      } catch (err) {
        console.error('Error marking meal as cooked:', err);
        throw err;
      }
    },
    [fetchMeals]
  );

  // Initial fetch
  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  // Set up refresh interval with visibility-based pause
  useVisibilityPolling(fetchMeals, refreshInterval);

  return {
    meals,
    loading,
    error,
    refresh: fetchMeals,
    markCooked,
  };
}
