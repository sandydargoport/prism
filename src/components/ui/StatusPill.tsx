import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * A status word ("Overdue", "Due today", "Awaiting approval") on its own solid
 * fill, with that fill's foreground colour (#891).
 *
 * Coloured text on its own failed over glass: the card is see-through, so the
 * photo behind decides the contrast, and a red or amber word measured 1.1:1 to
 * 2.8:1 over a bright sky. On a solid fill the pair is the theme's own
 * destructive / warning and its foreground, which the theme contrast check
 * already holds to 4.5:1, whatever is behind the card.
 */
export type StatusTone = 'danger' | 'warning';

const TONE: Record<StatusTone, string> = {
  danger: 'bg-destructive text-destructive-foreground',
  warning: 'bg-warning text-warning-foreground',
};

export function StatusPill({
  tone,
  icon,
  className,
  children,
}: {
  tone: StatusTone;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      data-status-pill={tone}
      className={cn(
        'inline-flex max-w-full items-center gap-0.5 rounded-full px-1.5 py-px text-xs font-medium leading-tight',
        TONE[tone],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}
