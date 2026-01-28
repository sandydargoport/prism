/**
 * ============================================================================
 * PRISM - Meals View Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * The main interactive meals view with weekly planning and meal management.
 *
 * FEATURES:
 * - Weekly meal grid (Monday-Sunday)
 * - Add/edit/delete meals
 * - Mark meals as cooked
 * - Recipe information
 * - Navigate between weeks
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { format, startOfWeek, addDays, parseISO, isToday } from 'date-fns';
import {
  UtensilsCrossed,
  Plus,
  Home,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  Clock,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { PageWrapper } from '@/components/layout';

/**
 * MEAL INTERFACE
 */
interface Meal {
  id: string;
  name: string;
  description?: string;
  recipe?: string;
  recipeUrl?: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  ingredients?: string;
  weekOf: string;
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  cookedAt?: Date;
  cookedBy?: {
    id: string;
    name: string;
    color: string;
  };
  createdAt: Date;
}

/**
 * FAMILY MEMBER TYPE
 */
interface FamilyMember {
  id: string;
  name: string;
  color: string;
}

const familyMembers: FamilyMember[] = [
  { id: 'alex', name: 'Alex', color: '#3B82F6' },
  { id: 'jordan', name: 'Jordan', color: '#EC4899' },
  { id: 'emma', name: 'Emma', color: '#10B981' },
  { id: 'sophie', name: 'Sophie', color: '#F59E0B' },
];

/**
 * DEMO DATA
 */
function getDemoMeals(weekOfString: string): Meal[] {
  const today = new Date();

  return [
    {
      id: '1',
      name: 'Pancakes',
      weekOf: weekOfString,
      dayOfWeek: 'monday',
      mealType: 'breakfast',
      prepTime: 10,
      cookTime: 15,
      createdAt: today,
    },
    {
      id: '2',
      name: 'Spaghetti and meatballs',
      weekOf: weekOfString,
      dayOfWeek: 'monday',
      mealType: 'dinner',
      prepTime: 20,
      cookTime: 30,
      createdAt: today,
    },
    {
      id: '3',
      name: 'Chicken stir fry',
      description: 'With vegetables and rice',
      weekOf: weekOfString,
      dayOfWeek: 'tuesday',
      mealType: 'dinner',
      prepTime: 15,
      cookTime: 20,
      createdAt: today,
    },
    {
      id: '4',
      name: 'Tacos',
      weekOf: weekOfString,
      dayOfWeek: 'wednesday',
      mealType: 'dinner',
      prepTime: 10,
      cookTime: 15,
      cookedAt: today,
      cookedBy: { id: 'alex', name: 'Alex', color: '#3B82F6' },
      createdAt: today,
    },
    {
      id: '5',
      name: 'Pizza night',
      description: 'Homemade or delivery',
      weekOf: weekOfString,
      dayOfWeek: 'friday',
      mealType: 'dinner',
      prepTime: 5,
      cookTime: 25,
      createdAt: today,
    },
    {
      id: '6',
      name: 'Waffles',
      weekOf: weekOfString,
      dayOfWeek: 'saturday',
      mealType: 'breakfast',
      prepTime: 10,
      cookTime: 10,
      createdAt: today,
    },
  ];
}

/**
 * MEALS VIEW COMPONENT
 */
