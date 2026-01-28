/**
 * ============================================================================
 * PRISM - Meals Widget
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * Displays the weekly meal plan with recipes and cooking status.
 *
 * FEATURES:
 * - Weekly meal plan grid (Monday-Sunday)
 * - Meal types (breakfast, lunch, dinner, snack)
 * - Recipe links
 * - Cooking status (who cooked, when)
 * - Quick mark as cooked button
 * - Prep/cook time indicators
 *
 * INTERACTION:
 * - Tap meal to see recipe details
 * - Mark meal as cooked
 * - Navigate between weeks
 *
 * USAGE:
 *   <MealsWidget />
 *   <MealsWidget weekOf="2026-01-20" />
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { UtensilsCrossed, Plus, ChevronLeft, ChevronRight, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { Button, Badge, ScrollArea, UserAvatar } from '@/components/ui';

/**
 * MEAL TYPE
 * ============================================================================
 */
export interface Meal {
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
  createdBy?: {
    id: string;
    name: string;
    color: string;
  };
  createdAt: Date;
}

/**
 * MEALS WIDGET PROPS
 * ============================================================================
 */
export interface MealsWidgetProps {
  /** Meals to display (if provided externally) */
  meals?: Meal[];
  /** Week to display (YYYY-MM-DD format, defaults to current week) */
  weekOf?: string;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Callback when meal is marked as cooked */
  onMarkCooked?: (mealId: string) => void;
  /** Callback when add button is clicked */
  onAddClick?: () => void;
  /** Callback when week changes */
  onWeekChange?: (weekOf: string) => void;
  /** URL for the full meals page (makes title clickable) */
  titleHref?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * MEALS WIDGET COMPONENT
 * ============================================================================
 * Displays a weekly meal plan.
 *
 * @example Basic usage
 * <MealsWidget />
 *
 * @example Specific week
 * <MealsWidget weekOf="2026-01-20" />
 *
 * @example With callbacks
 * <MealsWidget
 *   onMarkCooked={(id) => handleCooked(id)}
 *   onAddClick={() => openAddMealDialog()}
 * />
 * ============================================================================
 */
export function MealsWidget({
  meals: externalMeals,
  weekOf,
  loading = false,
  error = null,
  onMarkCooked,
  onAddClick,
  onWeekChange,
  titleHref,
  className,
}: MealsWidgetProps) {
  // Determine current week
  const today = new Date();
  const defaultWeekStart = startOfWeek(today, { weekStartsOn: 1 }); // Monday
  const [currentWeek, setCurrentWeek] = useState<Date>(
    weekOf ? startOfWeek(parseISO(weekOf), { weekStartsOn: 1 }) : defaultWeekStart
  );

  // Use provided meals (no demo data fallback in production)
  const allMeals = externalMeals || [];

  // Filter meals for current week
  const weekOfString = format(currentWeek, 'yyyy-MM-dd');
  const weekMeals = allMeals.filter((meal) => meal.weekOf === weekOfString);

  // Group meals by day
  const mealsByDay = groupMealsByDay(weekMeals);

  // Navigation handlers
  const goToPreviousWeek = () => {
    const newWeek = addDays(currentWeek, -7);
    setCurrentWeek(newWeek);
    onWeekChange?.(format(newWeek, 'yyyy-MM-dd'));
  };

  const goToNextWeek = () => {
    const newWeek = addDays(currentWeek, 7);
    setCurrentWeek(newWeek);
    onWeekChange?.(format(newWeek, 'yyyy-MM-dd'));
  };

  const goToThisWeek = () => {
    setCurrentWeek(defaultWeekStart);
    onWeekChange?.(format(defaultWeekStart, 'yyyy-MM-dd'));
  };

  const isCurrentWeek = format(currentWeek, 'yyyy-MM-dd') === format(defaultWeekStart, 'yyyy-MM-dd');

  return (
    <WidgetContainer
      title="Meals"
      titleHref={titleHref}
      icon={<UtensilsCrossed className="h-4 w-4" />}
      size="large"
      loading={loading}
      error={error}
      actions={
        <div className="flex items-center gap-2">
          <span className="text-xs font-normal text-muted-foreground">
            {format(currentWeek, 'MMM d')} - {format(addDays(currentWeek, 6), 'MMM d')}
          </span>
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              goToPreviousWeek();
            }}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {!isCurrentWeek && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                goToThisWeek();
              }}
              className="h-8 px-2 text-xs"
            >
              Today
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              goToNextWeek();
            }}
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {onAddClick && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onAddClick();
              }}
              className="h-8 w-8"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      }
      className={className}
    >
      {weekMeals.length === 0 ? (
        <WidgetEmpty
          icon={<UtensilsCrossed className="h-8 w-8" />}
          message="No meals planned this week"
          action={
            onAddClick && (
              <Button size="sm" variant="outline" onClick={onAddClick}>
                Add Meal
              </Button>
            )
          }
        />
      ) : (
        <ScrollArea className="h-full -mr-2 pr-2">
          <div className="space-y-3">
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day, index) => {
              const dayMeals = mealsByDay[day as keyof typeof mealsByDay] || [];
              const dayDate = addDays(currentWeek, index);
              const isToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

              return (
                <DaySection
                  key={day}
                  day={day as Meal['dayOfWeek']}
                  date={dayDate}
                  meals={dayMeals}
                  isToday={isToday}
                  onMarkCooked={onMarkCooked}
                />
              );
            })}
          </div>
        </ScrollArea>
      )}
    </WidgetContainer>
  );
}

