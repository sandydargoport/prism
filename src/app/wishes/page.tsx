import { Suspense } from 'react';
import { WishesView } from './WishesView';

export const metadata = {
  title: 'Wishes',
  description: 'Family wish lists for birthdays, holidays, and anytime.',
};

export default function WishesPage() {
  return (
    <main className="min-h-fill bg-background">
      <Suspense fallback={<WishesSkeleton />}>
        <WishesView />
      </Suspense>
    </main>
  );
}

function WishesSkeleton() {
  return (
    <div className="h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-10 w-24 bg-muted rounded animate-pulse" />
      </div>
      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded animate-pulse" />
        ))}
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    </div>
  );
}
