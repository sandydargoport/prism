'use client';

/**
 * Today's meal plan on the Babysitter Mode overlay (#638), read-only, so the
 * sitter knows what to make. The overlay covers every page while the mode is
 * on, so this is also what a sitter sees on /babysitter. It reads
 * /api/guest-meals, which answers only while the mode is on and only with
 * each meal's name and slot for the household's today.
 *
 * Nothing planned, or a failed read, renders nothing: the sitter has no use
 * for an empty card, and the rest of the screen skips empty sections too.
 */

import { useCallback, useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { Emoji } from '@/components/ui/Emoji';
import { useVisibilityPolling } from '@/lib/hooks/useVisibilityPolling';
import { cn } from '@/lib/utils';

type GuestMeal = {
  name: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
};

const SLOT_EMOJI: Record<string, string> = {
  breakfast: '🌅',
  lunch: '🌮',
  snack: '🍿',
  dinner: '🍽️',
};

/** Picks up a changed plan, and the next day's plan after midnight. */
const REFRESH_MS = 5 * 60 * 1000;

type GuestMealsCardProps = {
  className?: string;
};

/**
 * Today's meals, an empty list when the server says no (the mode is off), or
 * null when it could not be reached, so a blip keeps what is showing.
 */
async function fetchTodaysMeals(): Promise<GuestMeal[] | null> {
  try {
    const res = await fetch('/api/guest-meals');
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body?.meals) ? body.meals : [];
  } catch {
    return null;
  }
}

export function GuestMealsCard({ className }: GuestMealsCardProps) {
  const [meals, setMeals] = useState<GuestMeal[]>([]);

  const load = useCallback(() => {
    fetchTodaysMeals().then((next) => {
      if (next) setMeals(next);
    });
  }, []);

  useEffect(load, [load]);

  useVisibilityPolling(load, REFRESH_MS);

  if (meals.length === 0) return null;

  return (
    <div
      className={cn(
        'bg-white/10 backdrop-blur-xs rounded-xl p-4 border border-white/20',
        className
      )}
    >
      <h2 className="flex items-center gap-2 text-lg font-semibold text-white mb-3">
        <UtensilsCrossed className="h-5 w-5" />
        Today&apos;s Meals
      </h2>
      <ul className="space-y-2">
        {meals.map((meal, i) => (
          <li
            key={`${meal.mealType}-${i}`}
            className="flex items-center gap-3 p-3 bg-white/10 rounded-lg"
          >
            <Emoji e={SLOT_EMOJI[meal.mealType] ?? '🍴'} />
            <span className="text-sm text-white/60 capitalize w-20 shrink-0">
              {meal.mealType}
            </span>
            <span className="font-medium text-white">{meal.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
