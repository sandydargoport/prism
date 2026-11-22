'use client';

import { useState } from 'react';
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
 *
 * For a member with a passcode (#1197) the blank key is **ABC**, which swaps
 * in lowercase letters (a QWERTY layout, then **123** and Del). The letter
 * layout is marked `data-pin-letters`, so the card around it can widen while
 * it shows (`has-[[data-pin-letters]]:`). It is not the on-screen keyboard:
 * that one's first-tap fix stays out of the sign-in path.
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
  /** Offer letters as well as digits: the member has a passcode. */
  letters?: boolean;
  className?: string;
}

const LETTER_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export function NumberPad({ onKeyPress, onBackspace, disabled = false, size = 'compact', letters = false, className }: NumberPadProps) {
  const s = PAD[size];
  const [abc, setAbc] = useState(false);
  const flat = 'rounded-lg flex items-center justify-center transition-all duration-100';
  const digitKey = 'bg-secondary hover:bg-secondary/80 active:bg-primary active:text-primary-foreground active:scale-95 font-semibold';
  const quietKey = 'bg-muted hover:bg-muted/80 active:bg-accent active:scale-95 text-muted-foreground';

  if (letters && abc) {
    const h = size === 'large' ? 'h-14' : 'h-11';
    return (
      <div className={cn('flex w-full flex-col gap-1.5', className)} data-pin-pad={size} data-pin-letters>
        {LETTER_ROWS.map((row) => (
          <div key={row} className="flex justify-center gap-1">
            {[...row].map((ch) => (
              <button
                key={ch}
                type="button"
                onClick={() => onKeyPress(ch)}
                disabled={disabled}
                aria-label={ch}
                data-pin-key={ch}
                className={cn(flat, h, 'min-w-0 flex-1 max-w-12', digitKey, s.digit, disabled && 'opacity-50')}
              >
                {ch}
              </button>
            ))}
          </div>
        ))}
        <div className="flex justify-center gap-1">
          <button type="button" onClick={() => setAbc(false)} disabled={disabled} aria-label="Numbers" data-pin-key="123"
            className={cn(flat, h, 'w-24', quietKey, s.del, disabled && 'opacity-50')}>123</button>
          <button type="button" onClick={onBackspace} disabled={disabled} aria-label="Delete last digit" data-pin-key="del"
            className={cn(flat, h, 'w-24', quietKey, s.del, disabled && 'opacity-50')}>Del</button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-3 mx-auto', s.grid, className)} data-pin-pad={size}>
      {KEYS.map((key, idx) => {
        if (key === '') {
          if (!letters) return <div key={idx} />;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setAbc(true)}
              disabled={disabled}
              aria-label="Letters"
              data-pin-key="abc"
              className={cn(s.key, 'rounded-full mx-auto flex items-center justify-center transition-all duration-100', quietKey, s.del, disabled && 'opacity-50')}
            >
              ABC
            </button>
          );
        }
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
