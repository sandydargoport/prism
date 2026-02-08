'use client';

import * as React from 'react';
import { useState } from 'react';
import { format, addDays, isBefore, startOfDay } from 'date-fns';
import {
  UtensilsCrossed,
  Plus,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  Undo2,
  Clock,
  ExternalLink,
  ChefHat,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { PageWrapper } from '@/components/layout';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useMealsViewData } from './useMealsViewData';
import { useRecipes, type Recipe } from '@/lib/hooks/useRecipes';
import { useAuth } from '@/components/providers';
import type { Meal } from '@/types';

export function MealsView() {
  const { requireAuth } = useAuth();
  const {
    today, currentWeek, weekOfString, loading,
    showAddModal, setShowAddModal,
    selectedDay, setSelectedDay,
    editingMeal, setEditingMeal,
    goToPreviousWeek, goToNextWeek, goToThisWeek, isCurrentWeek,
    mealsByDay,
    markCooked, unmarkCooked, deleteMeal, addMeal, editMeal, handleDropMeal,
    totalMeals, cookedMeals,
  } = useMealsViewData();

  const { recipes } = useRecipes({ limit: 100 });

  const handleAddWithAuth = async (day?: Meal['dayOfWeek']) => {
    const user = await requireAuth('Add Meal', 'Please log in to add a meal');
    if (!user) return;
    if (day) setSelectedDay(day);
    setShowAddModal(true);
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3 safe-area-top">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Meal Planner</h1>
              <Badge variant="secondary">{cookedMeals}/{totalMeals} cooked</Badge>
            </div>
            <Button onClick={() => handleAddWithAuth()} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Meal
            </Button>
          </div>
        </header>

        <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={goToPreviousWeek}><ChevronLeft className="h-5 w-5" /></Button>
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {format(currentWeek, 'MMM d')} - {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
              </h2>
              {!isCurrentWeek && (
                <Button variant="link" size="sm" onClick={goToThisWeek} className="h-auto p-0 text-xs">Go to this week</Button>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={goToNextWeek}><ChevronRight className="h-5 w-5" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-3">
              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day, index) => {
                const dayDate = addDays(currentWeek, index);
                const dayMeals = mealsByDay[day] || [];
                const isDayToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                const isPast = isBefore(dayDate, startOfDay(new Date())) && !isDayToday;
                return (
                  <DayRow key={day} day={day} date={dayDate} meals={dayMeals} isToday={isDayToday} isPast={isPast}
                    onAddMeal={() => handleAddWithAuth(day)}
                    onMarkCooked={markCooked} onUnmarkCooked={unmarkCooked}
                    onEdit={setEditingMeal} onDelete={deleteMeal} onDropMeal={handleDropMeal} />
                );
              })}
            </div>
          )}
        </div>

        {showAddModal && (
          <MealModal weekOf={weekOfString} defaultDay={selectedDay || 'monday'} recipes={recipes}
            onClose={() => { setShowAddModal(false); setSelectedDay(null); }}
            onSave={(meal) => { addMeal(meal); setShowAddModal(false); setSelectedDay(null); }} />
        )}
        {editingMeal && (
          <MealModal weekOf={weekOfString} meal={editingMeal} recipes={recipes}
            onClose={() => setEditingMeal(null)}
            onSave={(updates) => { editMeal(editingMeal.id, updates); setEditingMeal(null); }} />
        )}
      </div>
    </PageWrapper>
  );
}


