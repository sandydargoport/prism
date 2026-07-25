'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { ChefHat, Plus, Search, Heart, X, Link2, FileUp, PenLine, ChevronDown, ClipboardPaste, Soup } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageWrapper, SubpageHeader, FilterBar, FilterDropdown } from '@/components/layout';
import { useRecipes, type Recipe } from '@/lib/hooks/useRecipes';
import { useShoppingLists } from '@/lib/hooks/useShoppingLists';
import { useAuth } from '@/components/providers';
import { useRecipesFilters } from './useRecipesFilters';
import { RecipeCard } from './RecipeCard';
import { RecipeDetailModal } from './RecipeDetailModal';
import { RecipeFormModal } from './RecipeFormModal';
import { ImportUrlModal } from './ImportUrlModal';
import { ImportPaprikaModal } from './ImportPaprikaModal';
import { ImportTextModal } from './ImportTextModal';
import { ImportTandoorModal } from './ImportTandoorModal';
import type { ParsedRecipeText } from '@/lib/utils/recipeTextParser';

type ViewMode = 'all' | 'favorites';

export function RecipesView() {
  const { requireAuth } = useAuth();
  const { confirm, dialogProps: confirmDialogProps } = useConfirmDialog();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportUrlModal, setShowImportUrlModal] = useState(false);
  const [showImportPaprikaModal, setShowImportPaprikaModal] = useState(false);
  const [showImportTextModal, setShowImportTextModal] = useState(false);
  const [showImportTandoorModal, setShowImportTandoorModal] = useState(false);
  const [textPrefill, setTextPrefill] = useState<ParsedRecipeText | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [paramHandled, setParamHandled] = useState(false);

  const { recipes, loading, error, deleteRecipe, toggleFavorite, importFromUrl, importFromPaprika, createRecipe, updateRecipe, refresh } = useRecipes({
    favorite: viewMode === 'favorites' ? true : undefined,
  });

  const {
    search, setSearch,
    filterCuisine, setFilterCuisine,
    filterCategory, setFilterCategory,
    cuisines, categories, filteredRecipes,
    clearFilters, hasActiveFilters,
  } = useRecipesFilters(recipes);

  const { lists: shoppingLists, addItem: addShoppingItem } = useShoppingLists();

  // Keep selectedRecipe in sync (for favorite toggle, etc.)
  useEffect(() => {
    if (!selectedRecipe) return;
    const updated = recipes.find(r => r.id === selectedRecipe.id);
    if (updated && updated.isFavorite !== selectedRecipe.isFavorite) setSelectedRecipe(updated);
  }, [recipes, selectedRecipe]);

  // Auto-open recipe from ?recipe=<id> search param (e.g. linked from meals page)
  const recipeParam = searchParams.get('recipe');
  useEffect(() => {
    if (recipeParam && recipes.length > 0 && !paramHandled) {
      const match = recipes.find(r => r.id === recipeParam);
      if (match) setSelectedRecipe(match);
      setParamHandled(true);
    }
  }, [recipeParam, recipes, paramHandled]);

  const handleDelete = async (recipe: Recipe) => {
    if (!await confirm(`Delete "${recipe.name}"?`, 'This cannot be undone.')) return;
    try {
      await deleteRecipe(recipe.id);
      setSelectedRecipe(null);
    } catch {
      toast({ title: 'Failed to delete recipe', variant: 'destructive' });
    }
  };

  const handleAddWithAuth = async () => {
    if (!await requireAuth('Add Recipe', 'Please log in to add a recipe')) return;
    setShowAddModal(true);
  };

  const handleImportUrlWithAuth = async () => {
    if (!await requireAuth('Import Recipe', 'Please log in to import a recipe')) return;
    setShowImportUrlModal(true);
  };

  const handleImportPaprikaWithAuth = async () => {
    if (!await requireAuth('Import Recipes', 'Please log in to import recipes')) return;
    setShowImportPaprikaModal(true);
  };

  const handleImportTextWithAuth = async () => {
    if (!await requireAuth('Import Recipe', 'Please log in to import a recipe')) return;
    setShowImportTextModal(true);
  };

  const handleImportTandoorWithAuth = async () => {
    if (!await requireAuth('Import Recipes', 'Please log in to import recipes')) return;
    setShowImportTandoorModal(true);
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <SubpageHeader
          icon={<ChefHat className="h-5 w-5 text-primary" />}
          title="Recipes"
          badge={<Badge variant="secondary">{recipes.length}</Badge>}
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />Add<ChevronDown className="h-3 w-3 ml-1 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleImportUrlWithAuth}>
                  <Link2 className="h-4 w-4 mr-2 text-muted-foreground" />
                  Import from URL
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportPaprikaWithAuth}>
                  <FileUp className="h-4 w-4 mr-2 text-muted-foreground" />
                  Import from Paprika
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportTextWithAuth}>
                  <ClipboardPaste className="h-4 w-4 mr-2 text-muted-foreground" />
                  Paste recipe text
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportTandoorWithAuth}>
                  <Soup className="h-4 w-4 mr-2 text-muted-foreground" />
                  Import from Tandoor
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddWithAuth}>
                  <PenLine className="h-4 w-4 mr-2 text-muted-foreground" />
                  Create manually
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
        />

        <FilterBar>
          <div className="relative min-w-[180px] max-w-md shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search recipes..." className="pl-9 h-8" />
          </div>
          <div className="w-px h-5 bg-border shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            <Button variant={viewMode === 'all' ? 'secondary' : 'ghost'} size="sm"
              onClick={() => setViewMode('all')} className="h-8">All</Button>
            <Button variant={viewMode === 'favorites' ? 'secondary' : 'ghost'} size="sm"
              onClick={() => setViewMode('favorites')} className="h-8">
              <Heart className="h-4 w-4 mr-1" />Favorites
            </Button>
          </div>
          {cuisines.length > 0 && (
            <>
              <div className="w-px h-5 bg-border shrink-0" />
              <FilterDropdown label="Cuisine"
                options={cuisines.map(c => ({ value: c, label: c }))}
                selected={filterCuisine ? new Set([filterCuisine]) : new Set()}
                onSelectionChange={s => setFilterCuisine(s.size > 0 ? [...s][0]! : null)}
                mode="single" />
            </>
          )}
          {categories.length > 0 && (
            <FilterDropdown label="Category"
              options={categories.map(c => ({ value: c, label: c }))}
              selected={filterCategory ? new Set([filterCategory]) : new Set()}
              onSelectionChange={s => setFilterCategory(s.size > 0 ? [...s][0]! : null)}
              mode="single" />
          )}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}
              className="shrink-0 text-muted-foreground h-8">
              <X className="h-3 w-3 mr-1" />Clear
            </Button>
          )}
        </FilterBar>

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
              {filteredRecipes.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe}
                  onClick={() => setSelectedRecipe(recipe)}
                  onToggleFavorite={() => toggleFavorite(recipe.id)} />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedRecipe && (
        <RecipeDetailModal
          recipe={selectedRecipe}
          shoppingLists={shoppingLists.map(l => ({ id: l.id, name: l.name }))}
          onClose={() => setSelectedRecipe(null)}
          onEdit={() => setShowEditModal(true)}
          onDelete={() => handleDelete(selectedRecipe)}
          onToggleFavorite={() => toggleFavorite(selectedRecipe.id)}
          onAddToShoppingList={async (listId, ingredients) => {
            for (const ing of ingredients) await addShoppingItem(listId, { name: ing.text });
          }}
        />
      )}

      {showAddModal && (
        <RecipeFormModal
          recipe={textPrefill ? {
            // Cast to Recipe just to populate the form's initial values; the
            // form only reads these fields, not the rest of the Recipe shape.
            // No `id` is set, so the form treats this as a brand-new recipe.
            name: textPrefill.name,
            ingredients: textPrefill.ingredients,
            instructions: textPrefill.instructions,
            prepTime: textPrefill.prepTime,
            cookTime: textPrefill.cookTime,
            servings: textPrefill.servings,
          } as Recipe : undefined}
          onClose={() => { setShowAddModal(false); setTextPrefill(null); }}
          onSave={async data => {
            await createRecipe(data);
            setShowAddModal(false);
            setTextPrefill(null);
          }}
        />
      )}

      {showImportTextModal && (
        <ImportTextModal
          onClose={() => setShowImportTextModal(false)}
          onParsed={(parsed) => {
            setTextPrefill(parsed);
            setShowAddModal(true);
          }}
        />
      )}

      {showEditModal && selectedRecipe && (
        <RecipeFormModal recipe={selectedRecipe} onClose={() => setShowEditModal(false)}
          onSave={async data => { await updateRecipe(selectedRecipe.id, data); setShowEditModal(false); setSelectedRecipe(null); }} />
      )}

      {showImportUrlModal && (
        <ImportUrlModal onClose={() => setShowImportUrlModal(false)} onImport={importFromUrl} />
      )}

      {showImportPaprikaModal && (
        <ImportPaprikaModal onClose={() => setShowImportPaprikaModal(false)} onImport={importFromPaprika} />
      )}
      {showImportTandoorModal && (
        <ImportTandoorModal onClose={() => setShowImportTandoorModal(false)} onImported={refresh} />
      )}

      <ConfirmDialog {...confirmDialogProps} />
    </PageWrapper>
  );
}