/**
 * DAY SECTION
 * ============================================================================
 * Displays meals for a single day of the week.
 * ============================================================================
 */
function DaySection({
  day,
  date,
  meals,
  isToday,
  onMarkCooked,
}: {
  day: Meal['dayOfWeek'];
  date: Date;
  meals: Meal[];
  isToday: boolean;
  onMarkCooked?: (mealId: string) => void;
}) {
  if (meals.length === 0) return null;

  return (
    <div className={cn('space-y-1', isToday && 'rounded-lg bg-accent/30 p-2 -m-2')}>
      <div className="flex items-center gap-2">
        <h4 className={cn('text-sm font-semibold capitalize', isToday && 'text-primary')}>
          {day}
        </h4>
        <span className="text-xs text-muted-foreground">
          {format(date, 'MMM d')}
        </span>
        {isToday && (
          <Badge variant="default" className="text-[10px] px-1.5 py-0">
            Today
          </Badge>
        )}
      </div>
      <div className="space-y-1">
        {meals.map((meal) => (
          <MealItem key={meal.id} meal={meal} onMarkCooked={onMarkCooked} />
        ))}
      </div>
    </div>
  );
}

/**
 * MEAL ITEM
 * ============================================================================
 * A single meal with details and cooking status.
 * ============================================================================
 */
function MealItem({
  meal,
  onMarkCooked,
}: {
  meal: Meal;
  onMarkCooked?: (mealId: string) => void;
}) {
  const isCooked = !!meal.cookedAt;
  const mealTypeEmoji = getMealTypeEmoji(meal.mealType);

  return (
    <div
      className={cn(
        'flex items-start gap-2 p-2 rounded-md',
        'hover:bg-accent/50 transition-colors',
        isCooked && 'opacity-60'
      )}
    >
      {/* Meal type emoji */}
      <span className="text-base shrink-0">{mealTypeEmoji}</span>

      {/* Meal content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-medium truncate',
              isCooked && 'line-through text-muted-foreground'
            )}
          >
            {meal.name}
          </span>

          {/* Meal type badge */}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
            {meal.mealType}
          </Badge>

          {/* Time indicator */}
          {(meal.prepTime || meal.cookTime) && (
            <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                {(meal.prepTime || 0) + (meal.cookTime || 0)}m
              </span>
            </div>
          )}
        </div>

        {/* Cooked status */}
        {isCooked && meal.cookedBy && (
          <div className="flex items-center gap-1 mt-0.5">
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

      {/* Mark cooked button */}
      {!isCooked && onMarkCooked && (
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onMarkCooked(meal.id)}
          className="h-7 w-7 shrink-0"
        >
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * GROUP MEALS BY DAY
 * ============================================================================
 * Groups meals by day of week, sorting by meal type.
 * ============================================================================
 */
function groupMealsByDay(meals: Meal[]): Record<Meal['dayOfWeek'], Meal[]> {
  const grouped: Record<Meal['dayOfWeek'], Meal[]> = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };

  meals.forEach((meal) => {
    grouped[meal.dayOfWeek].push(meal);
  });

  // Sort each day's meals by meal type
  const mealTypeOrder = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  Object.keys(grouped).forEach((day) => {
    grouped[day as Meal['dayOfWeek']].sort(
      (a, b) => mealTypeOrder[a.mealType] - mealTypeOrder[b.mealType]
    );
  });

  return grouped;
}

/**
 * GET MEAL TYPE EMOJI
 * ============================================================================
 * Returns an emoji for the meal type.
 * ============================================================================
 */
function getMealTypeEmoji(mealType: string): string {
  switch (mealType) {
    case 'breakfast':
      return '🌅';
    case 'lunch':
      return '🌮';
    case 'dinner':
      return '🍽️';
    case 'snack':
      return '🍿';
    default:
      return '🍴';
  }
}

