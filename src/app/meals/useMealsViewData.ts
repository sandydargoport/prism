'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, startOfWeek, addDays } from 'date-fns';
import { useAuth } from '@/components/providers/AuthProvider';
import type { Meal } from '@/types';

const mealTypeOrder: Record<string, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };

export function useMealsViewData() {
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

  const goToPreviousWeek = useCallback(() => setCurrentWeek(prev => addDays(prev, -7)), []);
  const goToNextWeek = useCallback(() => setCurrentWeek(prev => addDays(prev, 7)), []);
  const goToThisWeek = useCallback(() => setCurrentWeek(defaultWeekStart), [defaultWeekStart]);
  const isCurrentWeek = format(currentWeek, 'yyyy-MM-dd') === format(defaultWeekStart, 'yyyy-MM-dd');

  const mealsByDay = meals.reduce<Record<string, Meal[]>>((acc, meal) => {
    if (!acc[meal.dayOfWeek]) acc[meal.dayOfWeek] = [];
    acc[meal.dayOfWeek]!.push(meal);
    return acc;
  }, {});
  Object.values(mealsByDay).forEach((dayMeals) => {
    dayMeals.sort((a, b) => (mealTypeOrder[a.mealType] ?? 9) - (mealTypeOrder[b.mealType] ?? 9));
  });

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

  const deleteMeal = async (mealId: string) => {
    if (!confirm('Delete this meal?')) return;
    try {
      await fetch(`/api/meals/${mealId}`, { method: 'DELETE' });
      await fetchMeals();
    } catch (err) {
      console.error('Failed to delete meal:', err);
    }
  };

  const addMeal = async (meal: Record<string, unknown>) => {
    const user = await requireAuth("Who's planning this meal?");
    if (!user) return;
    try {
      const response = await fetch('/api/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meal, createdBy: user.id }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create meal');
      }
      await fetchMeals();
    } catch (err) {
      console.error('Failed to add meal:', err);
      alert(err instanceof Error ? err.message : 'Failed to add meal');
    }
  };

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

  return {
    today, currentWeek, weekOfString, loading,
    showAddModal, setShowAddModal,
    selectedDay, setSelectedDay,
    editingMeal, setEditingMeal,
    goToPreviousWeek, goToNextWeek, goToThisWeek, isCurrentWeek,
    mealsByDay,
    markCooked, unmarkCooked, deleteMeal, addMeal, editMeal, handleDropMeal,
    totalMeals, cookedMeals,
  };
}
