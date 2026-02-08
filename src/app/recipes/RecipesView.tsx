'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  ChefHat,
  Plus,
  Search,
  Heart,
  Clock,
  Users,
  ExternalLink,
  Trash2,
  Edit2,
  X,
  Link2,
  FileUp,
  Star,
  Check,
  Home,
  Filter,
  ShoppingCart,
  Minus,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageWrapper } from '@/components/layout';
import { useRecipes, type Recipe } from '@/lib/hooks/useRecipes';
import { useShoppingLists } from '@/lib/hooks/useShoppingLists';
import { useAuth } from '@/components/providers';

type ViewMode = 'all' | 'favorites';

export function RecipesView() {
  const { requireAuth } = useAuth();
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [filterCuisine, setFilterCuisine] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportUrlModal, setShowImportUrlModal] = useState(false);
  const [showImportPaprikaModal, setShowImportPaprikaModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const handleAddWithAuth = async () => {
    const user = await requireAuth('Add Recipe', 'Please log in to add a recipe');
    if (!user) return;
    setShowAddModal(true);
  };

  const handleImportUrlWithAuth = async () => {
    const user = await requireAuth('Import Recipe', 'Please log in to import a recipe');
    if (!user) return;
    setShowImportUrlModal(true);
  };

  const handleImportPaprikaWithAuth = async () => {
    const user = await requireAuth('Import Recipes', 'Please log in to import recipes');
    if (!user) return;
    setShowImportPaprikaModal(true);
  };

  const { recipes, loading, error, deleteRecipe, toggleFavorite, importFromUrl, importFromPaprika, createRecipe, updateRecipe } = useRecipes({
    favorite: viewMode === 'favorites' ? true : undefined,
  });

  const { lists: shoppingLists, addItem: addShoppingItem } = useShoppingLists();

  // Keep selectedRecipe in sync with recipes array (for favorite toggle, etc.)
  useEffect(() => {
    if (selectedRecipe) {
      const updated = recipes.find((r) => r.id === selectedRecipe.id);
      if (updated && updated.isFavorite !== selectedRecipe.isFavorite) {
        setSelectedRecipe(updated);
      }
    }
  }, [recipes, selectedRecipe]);

  // Get unique cuisines and categories for filters
  const cuisines = useMemo(() => {
    const unique = new Set(recipes.map(r => r.cuisine).filter(Boolean));
    return Array.from(unique).sort() as string[];
  }, [recipes]);

  const categories = useMemo(() => {
    const unique = new Set(recipes.map(r => r.category).filter(Boolean));
    return Array.from(unique).sort() as string[];
  }, [recipes]);

  const filteredRecipes = useMemo(() => {
    let result = recipes;

    if (search.trim()) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(searchLower) ||
          r.description?.toLowerCase().includes(searchLower) ||
          r.cuisine?.toLowerCase().includes(searchLower) ||
          r.category?.toLowerCase().includes(searchLower)
      );
    }

    if (filterCuisine) {
      result = result.filter((r) => r.cuisine === filterCuisine);
    }

    if (filterCategory) {
      result = result.filter((r) => r.category === filterCategory);
    }

    return result;
  }, [recipes, search, filterCuisine, filterCategory]);

  const handleDelete = async (recipe: Recipe) => {
    if (!confirm(`Delete "${recipe.name}"? This cannot be undone.`)) return;
    try {
      await deleteRecipe(recipe.id);
      setSelectedRecipe(null);
    } catch (err) {
      alert('Failed to delete recipe');
    }
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/" aria-label="Back to dashboard">
                  <Home className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                <ChefHat className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Recipes</h1>
                <Badge variant="secondary">{recipes.length} recipes</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleImportUrlWithAuth}>
                <Link2 className="h-4 w-4 mr-1" />
                Import URL
              </Button>
              <Button variant="outline" onClick={handleImportPaprikaWithAuth}>
                <FileUp className="h-4 w-4 mr-1" />
                Import Paprika
              </Button>
              <Button onClick={handleAddWithAuth}>
                <Plus className="h-4 w-4 mr-1" />
                Add Recipe
              </Button>
            </div>
          </div>
        </header>

        {/* Filters */}
        <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-md min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search recipes..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={viewMode === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('all')}
              >
                All
              </Button>
              <Button
                variant={viewMode === 'favorites' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('favorites')}
              >
                <Heart className="h-4 w-4 mr-1" />
                Favorites
              </Button>
            </div>
            {cuisines.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Cuisine:</span>
                <select
                  value={filterCuisine || ''}
                  onChange={(e) => setFilterCuisine(e.target.value || null)}
                  className="text-sm bg-card text-foreground border border-border rounded px-2 py-1"
                >
                  <option value="">All</option>
                  {cuisines.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            {categories.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Category:</span>
                <select
                  value={filterCategory || ''}
                  onChange={(e) => setFilterCategory(e.target.value || null)}
                  className="text-sm bg-card text-foreground border border-border rounded px-2 py-1"
                >
                  <option value="">All</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            )}
            {(filterCuisine || filterCategory) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setFilterCuisine(null); setFilterCategory(null); }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : filteredRecipes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? 'No recipes match your search' : 'No recipes yet. Add your first recipe!'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  onClick={() => setSelectedRecipe(recipe)}
                  onToggleFavorite={() => toggleFavorite(recipe.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          shoppingLists={shoppingLists.map((l) => ({ id: l.id, name: l.name }))}
          onClose={() => setSelectedRecipe(null)}
          onEdit={() => {
            setShowEditModal(true);
          }}
          onDelete={() => handleDelete(selectedRecipe)}
          onToggleFavorite={() => toggleFavorite(selectedRecipe.id)}
          onAddToShoppingList={async (listId, ingredients) => {
            for (const ing of ingredients) {
              await addShoppingItem(listId, { name: ing.text });
            }
          }}
        />
      )}

      {/* Add Recipe Modal */}
      {showAddModal && (
        <RecipeFormModal
          onClose={() => setShowAddModal(false)}
          onSave={async (data) => {
            await createRecipe(data);
            setShowAddModal(false);
          }}
        />
      )}

      {/* Edit Recipe Modal */}
      {showEditModal && selectedRecipe && (
        <RecipeFormModal
          recipe={selectedRecipe}
          onClose={() => setShowEditModal(false)}
          onSave={async (data) => {
            await updateRecipe(selectedRecipe.id, data);
            setShowEditModal(false);
            setSelectedRecipe(null);
          }}
        />
      )}

      {/* Import URL Modal */}
      {showImportUrlModal && (
        <ImportUrlModal
          onClose={() => setShowImportUrlModal(false)}
          onImport={importFromUrl}
        />
      )}

      {/* Import Paprika Modal */}
      {showImportPaprikaModal && (
        <ImportPaprikaModal
          onClose={() => setShowImportPaprikaModal(false)}
          onImport={importFromPaprika}
        />
      )}
    </PageWrapper>
  );
}

interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  onToggleFavorite: () => void;
}

function RecipeCard({ recipe, onClick, onToggleFavorite }: RecipeCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
      onClick={onClick}
    >
      {recipe.imageUrl && (
        <div className="h-40 bg-muted overflow-hidden">
          <img
            src={recipe.imageUrl}
            alt={recipe.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <CardContent className={cn('p-4', !recipe.imageUrl && 'pt-4')}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold line-clamp-2">{recipe.name}</h3>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            className="flex-shrink-0"
          >
            <Heart
              className={cn(
                'h-5 w-5 transition-colors',
                recipe.isFavorite
                  ? 'fill-red-500 text-red-500'
                  : 'text-muted-foreground hover:text-red-500'
              )}
            />
          </button>
        </div>

        {recipe.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {recipe.description}
          </p>
        )}

        <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
          {(recipe.prepTime || recipe.cookTime) && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {(recipe.prepTime || 0) + (recipe.cookTime || 0)} min
            </span>
          )}
          {recipe.servings && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {recipe.servings}
            </span>
          )}
          {recipe.timesMade > 0 && (
            <span className="flex items-center gap-1">
              <Check className="h-3 w-3" />
              Made {recipe.timesMade}x
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {recipe.cuisine && (
            <Badge variant="outline" className="text-xs">
              {recipe.cuisine}
            </Badge>
          )}
          {recipe.category && (
            <Badge variant="outline" className="text-xs">
              {recipe.category}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface ShoppingListOption {
  id: string;
  name: string;
}

interface RecipeDetailModalProps {
  recipe: Recipe;
  shoppingLists: ShoppingListOption[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onAddToShoppingList: (listId: string, ingredients: Array<{ text: string }>) => Promise<void>;
}

function RecipeDetailModal({
  recipe,
  shoppingLists,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
  onAddToShoppingList,
}: RecipeDetailModalProps) {
  const [desiredServings, setDesiredServings] = useState(recipe.servings || 1);
  const [showListPicker, setShowListPicker] = useState(false);
  const [addingToList, setAddingToList] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());

  const handleClose = () => {
    setCheckedIngredients(new Set());
    onClose();
  };

  const toggleIngredient = (index: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const scaleFactor = recipe.servings ? desiredServings / recipe.servings : 1;

  // Scale ingredient text by adjusting numbers
  const scaleIngredient = (text: string): string => {
    if (scaleFactor === 1) return text;
    // Match numbers (including fractions like 1/2, decimals like 1.5)
    return text.replace(/(\d+\/\d+|\d+\.?\d*)/g, (match) => {
      if (match.includes('/')) {
        const parts = match.split('/').map(Number);
        const num = parts[0] ?? 0;
        const denom = parts[1] ?? 1;
        const scaled = (num / denom) * scaleFactor;
        // Return as fraction if close to common fractions, otherwise decimal
        if (Math.abs(scaled - 0.25) < 0.01) return '1/4';
        if (Math.abs(scaled - 0.33) < 0.01) return '1/3';
        if (Math.abs(scaled - 0.5) < 0.01) return '1/2';
        if (Math.abs(scaled - 0.67) < 0.01) return '2/3';
        if (Math.abs(scaled - 0.75) < 0.01) return '3/4';
        return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
      }
      const scaled = parseFloat(match) * scaleFactor;
      return scaled % 1 === 0 ? scaled.toString() : scaled.toFixed(1);
    });
  };

  const handleAddToList = async (listId: string) => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return;
    setAddingToList(true);
    try {
      // Scale ingredients before adding
      const scaledIngredients = recipe.ingredients.map((ing) => ({
        text: scaleIngredient(ing.text),
      }));
      await onAddToShoppingList(listId, scaledIngredients);
      setShowListPicker(false);
      alert(`Added ${scaledIngredients.length} ingredients to shopping list!`);
    } catch {
      alert('Failed to add ingredients to shopping list');
    } finally {
      setAddingToList(false);
    }
  };

  return (
    <Dialog open onOpenChange={handleClose}>
      <DialogContent className={cn(
        'overflow-y-auto',
        isMaximized
          ? 'max-w-[95vw] max-h-[95vh] w-[95vw] h-[95vh]'
          : 'max-w-2xl max-h-[90vh]'
      )}>
        <DialogHeader>
          <div className="flex items-start justify-between pr-8">
            <DialogTitle className="text-xl">{recipe.name}</DialogTitle>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
                title={isMaximized ? 'Restore' : 'Maximize'}
              >
                {isMaximized ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
              <button
                onClick={onToggleFavorite}
                className="p-1"
                title={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Heart
                  className={cn(
                    'h-5 w-5 transition-colors',
                    recipe.isFavorite
                      ? 'fill-red-500 text-red-500'
                      : 'text-muted-foreground hover:text-red-500'
                  )}
                />
              </button>
            </div>
          </div>
        </DialogHeader>

        {recipe.imageUrl && (
          <div className="h-48 -mx-6 -mt-2 bg-muted overflow-hidden">
            <img
              src={recipe.imageUrl}
              alt={recipe.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="space-y-4">
          {recipe.description && (
            <p className="text-muted-foreground">{recipe.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm items-center">
            {recipe.prepTime && (
              <div>
                <span className="text-muted-foreground">Prep:</span>{' '}
                {recipe.prepTime} min
              </div>
            )}
            {recipe.cookTime && (
              <div>
                <span className="text-muted-foreground">Cook:</span>{' '}
                {recipe.cookTime} min
              </div>
            )}
            {recipe.servings && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Servings:</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setDesiredServings(Math.max(1, desiredServings - 1))}
                    disabled={desiredServings <= 1}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{desiredServings}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setDesiredServings(desiredServings + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {scaleFactor !== 1 && (
                  <span className="text-xs text-muted-foreground">
                    (scaled {scaleFactor > 1 ? 'up' : 'down'})
                  </span>
                )}
              </div>
            )}
            {recipe.timesMade > 0 && (
              <div>
                <span className="text-muted-foreground">Made:</span>{' '}
                {recipe.timesMade} time{recipe.timesMade !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Ingredients</h4>
                {shoppingLists.length > 0 && recipe.ingredients.length > 0 && (
                  <div className="relative">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowListPicker(!showListPicker)}
                      disabled={addingToList}
                    >
                      <ShoppingCart className="h-3 w-3 mr-1" />
                      Add to Shopping List
                      <ChevronDown className="h-3 w-3 ml-1" />
                    </Button>
                    {showListPicker && (
                      <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-md shadow-lg z-10 min-w-[150px]">
                        {shoppingLists.map((list) => (
                          <button
                            key={list.id}
                            onClick={() => handleAddToList(list.id)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-accent first:rounded-t-md last:rounded-b-md"
                          >
                            {list.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <ul className="space-y-1">
                {recipe.ingredients.map((ing, i) => (
                  <li
                    key={i}
                    onClick={() => toggleIngredient(i)}
                    className={cn(
                      'text-sm flex items-start gap-2 cursor-pointer select-none hover:bg-accent/50 rounded px-1 -mx-1 transition-colors',
                      checkedIngredients.has(i) && 'line-through text-muted-foreground'
                    )}
                  >
                    <span className="text-muted-foreground">•</span>
                    {scaleIngredient(ing.text)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {recipe.instructions && (
            <div>
              <h4 className="font-semibold mb-2">Instructions</h4>
              <div className="text-sm whitespace-pre-wrap">{recipe.instructions}</div>
            </div>
          )}

          {recipe.notes && (
            <div>
              <h4 className="font-semibold mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground">{recipe.notes}</p>
            </div>
          )}

          {recipe.url && (
            <div>
              <a
                href={recipe.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                View original recipe
              </a>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 ml-auto">
            <Button variant="ghost" onClick={onDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
            <Button variant="outline" onClick={onEdit}>
              <Edit2 className="h-4 w-4 mr-1" />
              Edit
            </Button>
            <Button onClick={handleClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RecipeFormModalProps {
  recipe?: Recipe;
  onClose: () => void;
  onSave: (data: {
    name: string;
    description?: string;
    ingredients?: Array<{ text: string }>;
    instructions?: string;
    prepTime?: number;
    cookTime?: number;
    servings?: number;
    cuisine?: string;
    category?: string;
    imageUrl?: string;
    notes?: string;
  }) => Promise<void>;
}

function RecipeFormModal({ recipe, onClose, onSave }: RecipeFormModalProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(recipe?.name || '');
  const [description, setDescription] = useState(recipe?.description || '');
  const [ingredientsText, setIngredientsText] = useState(
    recipe?.ingredients.map((i) => i.text).join('\n') || ''
  );
  const [instructions, setInstructions] = useState(recipe?.instructions || '');
  const [prepTime, setPrepTime] = useState(recipe?.prepTime?.toString() || '');
  const [cookTime, setCookTime] = useState(recipe?.cookTime?.toString() || '');
  const [servings, setServings] = useState(recipe?.servings?.toString() || '');
  const [cuisine, setCuisine] = useState(recipe?.cuisine || '');
  const [category, setCategory] = useState(recipe?.category || '');
  const [imageUrl, setImageUrl] = useState(recipe?.imageUrl || '');
  const [notes, setNotes] = useState(recipe?.notes || '');

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Recipe name is required');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        ingredients: ingredientsText
          .split('\n')
          .filter((line) => line.trim())
          .map((text) => ({ text: text.trim() })),
        instructions: instructions.trim() || undefined,
        prepTime: prepTime ? parseInt(prepTime, 10) : undefined,
        cookTime: cookTime ? parseInt(cookTime, 10) : undefined,
        servings: servings ? parseInt(servings, 10) : undefined,
        cuisine: cuisine.trim() || undefined,
        category: category.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    } catch (err) {
      alert('Failed to save recipe');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{recipe ? 'Edit Recipe' : 'Add Recipe'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Recipe Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Chicken Parmesan"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prepTime">Prep Time (min)</Label>
              <Input
                id="prepTime"
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cookTime">Cook Time (min)</Label>
              <Input
                id="cookTime"
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="servings">Servings</Label>
              <Input
                id="servings"
                type="number"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cuisine">Cuisine</Label>
              <Input
                id="cuisine"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="e.g., Italian"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Main Dish"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ingredients">Ingredients (one per line)</Label>
            <Textarea
              id="ingredients"
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              placeholder="1 lb chicken breast&#10;1 cup breadcrumbs&#10;..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Step-by-step instructions..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="imageUrl">Image URL</Label>
            <Input
              id="imageUrl"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Personal notes, tips, variations..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : recipe ? 'Save Changes' : 'Add Recipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ImportUrlModalProps {
  onClose: () => void;
  onImport: (url: string, preview?: boolean) => Promise<unknown>;
}

function ImportUrlModal({ onClose, onImport }: ImportUrlModalProps) {
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!url.trim()) return;

    setImporting(true);
    setError(null);

    try {
      await onImport(url.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import recipe');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Recipe from URL</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Paste a recipe URL from most popular recipe sites (AllRecipes, Food
            Network, Serious Eats, etc.). We&apos;ll automatically extract the
            recipe details.
          </p>

          <div className="space-y-2">
            <Label htmlFor="url">Recipe URL</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.allrecipes.com/recipe/..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && url.trim()) {
                  handleImport();
                }
              }}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!url.trim() || importing}>
            {importing ? 'Importing...' : 'Import Recipe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ImportPaprikaModalProps {
  onClose: () => void;
  onImport: (html: string, preview?: boolean) => Promise<unknown>;
}

function ImportPaprikaModal({ onClose, onImport }: ImportPaprikaModalProps) {
  const [html, setHtml] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImport = async () => {
    if (!html.trim()) return;

    setImporting(true);
    setError(null);

    try {
      await onImport(html.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import recipes');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import from Paprika</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Export your recipes from Paprika as HTML, then paste the content
            below. We&apos;ll import all recipes found in the export.
          </p>

          <div className="space-y-2">
            <Label htmlFor="html">Paprika HTML Export</Label>
            <Textarea
              id="html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder="Paste Paprika HTML export here..."
              rows={10}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!html.trim() || importing}>
            {importing ? 'Importing...' : 'Import Recipes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
