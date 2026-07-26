'use client';

import Image from 'next/image';
import { useState } from 'react';
import { toast } from '@/components/ui/use-toast';
import {
  Heart,
  Plus,
  ExternalLink,
  Trash2,
  Edit2,
  ShoppingCart,
  Minus,
  ChevronDown,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { scaleIngredientText } from '@/lib/utils/scaleIngredient';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { Recipe } from '@/lib/hooks/useRecipes';
import { AddToMealPlanSection } from './AddToMealPlanSection';

export interface RecipeDetailModalProps {
  recipe: Recipe;
  shoppingLists: Array<{ id: string; name: string }>;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onAddToShoppingList: (listId: string, ingredients: Array<{ text: string }>) => Promise<void>;
}

export function RecipeDetailModal({
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

  // Scale only the leading quantity of each ingredient line — later numbers are
  // pack/size descriptors ("1 8 oz can", "1 9x13 pan") and must stay put.
  const scaleIngredient = (text: string): string => scaleIngredientText(text, scaleFactor);

  const handleAddToList = async (listId: string) => {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return;
    setAddingToList(true);
    try {
      // Scale ingredients before adding. Section headings are filtered out —
      // they aren't shopping items, just visual grouping in the recipe view.
      const scaledIngredients = recipe.ingredients
        .filter((ing) => ing.text && !ing.heading)
        .map((ing) => ({
          text: scaleIngredient(ing.text ?? ''),
        }));
      await onAddToShoppingList(listId, scaledIngredients);
      setShowListPicker(false);
      toast({ title: `Added ${scaledIngredients.length} ingredients to shopping list!`, variant: 'success' });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : 'Failed to add ingredients to shopping list',
        variant: 'destructive',
      });
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
          <div className="relative h-48 -mx-6 -mt-2 bg-muted overflow-hidden">
            <Image
              src={recipe.imageUrl}
              alt={recipe.name}
              fill
              unoptimized
              className="object-cover"
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Servings:</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setDesiredServings(Math.max(1, desiredServings - 1))}
                    disabled={desiredServings <= 1}
                    aria-label="Decrease servings"
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-8 text-center font-medium">{desiredServings}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setDesiredServings(desiredServings + 1)}
                    aria-label="Increase servings"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                {/* Quick scale buttons — multiplier of the original servings.
                    ½× rounds up to the nearest whole serving (1 minimum). */}
                <div className="flex items-center gap-1">
                  {[
                    { mult: 0.5, label: '½×' },
                    { mult: 1, label: '1×' },
                    { mult: 2, label: '2×' },
                    { mult: 3, label: '3×' },
                    { mult: 4, label: '4×' },
                  ].map(({ mult, label }) => {
                    const target = Math.max(1, Math.round((recipe.servings ?? 1) * mult));
                    const active = desiredServings === target;
                    return (
                      <Button
                        key={label}
                        variant={active ? 'secondary' : 'outline'}
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => setDesiredServings(target)}
                      >
                        {label}
                      </Button>
                    );
                  })}
                </div>
                {scaleFactor !== 1 && (
                  <span className="text-xs text-muted-foreground">
                    (scaled {scaleFactor > 1 ? 'up' : 'down'} ×{scaleFactor.toFixed(scaleFactor % 1 ? 2 : 0)})
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
                {recipe.ingredients.map((ing, i) => {
                  if (ing.heading) {
                    return (
                      <li key={i} className="text-sm font-semibold mt-3 first:mt-0">
                        {ing.heading}
                      </li>
                    );
                  }
                  return (
                    <li
                      key={i}
                      onClick={() => toggleIngredient(i)}
                      className={cn(
                        'text-sm flex items-start gap-2 cursor-pointer select-none hover:bg-accent/50 rounded px-1 -mx-1 transition-colors',
                        checkedIngredients.has(i) && 'line-through text-muted-foreground',
                      )}
                    >
                      <span className="text-muted-foreground">&bull;</span>
                      {scaleIngredient(ing.text ?? '')}
                    </li>
                  );
                })}
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

        <AddToMealPlanSection recipe={recipe} />

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
