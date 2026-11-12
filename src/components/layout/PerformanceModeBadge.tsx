'use client';

import { Zap } from 'lucide-react';
import { usePerformanceMode } from '@/lib/hooks/usePerformanceMode';

/** Named in the wall's More panel (#1006); an icon with a tooltip elsewhere. */
export function PerformanceModeBadge({ labelled = false, className }: { labelled?: boolean; className?: string } = {}) {
  const { level, setMode } = usePerformanceMode();
  if (level === 'full') return null;

  const label = `Performance: ${level === 'minimal' ? 'Minimal' : 'Reduced'} (click for Full)`;
  return (
    <button
      onClick={() => setMode('full')}
      className={className ?? 'p-2 rounded-md hover:bg-accent transition-colors text-muted-foreground'}
      aria-label={label}
      title={label}
      data-screen-job="performance"
    >
      <Zap className={labelled ? 'h-5 w-5' : 'h-4 w-4'} />
      {labelled && <span>Performance</span>}
    </button>
  );
}
