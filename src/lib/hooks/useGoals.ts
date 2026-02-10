'use client';

import { useState, useEffect, useCallback } from 'react';
import { useVisibilityPolling } from './useVisibilityPolling';

export interface Goal {
  id: string;
  name: string;
  description?: string;
  pointCost: number;
  emoji?: string;
  priority: number;
  recurring: boolean;
  recurrencePeriod?: 'weekly' | 'monthly' | 'yearly' | null;
  active: boolean;
  lastResetAt: string;
  createdAt: string;
  fullyAchieved: boolean;
}

export interface ChildProgress {
  allocated: number;
  achieved: boolean;
}

export interface GoalChild {
  userId: string;
  name: string;
  color: string;
  counters: { weekly: number; monthly: number; yearly: number };
}

interface GoalsResponse {
  goals: Goal[];
  progress: Record<string, Record<string, ChildProgress>>;
  children: GoalChild[];
}

interface UseGoalsResult {
  goals: Goal[];
  progress: Record<string, Record<string, ChildProgress>>;
  goalChildren: GoalChild[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  createGoal: (data: {
    name: string;
    description?: string;
    pointCost: number;
    emoji?: string;
    recurring?: boolean;
    recurrencePeriod?: 'weekly' | 'monthly' | 'yearly';
  }) => Promise<void>;
  updateGoal: (id: string, data: Partial<{
    name: string;
    description?: string;
    pointCost: number;
    emoji?: string;
    recurring: boolean;
    recurrencePeriod: 'weekly' | 'monthly' | 'yearly';
    active: boolean;
  }>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  reorderGoals: (goalIds: string[]) => Promise<void>;
  resetGoal: (goalId: string) => Promise<void>;
}

export function useGoals(refreshInterval = 2 * 60 * 1000): UseGoalsResult {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [progress, setProgress] = useState<Record<string, Record<string, ChildProgress>>>({});
  const [goalChildren, setGoalChildren] = useState<GoalChild[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    try {
      setError(null);
      const response = await fetch('/api/goals');
      if (!response.ok) throw new Error('Failed to fetch goals');

      const data: GoalsResponse = await response.json();
      setGoals(data.goals);
      setProgress(data.progress);
      setGoalChildren(data.children);
    } catch (err) {
      console.error('Error fetching goals:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch goals');
    } finally {
      setLoading(false);
    }
  }, []);

  const createGoal = useCallback(async (data: {
    name: string;
    description?: string;
    pointCost: number;
    emoji?: string;
    recurring?: boolean;
    recurrencePeriod?: 'weekly' | 'monthly' | 'yearly';
  }) => {
    const response = await fetch('/api/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create goal');
    }
    await fetchGoals();
  }, [fetchGoals]);

  const updateGoal = useCallback(async (id: string, data: Record<string, unknown>) => {
    const response = await fetch(`/api/goals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to update goal');
    }
    await fetchGoals();
  }, [fetchGoals]);

  const deleteGoal = useCallback(async (id: string) => {
    const response = await fetch(`/api/goals/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to delete goal');
    }
    await fetchGoals();
  }, [fetchGoals]);

  const reorderGoals = useCallback(async (goalIds: string[]) => {
    const response = await fetch('/api/goals/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: goalIds }),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to reorder goals');
    }
    await fetchGoals();
  }, [fetchGoals]);

  const resetGoal = useCallback(async (goalId: string) => {
    const response = await fetch(`/api/goals/${goalId}/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to reset goal');
    }
    await fetchGoals();
  }, [fetchGoals]);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  useVisibilityPolling(fetchGoals, refreshInterval);

  return {
    goals, progress, goalChildren, loading, error,
    refresh: fetchGoals, createGoal, updateGoal, deleteGoal, reorderGoals, resetGoal,
  };
}