function DayRow({ day, date, meals, isToday, isPast, onAddMeal, onMarkCooked, onUnmarkCooked, onEdit, onDelete, onDropMeal }: {
  day: Meal['dayOfWeek']; date: Date; meals: Meal[]; isToday: boolean; isPast: boolean;
  onAddMeal: () => void; onMarkCooked: (id: string) => void; onUnmarkCooked: (id: string) => void;
  onEdit: (meal: Meal) => void; onDelete: (id: string) => void; onDropMeal: (id: string, day: Meal['dayOfWeek']) => void;
}) {
  const [dragOver, setDragOver] = React.useState(false);
  return (
    <div
      className={cn(
        'border border-border rounded-lg p-4 bg-card/85 backdrop-blur-sm transition-colors',
        isToday && 'bg-accent/80 dark:bg-accent/50 border-primary',
        isPast && !isToday && 'bg-muted/60 dark:bg-muted/40',
        dragOver && 'border-primary border-2',
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData('text/meal-id'); if (id) onDropMeal(id, day); }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className={cn('text-sm font-semibold capitalize', isToday && 'text-primary')}>{day}</h3>
          <span className="text-xs text-muted-foreground">{format(date, 'MMM d')}</span>
          {isToday && <Badge variant="default" className="text-xs px-2 py-0">Today</Badge>}
        </div>
        <Button variant="ghost" size="sm" onClick={onAddMeal} className="h-7 text-xs"><Plus className="h-3 w-3 mr-1" /> Add</Button>
      </div>
      {meals.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No meals planned</p>
      ) : (
        <div className="space-y-2">
          {meals.map((meal) => (
            <MealCard key={meal.id} meal={meal}
              onMarkCooked={() => onMarkCooked(meal.id)} onUnmarkCooked={() => onUnmarkCooked(meal.id)}
              onEdit={() => onEdit(meal)} onDelete={() => onDelete(meal.id)} />
          ))}
        </div>
      )}
    </div>
  );
}