export function MealsView() {
  // Determine current week
  const today = new Date();
  const defaultWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday

  // State
  const [currentWeek, setCurrentWeek] = useState<Date>(defaultWeekStart);
  const weekOfString = format(currentWeek, 'yyyy-MM-dd');
  const [meals, setMeals] = useState<Meal[]>(getDemoMeals(weekOfString));
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Meal['dayOfWeek'] | null>(null);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

  // Navigation handlers
  const goToPreviousWeek = () => {
    const newWeek = addDays(currentWeek, -7);
    setCurrentWeek(newWeek);
  };

  const goToNextWeek = () => {
    const newWeek = addDays(currentWeek, 7);
    setCurrentWeek(newWeek);
  };

  const goToThisWeek = () => {
    setCurrentWeek(defaultWeekStart);
  };

  const isCurrentWeek = format(currentWeek, 'yyyy-MM-dd') === format(defaultWeekStart, 'yyyy-MM-dd');

  // Group meals by day
  const mealsByDay = meals.reduce((acc, meal) => {
    if (meal.weekOf === weekOfString) {
      if (!acc[meal.dayOfWeek]) acc[meal.dayOfWeek] = [];
      acc[meal.dayOfWeek].push(meal);
    }
    return acc;
  }, {} as Record<Meal['dayOfWeek'], Meal[]>);

  // Sort meals by type
  const mealTypeOrder = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  Object.keys(mealsByDay).forEach((day) => {
    mealsByDay[day as Meal['dayOfWeek']].sort(
      (a, b) => mealTypeOrder[a.mealType] - mealTypeOrder[b.mealType]
    );
  });

  // Mark meal as cooked
  const markCooked = (mealId: string) => {
    setMeals((prev) =>
      prev.map((meal) =>
        meal.id === mealId
          ? {
              ...meal,
              cookedAt: new Date(),
              cookedBy: familyMembers[0], // TODO: Use actual current user
            }
          : meal
      )
    );
  };

  // Delete meal
  const deleteMeal = (mealId: string) => {
    setMeals((prev) => prev.filter((meal) => meal.id !== mealId));
  };

  // Meal counts
  const totalMeals = meals.filter((m) => m.weekOf === weekOfString).length;
  const cookedMeals = meals.filter((m) => m.weekOf === weekOfString && m.cookedAt).length;

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* ================================================================ */}
        {/* HEADER */}
      {/* ================================================================== */}
      <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Back and title */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Back to dashboard">
                <Home className="h-5 w-5" />
              </Link>
            </Button>

            <div className="flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Meal Planner</h1>
              <Badge variant="secondary">
                {cookedMeals}/{totalMeals} cooked
              </Badge>
            </div>
          </div>

          {/* Right: Add button */}
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Meal
          </Button>
        </div>
      </header>

      {/* ================================================================== */}
      {/* WEEK NAVIGATION */}
      {/* ================================================================== */}
      <div className="flex-shrink-0 border-b border-border bg-card/50 px-4 py-3">
        <div className="flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPreviousWeek}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="text-center">
            <h2 className="text-lg font-semibold">
              {format(currentWeek, 'MMM d')} - {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
            </h2>
            {!isCurrentWeek && (
              <Button
                variant="link"
                size="sm"
                onClick={goToThisWeek}
                className="h-auto p-0 text-xs"
              >
                Go to this week
              </Button>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextWeek}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* ================================================================== */}
      {/* WEEK GRID */}
      {/* ================================================================== */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-6xl mx-auto space-y-3">
          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day, index) => {
            const dayDate = addDays(currentWeek, index);
            const dayMeals = mealsByDay[day as Meal['dayOfWeek']] || [];
            const isDayToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

            return (
              <DayRow
                key={day}
                day={day as Meal['dayOfWeek']}
                date={dayDate}
                meals={dayMeals}
                isToday={isDayToday}
                onAddMeal={() => {
                  setSelectedDay(day as Meal['dayOfWeek']);
                  setShowAddModal(true);
                }}
                onMarkCooked={markCooked}
                onEdit={setEditingMeal}
                onDelete={deleteMeal}
              />
            );
          })}
        </div>
      </div>

      {/* Add Meal Modal */}
      {showAddModal && (
        <MealModal
          weekOf={weekOfString}
          defaultDay={selectedDay || 'monday'}
          onClose={() => {
            setShowAddModal(false);
            setSelectedDay(null);
          }}
          onSave={(meal) => {
            setMeals((prev) => [...prev, { ...meal, id: Date.now().toString(), createdAt: new Date() }]);
            setShowAddModal(false);
            setSelectedDay(null);
          }}
          familyMembers={familyMembers}
        />
      )}

      {/* Edit Meal Modal */}
      {editingMeal && (
        <MealModal
          weekOf={weekOfString}
          meal={editingMeal}
          onClose={() => setEditingMeal(null)}
          onSave={(updatedMeal) => {
            setMeals((prev) =>
              prev.map((m) => (m.id === editingMeal.id ? { ...m, ...updatedMeal } : m))
            );
            setEditingMeal(null);
          }}
          familyMembers={familyMembers}
        />
      )}
      </div>
    </PageWrapper>
  );
}

/**
 * DAY ROW COMPONENT
 */
