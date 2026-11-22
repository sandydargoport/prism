'use client';

import { cn } from '@/lib/utils';
import type { PadSize } from './NumberPad';

/**
 * The dots above the PIN pad (#1196): one per digit, filled as they are typed,
 * red on a wrong PIN, shaking while it shakes. Sized with the pad it sits over.
 */
const DOTS: Record<PadSize, { row: string; dot: string }> = {
  compact: { row: 'gap-1.5 mb-1', dot: 'w-2.5 h-2.5' },
  large: { row: 'gap-3 mb-4', dot: 'w-3 h-3' },
};

export interface PinDisplayProps {
  length: number;
  filled: number;
  error: boolean;
  isShaking: boolean;
  size?: PadSize;
}

export function PinDisplay({ length, filled, error, isShaking, size = 'compact' }: PinDisplayProps) {
  const s = DOTS[size];
  return (
    <div className={cn('flex justify-center', s.row, isShaking && 'animate-shake')} data-pin-dots={filled}>
      {Array.from({ length }, (_, i) => (
        <div
          key={i}
          className={cn(
            s.dot, 'rounded-full transition-all duration-150',
            i < filled ? (error ? 'bg-destructive scale-110' : 'bg-primary scale-110') : 'bg-muted border-2 border-border',
          )}
        />
      ))}
    </div>
  );
}