function MealCard({ meal, onMarkCooked, onUnmarkCooked, onEdit, onDelete }: {
  meal: Meal; onMarkCooked: () => void; onUnmarkCooked: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const isCooked = !!meal.cookedAt;
  const totalTime = (meal.prepTime || 0) + (meal.cookTime || 0);
  return (
    <div
      draggable onDragStart={(e) => { e.dataTransfer.setData('text/meal-id', meal.id); e.dataTransfer.effectAllowed = 'move'; }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-md border border-border/50 bg-card/85 backdrop-blur-sm',
        'hover:border-seasonal-accent hover:ring-2 hover:ring-seasonal-accent/50 transition-all group cursor-grab active:cursor-grabbing',
        isCooked && 'opacity-60'
      )}
    >
      <span className="text-lg shrink-0">{getMealTypeEmoji(meal.mealType)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-sm font-medium', isCooked && 'line-through text-muted-foreground')}>{meal.name}</span>
          <Badge variant="outline" className="text-xs capitalize">{meal.mealType}</Badge>
          {totalTime > 0 && <div className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /><span>{totalTime}m</span></div>}
          {meal.recipeUrl && (
            <a href={meal.recipeUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
              Recipe <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {meal.description && <p className="text-xs text-muted-foreground mt-0.5">{meal.description}</p>}
        {isCooked && meal.cookedBy && (
          <div className="flex items-center gap-1 mt-1">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            <UserAvatar name={meal.cookedBy.name} color={meal.cookedBy.color} size="sm" className="h-4 w-4 text-[8px]" />
            <span className="text-xs text-muted-foreground">{meal.cookedBy.name} cooked this</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {isCooked ? (
          <Button variant="ghost" size="icon" onClick={onUnmarkCooked} className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" title="Undo cooked"><Undo2 className="h-4 w-4" /></Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={onMarkCooked} className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" title="Mark as cooked"><CheckCircle2 className="h-4 w-4" /></Button>
        )}
        <Button variant="ghost" size="icon" onClick={onEdit} className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"><Edit2 className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" onClick={onDelete} className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3 w-3" /></Button>
      </div>
    </div>
  );
}


function getMealTypeEmoji(mealType: string): string {
  switch (mealType) {
    case 'breakfast': return '\u{1F305}';
    case 'lunch': return '\u{1F32E}';
    case 'dinner': return '\u{1F37D}\uFE0F';
    case 'snack': return '\u{1F37F}';
    default: return '\u{1F374}';
  }
}


function MealModal({ weekOf, meal, defaultDay, recipes, onClose, onSave }: {
  weekOf: string; meal?: Meal; defaultDay?: Meal['dayOfWeek']; recipes: Recipe[];
  onClose: () => void; onSave: (meal: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(meal?.name || '');
  const [description, setDescription] = useState(meal?.description || '');
  const [dayOfWeek, setDayOfWeek] = useState<Meal['dayOfWeek']>(meal?.dayOfWeek || defaultDay || 'monday');
  const [mealType, setMealType] = useState<Meal['mealType']>(meal?.mealType || 'dinner');
  const [prepTime, setPrepTime] = useState(meal?.prepTime?.toString() || '');
  const [cookTime, setCookTime] = useState(meal?.cookTime?.toString() || '');
  const [recipeUrl, setRecipeUrl] = useState(meal?.recipeUrl || '');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState('');

  const filteredRecipes = React.useMemo(() => {
    if (!recipeSearch.trim()) return recipes.slice(0, 20);
    const search = recipeSearch.toLowerCase();
    return recipes.filter(r =>
      r.name.toLowerCase().includes(search) ||
      r.cuisine?.toLowerCase().includes(search) ||
      r.category?.toLowerCase().includes(search)
    ).slice(0, 20);
  }, [recipes, recipeSearch]);

  const selectRecipe = (recipe: Recipe) => {
    setSelectedRecipeId(recipe.id);
    setName(recipe.name);
    setDescription(recipe.description || '');
    setPrepTime(recipe.prepTime?.toString() || '');
    setCookTime(recipe.cookTime?.toString() || '');
    setRecipeUrl(recipe.url || '');
    setShowRecipePicker(false);
    setRecipeSearch('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(), description: description.trim() || undefined, weekOf, dayOfWeek, mealType,
      prepTime: prepTime ? parseInt(prepTime) : undefined, cookTime: cookTime ? parseInt(cookTime) : undefined,
      recipeUrl: recipeUrl.trim() || undefined, recipeId: selectedRecipeId || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pb-20 md:pb-0" onClick={onClose}>
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{meal ? 'Edit Meal' : 'Add Meal'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recipe Picker */}
          {recipes.length > 0 && (
            <div>
              <label className="text-sm font-medium flex items-center gap-2">
                <ChefHat className="h-4 w-4" />
                From Recipe (optional)
              </label>
              {showRecipePicker ? (
                <div className="mt-1 border border-border rounded-md bg-background">
                  <div className="p-2 border-b border-border">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        value={recipeSearch}
                        onChange={(e) => setRecipeSearch(e.target.value)}
                        placeholder="Search recipes..."
                        className="pl-8 h-8"
                        autoFocus
                      />
                    </div>
                  </div>
                  <ScrollArea className="h-48">
                    <div className="p-1">
                      {filteredRecipes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No recipes found</p>
                      ) : (
                        filteredRecipes.map((recipe) => (
                          <button
                            key={recipe.id}
                            type="button"
                            onClick={() => selectRecipe(recipe)}
                            className="w-full text-left px-3 py-2 rounded-md hover:bg-accent text-sm flex items-center gap-2"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{recipe.name}</div>
                              {(recipe.cuisine || recipe.category) && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {[recipe.cuisine, recipe.category].filter(Boolean).join(' • ')}
                                </div>
                              )}
                            </div>
                            {(recipe.prepTime || recipe.cookTime) && (
                              <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                                <Clock className="h-3 w-3" />
                                {(recipe.prepTime || 0) + (recipe.cookTime || 0)}m
                              </div>
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                  <div className="p-2 border-t border-border">
                    <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => setShowRecipePicker(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full mt-1 justify-start"
                  onClick={() => setShowRecipePicker(true)}
                >
                  {selectedRecipeId ? (
                    <span className="flex items-center gap-2">
                      <ChefHat className="h-4 w-4 text-primary" />
                      {recipes.find(r => r.id === selectedRecipeId)?.name || 'Selected recipe'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Choose a recipe...</span>
                  )}
                </Button>
              )}
            </div>
          )}
          <div><label className="text-sm font-medium">Name</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal name..." autoFocus={recipes.length === 0} /></div>
          <div><label className="text-sm font-medium">Description (optional)</label><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any details..." /></div>
          <div>
            <label className="text-sm font-medium">Day</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((d) => (
                <Button key={d} type="button" variant={dayOfWeek === d ? 'default' : 'outline'} size="sm" onClick={() => setDayOfWeek(d)} className="capitalize text-xs">{d.slice(0, 3)}</Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Meal Type</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                <Button key={type} type="button" variant={mealType === type ? 'default' : 'outline'} size="sm" onClick={() => setMealType(type)} className="capitalize">
                  {getMealTypeEmoji(type)} {type}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">Prep Time (min)</label><Input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="15" min="0" /></div>
            <div><label className="text-sm font-medium">Cook Time (min)</label><Input type="number" value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="30" min="0" /></div>
          </div>
          <div><label className="text-sm font-medium">Recipe URL (optional)</label><Input type="url" value={recipeUrl} onChange={(e) => setRecipeUrl(e.target.value)} placeholder="https://..." /></div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>{meal ? 'Save Changes' : 'Add Meal'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