function DayRow({
  day,
  date,
  meals,
  isToday,
  onAddMeal,
  onMarkCooked,
  onEdit,
  onDelete,
}: {
  day: Meal['dayOfWeek'];
  date: Date;
  meals: Meal[];
  isToday: boolean;
  onAddMeal: () => void;
  onMarkCooked: (mealId: string) => void;
  onEdit: (meal: Meal) => void;
  onDelete: (mealId: string) => void;
}) {
  return (
    <div className={cn(
      'border border-border rounded-lg p-4',
      isToday && 'bg-accent/30 border-primary'
    )}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className={cn(
            'text-sm font-semibold capitalize',
            isToday && 'text-primary'
          )}>
            {day}
          </h3>
          <span className="text-xs text-muted-foreground">
            {format(date, 'MMM d')}
          </span>
          {isToday && (
            <Badge variant="default" className="text-xs px-2 py-0">
              Today
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAddMeal}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add
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
              onEdit={() => onEdit(meal)}
              onDelete={() => onDelete(meal.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * MEAL CARD COMPONENT
 */
function MealCard({
  meal,
  onMarkCooked,
  onEdit,
  onDelete,
}: {
  meal: Meal;
  onMarkCooked: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isCooked = !!meal.cookedAt;
  const mealTypeEmoji = getMealTypeEmoji(meal.mealType);
  const totalTime = (meal.prepTime || 0) + (meal.cookTime || 0);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-md border border-border/50',
        'hover:bg-accent/30 transition-colors group',
        isCooked && 'opacity-60 bg-muted/30'
      )}
    >
      {/* Meal type emoji */}
      <span className="text-lg shrink-0">{mealTypeEmoji}</span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-sm font-medium',
              isCooked && 'line-through text-muted-foreground'
            )}
          >
            {meal.name}
          </span>

          <Badge variant="outline" className="text-xs capitalize">
            {meal.mealType}
          </Badge>

          {totalTime > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{totalTime}m</span>
            </div>
          )}

          {meal.recipeUrl && (
            <a
              href={meal.recipeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-xs flex items-center gap-1"
            >
              Recipe <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {meal.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{meal.description}</p>
        )}

        {isCooked && meal.cookedBy && (
          <div className="flex items-center gap-1 mt-1">
            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
            <UserAvatar
              name={meal.cookedBy.name}
              color={meal.cookedBy.color}
              size="sm"
              className="h-4 w-4 text-[8px]"
            />
            <span className="text-xs text-muted-foreground">
              {meal.cookedBy.name} cooked this
            </span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {!isCooked && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onMarkCooked}
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <CheckCircle2 className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit2 className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-7 w-7 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

/**
 * GET MEAL TYPE EMOJI
 */
function getMealTypeEmoji(mealType: string): string {
  switch (mealType) {
    case 'breakfast': return '🌅';
    case 'lunch': return '🌮';
    case 'dinner': return '🍽️';
    case 'snack': return '🍿';
    default: return '🍴';
  }
}

/**
 * MEAL MODAL COMPONENT
 */
function MealModal({
  weekOf,
  meal,
  defaultDay,
  onClose,
  onSave,
  familyMembers,
}: {
  weekOf: string;
  meal?: Meal;
  defaultDay?: Meal['dayOfWeek'];
  onClose: () => void;
  onSave: (meal: Omit<Meal, 'id' | 'createdAt'>) => void;
  familyMembers: FamilyMember[];
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
      cookedAt: meal?.cookedAt,
      cookedBy: meal?.cookedBy,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {meal ? 'Edit Meal' : 'Add Meal'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Meal name..."
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Day</label>
            <div className="grid grid-cols-4 gap-2 mt-1">
              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
                <Button
                  key={day}
                  type="button"
                  variant={dayOfWeek === day ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDayOfWeek(day)}
                  className="capitalize text-xs"
                >
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Meal Type</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant={mealType === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setMealType(type)}
                  className="capitalize"
                >
                  {getMealTypeEmoji(type)} {type}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Prep Time (min)</label>
              <Input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="15"
                min="0"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cook Time (min)</label>
              <Input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                placeholder="30"
                min="0"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Recipe URL (optional)</label>
            <Input
              type="url"
              value={recipeUrl}
              onChange={(e) => setRecipeUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {meal ? 'Save Changes' : 'Add Meal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
