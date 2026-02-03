'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays, isBefore, startOfDay } from 'date-fns';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { PageWrapper } from '@/components/layout';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Meal } from '@/types';

/**
 * MEALS VIEW COMPONENT
 */
export function MealsView() {
  const today = new Date();
  const defaultWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const { requireAuth } = useAuth();

  const [currentWeek, setCurrentWeek] = useState<Date>(defaultWeekStart);
  const weekOfString = format(currentWeek, 'yyyy-MM-dd');
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Meal['dayOfWeek'] | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  // Fetch meals from API
  const fetchMeals = useCallback(async () => {
    try {
      const res = await fetch(`/api/meals?weekOf=${weekOfString}`);
      if (res.ok) {
        const data = await res.json();
        setMeals(data.meals || []);
      }
    } catch (err) {
      console.error('Failed to fetch meals:', err);
    } finally {
      setLoading(false);
    }
  }, [weekOfString]);

  useEffect(() => {
    setLoading(true);
    fetchMeals();
  }, [fetchMeals]);

  // Navigation
  const goToPreviousWeek = () => setCurrentWeek(addDays(currentWeek, -7));
  const goToNextWeek = () => setCurrentWeek(addDays(currentWeek, 7));
  const goToThisWeek = () => setCurrentWeek(defaultWeekStart);
  const isCurrentWeek = format(currentWeek, 'yyyy-MM-dd') === format(defaultWeekStart, 'yyyy-MM-dd');

  // Group and sort meals by day
  const mealsByDay = meals.reduce<Record<string, Meal[]>>((acc, meal) => {
    if (!acc[meal.dayOfWeek]) acc[meal.dayOfWeek] = [];
    acc[meal.dayOfWeek]!.push(meal);
    return acc;
  }, {});

  const mealTypeOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  Object.values(mealsByDay).forEach((dayMeals) => {
    dayMeals.sort((a, b) => (mealTypeOrder[a.mealType] ?? 9) - (mealTypeOrder[b.mealType] ?? 9));
  });

  // Mark cooked via API
  const markCooked = async (mealId: string) => {
    const user = await requireAuth("Who cooked this?");
    if (!user) return;
    try {
      await fetch(`/api/meals/${mealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookedBy: user.id }),
      });
      await fetchMeals();
    } catch (err) {
      console.error('Failed to mark cooked:', err);
    }
  };

  // Unmark cooked via API
  const unmarkCooked = async (mealId: string) => {
    try {
      await fetch(`/api/meals/${mealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookedBy: null }),
      });
      await fetchMeals();
    } catch (err) {
      console.error('Failed to unmark cooked:', err);
    }
  };

  // Delete via API
  const deleteMeal = async (mealId: string) => {
    if (!confirm('Delete this meal?')) return;
    try {
      await fetch(`/api/meals/${mealId}`, { method: 'DELETE' });
      await fetchMeals();
    } catch (err) {
      console.error('Failed to delete meal:', err);
    }
  };

  // Add meal via API
  const addMeal = async (meal: Record<string, unknown>) => {
    const user = await requireAuth("Who's planning this meal?");
    if (!user) return;
    try {
      await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meal, createdBy: user.id }),
      });
      await fetchMeals();
    } catch (err) {
      console.error('Failed to add meal:', err);
    }
  };

  // Edit meal via API
  const editMeal = async (mealId: string, updates: Partial<Meal>) => {
    try {
      await fetch(`/api/meals/${mealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      await fetchMeals();
    } catch (err) {
      console.error('Failed to edit meal:', err);
    }
  };

  // Drag-and-drop: move meal to a different day
  const handleDropMeal = async (mealId: string, newDay: Meal['dayOfWeek']) => {
    try {
      await fetch(`/api/meals/${mealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dayOfWeek: newDay, weekOf: weekOfString }),
      });
      await fetchMeals();
    } catch (err) {
      console.error('Failed to move meal:', err);
    }
  };

  const totalMeals = meals.length;
  const cookedMeals = meals.filter((m) => m.cookedAt).length;

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Meal Planner</h1>
              <Badge variant="secondary">
                {cookedMeals}/{totalMeals} cooked
              </Badge>
            </div>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Meal
            </Button>
          </div>
        </header>

        {/* Week navigation */}
        <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {format(currentWeek, 'MMM d')} - {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
              </h2>
              {!isCurrentWeek && (
                <Button variant="link" size="sm" onClick={goToThisWeek} className="h-auto p-0 text-xs">
                  Go to this week
                </Button>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={goToNextWeek}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Week grid */}
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
                  <DayRow
                    key={day}
                    day={day}
                    date={dayDate}
                    meals={dayMeals}
                    isToday={isDayToday}
                    isPast={isPast}
                    onAddMeal={() => { setSelectedDay(day); setShowAddModal(true); }}
                    onMarkCooked={markCooked}
                    onUnmarkCooked={unmarkCooked}
                    onEdit={setEditingMeal}
                    onDelete={deleteMeal}
                    onDropMeal={handleDropMeal}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Add Meal Modal */}
        {showAddModal && (
          <MealModal
            weekOf={weekOfString}
            defaultDay={selectedDay || 'monday'}
            onClose={() => { setShowAddModal(false); setSelectedDay(null); }}
            onSave={(meal) => {
              addMeal(meal);
              setShowAddModal(false);
              setSelectedDay(null);
            }}
          />
        )}

        {/* Edit Meal Modal */}
        {editingMeal && (
          <MealModal
            weekOf={weekOfString}
            meal={editingMeal}
            onClose={() => setEditingMeal(null)}
            onSave={(updates) => {
              editMeal(editingMeal.id, updates);
              setEditingMeal(null);
            }}
          />
        )}
      </div>
    </PageWrapper>
  );
}


