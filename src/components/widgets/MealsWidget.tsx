'use client';

import * as React from 'react';
import { useState } from 'react';
import { format, startOfWeek, addDays, parseISO } from 'date-fns';
import { UtensilsCrossed, Plus, ChevronLeft, ChevronRight, Clock, CheckCircle2, Undo2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { Button, Badge, ScrollArea, UserAvatar } from '@/components/ui';
import { Input } from '@/components/ui/input';

// Meal type imported from shared types
import type { Meal } from '@/types';
export type { Meal };

export interface MealsWidgetProps {
  meals?: Meal[];
  weekOf?: string;
  loading?: boolean;
  error?: string | null;
  onMarkCooked?: (mealId: string) => void;
  onUnmarkCooked?: (mealId: string) => void;
  onAddMeal?: (meal: Record<string, unknown>) => void;
  onAddClick?: () => void;
  onWeekChange?: (weekOf: string) => void;
  titleHref?: string;
  className?: string;
}

export function MealsWidget({
  meals: externalMeals,
  weekOf,
  loading = false,
  error = null,
  onMarkCooked,
  onUnmarkCooked,
  onAddMeal,
  onAddClick,
  onWeekChange,
  titleHref,
  className,
}: MealsWidgetProps) {
  const today = new Date();
  const defaultWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const [currentWeek, setCurrentWeek] = useState<Date>(
    weekOf ? startOfWeek(parseISO(weekOf), { weekStartsOn: 1 }) : defaultWeekStart
  );
  const [showAddModal, setShowAddModal] = useState(false);

  const allMeals = externalMeals || [];
  const weekOfString = format(currentWeek, 'yyyy-MM-dd');
  const weekMeals = allMeals.filter((meal) => meal.weekOf === weekOfString);
  const mealsByDay = groupMealsByDay(weekMeals);

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

  const handleAddClick = () => {
    if (onAddMeal) {
      setShowAddModal(true);
    } else if (onAddClick) {
      onAddClick();
    }
  };

  return (
    <>
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
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); goToPreviousWeek(); }} className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {!isCurrentWeek && (
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); goToThisWeek(); }} className="h-8 px-2 text-xs">
                Today
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); goToNextWeek(); }} className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleAddClick(); }} className="h-8 w-8">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        }
        className={className}
      >
        {weekMeals.length === 0 ? (
          <WidgetEmpty
            icon={<UtensilsCrossed className="h-8 w-8" />}
            message="No meals planned this week"
            action={
              <Button size="sm" variant="outline" onClick={handleAddClick}>
                Add Meal
              </Button>
            }
          />
        ) : (
          <ScrollArea className="h-full -mr-2 pr-2">
            <div className="space-y-3">
              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day, index) => {
                const dayMeals = mealsByDay[day] || [];
                const dayDate = addDays(currentWeek, index);
                const isToday = format(dayDate, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');
                return (
                  <DaySection
                    key={day}
                    day={day}
                    date={dayDate}
                    meals={dayMeals}
                    isToday={isToday}
                    onMarkCooked={onMarkCooked}
                    onUnmarkCooked={onUnmarkCooked}
                  />
                );
              })}
            </div>
          </ScrollArea>
        )}
      </WidgetContainer>

      {showAddModal && (
        <WidgetAddMealModal
          weekOf={weekOfString}
          onClose={() => setShowAddModal(false)}
          onSave={(meal) => {
            onAddMeal?.(meal);
            setShowAddModal(false);
          }}
        />
      )}
    </>
  );
}

