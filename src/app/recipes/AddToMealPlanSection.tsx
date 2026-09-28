'use client';

import { useState } from 'react';
import { addDays, format, isBefore, isSameDay, parseISO, startOfWeek } from 'date-fns';
import { CalendarPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { useAuth, useTimeFormat } from '@/components/providers';
import { useLocalDateKey } from '@/lib/hooks/useLocalDateKey';
import { getWeekStartsOn } from '@/lib/hooks/useWeekStartsOn';
import type { Recipe } from '@/lib/hooks/useRecipes';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack',
};

// Build 2 full weeks starting from the week that contains today
function buildCalendarWeeks(today: Date, weekStartsOn: 0 | 1): Date[][] {
  const weekStart = startOfWeek(today, { weekStartsOn });
  const weeks: Date[][] = [];
  for (let w = 0; w < 2; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(addDays(weekStart, w * 7 + d));
    }
    weeks.push(week);
  }
  return weeks;
}

const DAY_HEADERS_SUN = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_HEADERS_MON = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function AddToMealPlanSection({ recipe }: { recipe: Recipe }) {
  const { requireAuth } = useAuth();
  const weekStartsOn = getWeekStartsOn();
  // Today in the display zone, as a local-midnight Date for date-fns.
  const { displayTimezone } = useTimeFormat();
  const today = parseISO(useLocalDateKey(displayTimezone));
  const weeks = buildCalendarWeeks(today, weekStartsOn);
  const dayHeaders = weekStartsOn === 1 ? DAY_HEADERS_MON : DAY_HEADERS_SUN;

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [mealType, setMealType] = useState<MealType>('dinner');
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!selectedDate) return;
    if (!await requireAuth('Add to Meal Plan', 'Please log in to add meals')) return;
    setSaving(true);
    try {
      const weekOf = format(startOfWeek(selectedDate, { weekStartsOn }), 'yyyy-MM-dd');
      const dayOfWeek = format(selectedDate, 'EEEE').toLowerCase();
      const res = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: recipe.name, recipeId: recipe.id, weekOf, dayOfWeek, mealType }),
      });
      if (!res.ok) throw new Error();
      const dayLabel = isSameDay(selectedDate, today) ? 'today'
        : isSameDay(selectedDate, addDays(today, 1)) ? 'tomorrow'
        : format(selectedDate, 'EEEE').toLowerCase();
      toast({ title: `Added to ${dayLabel}'s ${MEAL_LABELS[mealType].toLowerCase()}`, variant: 'success' });
      setSelectedDate(null);
    } catch {
      toast({ title: 'Failed to add to meal plan', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarPlus className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Add to Meal Plan</span>
      </div>

      {/* Mini calendar grid */}
      <div className="select-none">
        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {dayHeaders.map((h, i) => (
            <div key={i} className="text-center text-[11px] font-medium text-muted-foreground py-0.5">
              {h}
            </div>
          ))}
        </div>
        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((date) => {
              const isToday = isSameDay(date, today);
              const isPastDay = isBefore(date, today);
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
              return (
                <div key={date.toISOString()} className="flex flex-col items-center py-0.5">
                  <button
                    onClick={() => setSelectedDate(isSelected ? null : date)}
                    className={cn(
                      'w-8 h-8 rounded-full text-sm font-medium transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : isPastDay
                        ? 'text-muted-foreground/50 hover:bg-accent'
                        : 'hover:bg-accent text-foreground'
                    )}
                  >
                    {format(date, 'd')}
                  </button>
                  {/* Today indicator dot */}
                  {isToday && (
                    <div className={cn('w-1 h-1 rounded-full mt-0.5', isSelected ? 'bg-primary-foreground' : 'bg-primary')} />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Meal type toggle + confirm */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center border rounded-md overflow-hidden text-xs shrink-0">
          {MEAL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setMealType(type)}
              className={cn(
                'px-2.5 py-1.5 transition-colors',
                mealType === type
                  ? 'bg-secondary text-secondary-foreground font-medium'
                  : 'text-muted-foreground hover:bg-accent'
              )}
            >
              {MEAL_LABELS[type]}
            </button>
          ))}
        </div>
        <Button
          size="sm"
          className="ml-auto"
          disabled={!selectedDate || saving}
          onClick={handleAdd}
        >
          {saving ? 'Adding…' : 'Add to Plan'}
        </Button>
      </div>
    </div>
  );
}
