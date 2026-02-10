import { Suspense } from 'react';
import { BabysitterView } from './BabysitterView';

export const metadata = {
  title: 'Babysitter Info',
  description: 'Important information for babysitters and caregivers.',
};

export default function BabysitterPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<BabysitterSkeleton />}>
        <BabysitterView />
      </Suspense>
    </main>
  );
}

function BabysitterSkeleton() {
  return (
    <div className="h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 bg-muted rounded animate-pulse" />
        <div className="h-10 w-24 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
            <div className="h-32 bg-muted/50 rounded-lg animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
