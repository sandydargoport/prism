'use client';

import { useState, useCallback, useEffect } from 'react';

interface RecipeIngredient {
  text: string;
  name?: string;
  amount?: string;
  unit?: string;
  notes?: string;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string | null;
  url?: string | null;
  sourceType: 'manual' | 'url_import' | 'paprika_import';
  ingredients: RecipeIngredient[];
  instructions?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  tags: string[];
  cuisine?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  notes?: string | null;
  timesMade: number;
  lastMadeAt?: string | null;
  isFavorite: boolean;
  createdBy?: string | null;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RecipesResponse {
  recipes: Recipe[];
  total: number;
  limit: number;
  offset: number;
}

interface UseRecipesOptions {
  search?: string;
  category?: string;
  cuisine?: string;
  favorite?: boolean;
  limit?: number;
  offset?: number;
}

interface CreateRecipeInput {
  name: string;
  description?: string | null;
  url?: string | null;
  ingredients?: RecipeIngredient[];
  instructions?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  servings?: number | null;
  tags?: string[];
  cuisine?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  notes?: string | null;
  isFavorite?: boolean;
}

interface UpdateRecipeInput extends Partial<CreateRecipeInput> {
  timesMade?: number;
  lastMadeAt?: string | null;
}

export function useRecipes(options: UseRecipesOptions = {}) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecipes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options.search) params.set('search', options.search);
      if (options.category) params.set('category', options.category);
      if (options.cuisine) params.set('cuisine', options.cuisine);
      if (options.favorite) params.set('favorite', 'true');
      if (options.limit) params.set('limit', options.limit.toString());
      if (options.offset) params.set('offset', options.offset.toString());

      const url = `/api/recipes${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error('Failed to fetch recipes');
      }

      const data: RecipesResponse = await res.json();
      setRecipes(data.recipes);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [options.search, options.category, options.cuisine, options.favorite, options.limit, options.offset]);

  useEffect(() => {
    fetchRecipes();
  }, [fetchRecipes]);

  const createRecipe = useCallback(async (input: CreateRecipeInput): Promise<Recipe> => {
    const res = await fetch('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to create recipe');
    }

    const newRecipe = await res.json();
    setRecipes(prev => [newRecipe, ...prev]);
    setTotal(prev => prev + 1);
    return newRecipe;
  }, []);

  const updateRecipe = useCallback(async (id: string, updates: UpdateRecipeInput): Promise<Recipe> => {
    const res = await fetch(`/api/recipes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update recipe');
    }

    const updated = await res.json();
    setRecipes(prev => prev.map(r => r.id === id ? updated : r));
    return updated;
  }, []);

  const deleteRecipe = useCallback(async (id: string): Promise<void> => {
    const res = await fetch(`/api/recipes/${id}`, {
      method: 'DELETE',
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to delete recipe');
    }

    setRecipes(prev => prev.filter(r => r.id !== id));
    setTotal(prev => prev - 1);
  }, []);

  const importFromUrl = useCallback(async (url: string, preview = false): Promise<Recipe | { preview: true; recipe: Partial<Recipe> }> => {
    const res = await fetch('/api/recipes/import-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, preview }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to import recipe');
    }

    const data = await res.json();

    if (!preview && !data.preview) {
      setRecipes(prev => [data, ...prev]);
      setTotal(prev => prev + 1);
    }

    return data;
  }, []);

  const importFromPaprika = useCallback(async (html: string, preview = false): Promise<{ imported?: number; recipes: Recipe[] } | { preview: true; count: number; recipes: Partial<Recipe>[] }> => {
    const res = await fetch('/api/recipes/import-paprika', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html, preview }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to import Paprika recipes');
    }

    const data = await res.json();

    if (!preview && data.recipes) {
      setRecipes(prev => [...data.recipes, ...prev]);
      setTotal(prev => prev + data.imported);
    }

    return data;
  }, []);

  const toggleFavorite = useCallback(async (id: string): Promise<Recipe> => {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) throw new Error('Recipe not found');

    return updateRecipe(id, { isFavorite: !recipe.isFavorite });
  }, [recipes, updateRecipe]);

  const markAsMade = useCallback(async (id: string): Promise<Recipe> => {
    const recipe = recipes.find(r => r.id === id);
    if (!recipe) throw new Error('Recipe not found');

    return updateRecipe(id, {
      timesMade: recipe.timesMade + 1,
      lastMadeAt: new Date().toISOString(),
    });
  }, [recipes, updateRecipe]);

  return {
    recipes,
    total,
    loading,
    error,
    refresh: fetchRecipes,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    importFromUrl,
    importFromPaprika,
    toggleFavorite,
    markAsMade,
  };
}

export default useRecipes;
