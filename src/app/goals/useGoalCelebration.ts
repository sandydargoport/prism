'use client';

import { useEffect, useState } from 'react';
import type { Goal } from '@/lib/hooks/useGoals';

const STORAGE_KEY = 'prism:celebrated-goals';

function readCelebrated(): Set<string> {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

/**
 * Celebrate each fully achieved goal once per session.
 *
 * Kept in sessionStorage so the animation fires on first visit and when a goal
 * is achieved live, but not again after navigating away and back. A goal that
 * stops being achieved (a reset) is forgotten, so achieving it again
 * celebrates again. One celebration at a time; the next waits for `finish`.
 */
export function useGoalCelebration(goals: Goal[]) {
  const [celebrated, setCelebrated] = useState(readCelebrated);
  const [celebratingGoal, setCelebratingGoal] = useState<string | null>(null);

  // Follow the goals during render rather than in an effect, so the
  // celebration starts in the same render that sees the goal achieved. An
  // empty list is still loading, and says nothing about what was reset.
  if (goals.length > 0) {
    const achieved = new Set(goals.filter((g) => g.fullyAchieved).map((g) => g.id));
    const kept = [...celebrated].filter((id) => achieved.has(id));
    const next = celebratingGoal === null
      ? goals.find((g) => g.fullyAchieved && !celebrated.has(g.id))
      : undefined;
    if (next || kept.length !== celebrated.size) {
      setCelebrated(new Set(next ? [...kept, next.id] : kept));
      if (next) setCelebratingGoal(next.name);
    }
  }

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...celebrated]));
    } catch {
      // Storage refused: celebrations just repeat on the next visit.
    }
  }, [celebrated]);

  return { celebratingGoal, finish: () => setCelebratingGoal(null) };
}
