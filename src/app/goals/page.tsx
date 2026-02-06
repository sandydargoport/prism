import { Suspense } from 'react';
import { GoalsView } from './GoalsView';

export const metadata = {
  title: 'Goals',
  description: 'Manage goals and track points earned from chores.',
};

export default function GoalsPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<GoalsSkeleton />}>
        <GoalsView />
      </Suspense>
    </main>
  );
}

function GoalsSkeleton() {
  return (
    <div className="h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-10 w-24 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