function DayRow({
  day, date, meals, isToday, isPast, onAddMeal, onMarkCooked, onUnmarkCooked, onEdit, onDelete, onDropMeal,
}: {
  day: Meal['dayOfWeek'];
  date: Date;
  meals: Meal[];
  isToday: boolean;
  isPast: boolean;
  onAddMeal: () => void;
  onMarkCooked: (mealId: string) => void;
  onUnmarkCooked: (mealId: string) => void;
  onEdit: (meal: Meal) => void;
  onDelete: (mealId: string) => void;
  onDropMeal: (mealId: string, newDay: Meal['dayOfWeek']) => void;
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
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const mealId = e.dataTransfer.getData('text/meal-id');
        if (mealId) onDropMeal(mealId, day);
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className={cn('text-sm font-semibold capitalize', isToday && 'text-primary')}>{day}</h3>
          <span className="text-xs text-muted-foreground">{format(date, 'MMM d')}</span>
          {isToday && <Badge variant="default" className="text-xs px-2 py-0">Today</Badge>}
        </div>
        <Button variant="ghost" size="sm" onClick={onAddMeal} className="h-7 text-xs">
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {meals.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No meals planned</p>
      ) : (
        <div className="space-y-2">
          {meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onMarkCooked={() => onMarkCooked(meal.id)}
              onUnmarkCooked={() => onUnmarkCooked(meal.id)}
              onEdit={() => onEdit(meal)}
              onDelete={() => onDelete(meal.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}


function MealCard({
  meal, onMarkCooked, onUnmarkCooked, onEdit, onDelete,
}: {
  meal: Meal;
  onMarkCooked: () => void;
  onUnmarkCooked: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCooked = !!meal.cookedAt;
  const totalTime = (meal.prepTime || 0) + (meal.cookTime || 0);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/meal-id', meal.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={cn(
        'flex items-start gap-3 p-3 rounded-md border border-border/50 bg-card/85 backdrop-blur-sm',
        'hover:border-seasonal-accent hover:ring-2 hover:ring-seasonal-accent/50 transition-all group cursor-grab active:cursor-grabbing',
        isCooked && 'opacity-60'
      )}
    >
      <span className="text-lg shrink-0">{getMealTypeEmoji(meal.mealType)}</span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-sm font-medium', isCooked && 'line-through text-muted-foreground')}>
            {meal.name}
          </span>
          <Badge variant="outline" className="text-xs capitalize">{meal.mealType}</Badge>
          {totalTime > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /><span>{totalTime}m</span>
            </div>
          )}
          {meal.recipeUrl && (
            <a href={meal.recipeUrl} target="_blank" rel="noopener noreferrer"
              className="text-primary hover:underline text-xs flex items-center gap-1">
              Recipe <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {meal.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{meal.description}</p>
        )}
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
          <Button variant="ghost" size="icon" onClick={onUnmarkCooked}
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" title="Undo cooked">
            <Undo2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={onMarkCooked}
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity" title="Mark as cooked">
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={onEdit}
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onDelete}
          className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}


function getMealTypeEmoji(mealType: string): string {
  switch (mealType) {
    case 'breakfast': return '🌅';
    case 'lunch': return '🌮';
    case 'dinner': return '🍽️';
    case 'snack': return '🍿';
    default: return '🍴';
  }
}


function MealModal({
  weekOf, meal, defaultDay, onClose, onSave,
}: {
  weekOf: string;
  meal?: Meal;
  defaultDay?: Meal['dayOfWeek'];
  onClose: () => void;
  onSave: (meal: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState(meal?.name || '');
  const [description, setDescription] = useState(meal?.description || '');
  const [dayOfWeek, setDayOfWeek] = useState<Meal['dayOfWeek']>(meal?.dayOfWeek || defaultDay || 'monday');
  const [mealType, setMealType] = useState<Meal['mealType']>(meal?.mealType || 'dinner');
  const [prepTime, setPrepTime] = useState(meal?.prepTime?.toString() || '');
  const [cookTime, setCookTime] = useState(meal?.cookTime?.toString() || '');
  const [recipeUrl, setRecipeUrl] = useState(meal?.recipeUrl || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      weekOf,
      dayOfWeek,
      mealType,
      prepTime: prepTime ? parseInt(prepTime) : undefined,
      cookTime: cookTime ? parseInt(cookTime) : undefined,
      recipeUrl: recipeUrl.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">{meal ? 'Edit Meal' : 'Add Meal'}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal name..." autoFocus />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any details..." />
          </div>
          <div>
            <label className="text-sm font-medium">Day</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
                <Button key={day} type="button" variant={dayOfWeek === day ? 'default' : 'outline'}
                  size="sm" onClick={() => setDayOfWeek(day)} className="capitalize text-xs">
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Meal Type</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                <Button key={type} type="button" variant={mealType === type ? 'default' : 'outline'}
                  size="sm" onClick={() => setMealType(type)} className="capitalize">
                  {getMealTypeEmoji(type)} {type}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Prep Time (min)</label>
              <Input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} placeholder="15" min="0" />
            </div>
            <div>
              <label className="text-sm font-medium">Cook Time (min)</label>
              <Input type="number" value={cookTime} onChange={(e) => setCookTime(e.target.value)} placeholder="30" min="0" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Recipe URL (optional)</label>
            <Input type="url" value={recipeUrl} onChange={(e) => setRecipeUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!name.trim()}>{meal ? 'Save Changes' : 'Add Meal'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
