'use client';

import { Zap } from 'lucide-react';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';

export function PerformanceModeBadge() {
  const { level, setMode } = usePerformanceMode();
  if (level === 'full') return null;

  const label = `Performance: ${level === 'minimal' ? 'Minimal' : 'Reduced'} (click for Full)`;
  return (
    <button
      onClick={() => setMode('full')}
      className="p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground"
      aria-label={label}
      title={label}
    >
      <Zap className="h-4 w-4" />
    </button>
  );
}