function DaySection({
  day, date, meals, isToday, onMarkCooked, onUnmarkCooked,
}: {
  day: Meal['dayOfWeek'];
  date: Date;
  meals: Meal[];
  isToday: boolean;
  onMarkCooked?: (mealId: string) => void;
  onUnmarkCooked?: (mealId: string) => void;
}) {
  if (meals.length === 0) return null;
  return (
    <div className={cn('space-y-1', isToday && 'rounded-lg bg-accent/30 p-2 -m-2')}>
      <div className="flex items-center gap-2">
        <h4 className={cn('text-sm font-semibold capitalize', isToday && 'text-primary')}>{day}</h4>
        <span className="text-xs text-muted-foreground">{format(date, 'MMM d')}</span>
        {isToday && <Badge variant="default" className="text-[10px] px-1.5 py-0">Today</Badge>}
      </div>
      <div className="space-y-1">
        {meals.map((meal) => (
          <MealItem key={meal.id} meal={meal} onMarkCooked={onMarkCooked} onUnmarkCooked={onUnmarkCooked} />
        ))}
      </div>
    </div>
  );
}

function MealItem({
  meal, onMarkCooked, onUnmarkCooked,
}: {
  meal: Meal;
  onMarkCooked?: (mealId: string) => void;
  onUnmarkCooked?: (mealId: string) => void;
}) {
  const isCooked = !!meal.cookedAt;
  return (
    <div className={cn('flex items-start gap-2 p-2 rounded-md', 'hover:bg-accent/50 transition-colors group', isCooked && 'opacity-60')}>
      <span className="text-base shrink-0">{getMealTypeEmoji(meal.mealType)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium truncate', isCooked && 'line-through text-muted-foreground')}>{meal.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{meal.mealType}</Badge>
          {(meal.prepTime || meal.cookTime) && (
            <div className="flex items-center gap-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{(meal.prepTime || 0) + (meal.cookTime || 0)}m</span>
            </div>
          )}
        </div>
        {isCooked && meal.cookedBy && (
          <div className="flex items-center gap-1 mt-0.5">
            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
            <UserAvatar name={meal.cookedBy.name} color={meal.cookedBy.color} size="sm" className="h-4 w-4 text-[8px]" />
            <span className="text-xs text-muted-foreground">{meal.cookedBy.name} cooked this</span>
          </div>
        )}
      </div>
      {isCooked && onUnmarkCooked ? (
        <Button size="icon" variant="ghost" onClick={() => onUnmarkCooked(meal.id)}
          className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" title="Undo">
          <Undo2 className="h-4 w-4" />
        </Button>
      ) : !isCooked && onMarkCooked ? (
        <Button size="icon" variant="ghost" onClick={() => onMarkCooked(meal.id)} className="h-7 w-7 shrink-0">
          <CheckCircle2 className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function WidgetAddMealModal({
  weekOf, onClose, onSave,
}: {
  weekOf: string;
  onClose: () => void;
  onSave: (meal: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState('');
  const [dayOfWeek, setDayOfWeek] = useState<Meal['dayOfWeek']>('monday');
  const [mealType, setMealType] = useState<Meal['mealType']>('dinner');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), weekOf, dayOfWeek, mealType });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-lg p-5 max-w-sm w-full mx-4 shadow-lg border border-border" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Add Meal</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meal name..." autoFocus />
          <div>
            <label className="text-xs font-medium text-muted-foreground">Day</label>
            <div className="grid grid-cols-4 gap-1.5 mt-1">
              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map((day) => (
                <Button key={day} type="button" variant={dayOfWeek === day ? 'default' : 'outline'}
                  size="sm" onClick={() => setDayOfWeek(day)} className="capitalize text-xs px-1">
                  {day.slice(0, 3)}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <div className="flex gap-1.5 mt-1">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                <Button key={type} type="button" variant={mealType === type ? 'default' : 'outline'}
                  size="sm" onClick={() => setMealType(type)} className="capitalize text-xs">
                  {getMealTypeEmoji(type)} {type}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={!name.trim()}>Add</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function groupMealsByDay(meals: Meal[]): Record<Meal['dayOfWeek'], Meal[]> {
  const grouped: Record<Meal['dayOfWeek'], Meal[]> = {
    monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [],
  };
  meals.forEach((meal) => { grouped[meal.dayOfWeek].push(meal); });
  const mealTypeOrder = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
  Object.keys(grouped).forEach((day) => {
    grouped[day as Meal['dayOfWeek']].sort((a, b) => mealTypeOrder[a.mealType] - mealTypeOrder[b.mealType]);
  });
  return grouped;
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
