'use client';

import { cn } from '@/lib/utils';

/**
 * The PIN pad every PIN screen uses (#1196): sign-in, the Settings gate, and
 * leaving Away mode and Babysitter mode.
 *
 * | 1 | 2 | 3 |
 * | 4 | 5 | 6 |
 * | 7 | 8 | 9 |
 * |   | 0 |Del|
 *
 * Two sizes, as the screens drew them before they shared it: `compact` (48px
 * keys) in the sign-in and Settings cards, `large` (64px keys) on the
 * full-screen Away and Babysitter exits.
 */
export type PadSize = 'compact' | 'large';

const PAD: Record<PadSize, { grid: string; key: string; digit: string; del: string }> = {
  compact: { grid: 'gap-1.5 max-w-[200px]', key: 'w-12 h-12', digit: 'text-base', del: 'text-xs' },
  large: { grid: 'gap-3 max-w-[280px]', key: 'w-16 h-16', digit: 'text-lg', del: 'text-sm' },
};

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

export interface NumberPadProps {
  onKeyPress: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  size?: PadSize;
  className?: string;
}

export function NumberPad({ onKeyPress, onBackspace, disabled = false, size = 'compact', className }: NumberPadProps) {
  const s = PAD[size];
  return (
    <div className={cn('grid grid-cols-3 mx-auto', s.grid, className)} data-pin-pad={size}>
      {KEYS.map((key, idx) => {
        if (key === '') return <div key={idx} />;
        const del = key === 'del';
        return (
          <button
            key={idx}
            type="button"
            onClick={del ? onBackspace : () => onKeyPress(key)}
            disabled={disabled}
            aria-label={del ? 'Delete last digit' : key}
            data-pin-key={key}
            className={cn(
              s.key, 'rounded-full mx-auto flex items-center justify-center transition-all duration-100',
              del
                ? ['bg-muted hover:bg-muted/80 active:bg-accent active:scale-95 text-muted-foreground', s.del]
                : ['bg-secondary hover:bg-secondary/80 active:bg-primary active:text-primary-foreground active:scale-95 font-semibold', s.digit],
              disabled && 'opacity-50',
            )}
          >
            {del ? 'Del' : key}
          </button>
        );
      })}
    </div>
  );
}
