/**
 *
 * The full meal planning page with weekly view and meal management.
 * This is the expanded version of the meals widget.
 *
 * FEATURES:
 * - Weekly meal planner grid
 * - Navigate between weeks
 * - Add/edit/delete meals
 * - Mark meals as cooked
 * - Recipe links
 * - Prep/cook time tracking
 * - Ingredient lists
 *
 */

import { Suspense } from 'react';
import { MealsView } from './MealsView';


/**
 * PAGE METADATA
 */
export const metadata = {
  title: 'Meal Planner',
  description: 'Plan your weekly meals and track recipes.',
};


/**
 * MEALS PAGE COMPONENT
 */
export default function MealsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<MealsSkeleton />}>
        <MealsView />
      </Suspense>
    </main>
  );
}


/**
 * MEALS SKELETON
 */
function MealsSkeleton() {
  return (
    <div className="h-screen flex flex-col p-4">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
          <div className="h-10 w-24 bg-muted rounded animate-pulse" />
        </div>
      </div>

      {/* Week navigation skeleton */}
      <div className="flex gap-2 mb-4 justify-center">
        <div className="h-10 w-10 bg-muted rounded animate-pulse" />
        <div className="h-10 w-48 bg-muted rounded animate-pulse" />
        <div className="h-10 w-10 bg-muted rounded animate-pulse" />
      </div>

      {/* Week grid skeleton */}
      <div className="space-y-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            <div className="h-16 bg-muted/50 rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
