/**
 * ============================================================================
 * PRISM - Full Tasks Page
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * The full task management page with filtering, sorting, and full CRUD.
 * This is the expanded version of the tasks widget.
 *
 * FEATURES:
 * - View all tasks with filtering
 * - Filter by person, priority, category
 * - Sort by due date, priority, creation date
 * - Add new tasks
 * - Edit existing tasks
 * - Mark tasks complete/incomplete
 * - Delete tasks
 *
 * ============================================================================
 */

import { Suspense } from 'react';
import { TasksView } from './TasksView';


/**
 * PAGE METADATA
 */
export const metadata = {
  title: 'Tasks',
  description: 'Manage your family tasks and to-dos.',
};


/**
 * TASKS PAGE COMPONENT
 */
export default function TasksPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<TasksSkeleton />}>
        <TasksView />
      </Suspense>
    </main>
  );
}


/**
 * TASKS SKELETON
 */
function TasksSkeleton() {
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

      {/* Filter bar skeleton */}
      <div className="flex gap-2 mb-4">
        <div className="h-10 w-40 bg-muted rounded animate-pulse" />
        <div className="h-10 w-40 bg-muted rounded animate-pulse" />
        <div className="h-10 w-40 bg-muted rounded animate-pulse" />
      </div>

      {/* Task list skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
