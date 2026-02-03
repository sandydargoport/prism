import { Suspense } from 'react';
import { PhotosView } from './PhotosView';

export const metadata = {
  title: 'Photos',
  description: 'Photo gallery and slideshow management.',
};

export default function PhotosPage() {
  return (
    <main className="min-h-screen bg-background">
      <Suspense fallback={<PhotosSkeleton />}>
        <PhotosView />
      </Suspense>
    </main>
  );
}

function PhotosSkeleton() {
  return (
    <div className="h-screen flex flex-col p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-32 bg-muted rounded animate-pulse" />
        <div className="h-10 w-24 bg-muted rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}
