'use client';

import Image from 'next/image';
import { Heart, Clock, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import type { Recipe } from '@/lib/hooks/useRecipes';

export interface RecipeCardProps {
  recipe: Recipe;
  onClick: () => void;
  onToggleFavorite: () => void;
}

export function RecipeCard({ recipe, onClick, onToggleFavorite }: RecipeCardProps) {
  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
      onClick={onClick}
    >
      {recipe.imageUrl && (
        <div className="relative h-40 bg-muted overflow-hidden">
          <Image
            src={recipe.imageUrl}
            alt={recipe.name}
            fill
            unoptimized
            className="object-cover"
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
            aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart
              className={cn(
                'h-5 w-5 transition-colors',
                recipe.isFavorite
                  ? 'fill-red-500 text-destructive'
                  : 'text-muted-foreground hover:text-destructive'
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
