/**
 *
 * Provides a single, consistent loading indicator used across the app.
 *
 * Before this component existed, loading states were a mix of a bordered
 * spinning div, the lucide `Loader2` icon, and pulsing icons with "Loading
 * X..." text — all slightly different. Spinner is the one canonical look;
 * PageLoader is the convenience wrapper for the common "this whole section
 * is loading" case.
 *
 * USAGE:
 *   <Spinner />
 *   <Spinner size="sm" />
 *   <PageLoader />
 *   <PageLoader label="Loading tasks..." />
 *
 */

import * as React from 'react';
import { cn } from '@/lib/utils';


const spinnerSizes = {
  sm: 'h-6 w-6',
  default: 'h-8 w-8',
  lg: 'h-12 w-12',
} as const;

export interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: keyof typeof spinnerSizes;
}

/**
 * SPINNER
 * The canonical spinning loading indicator. A plain CSS border-spin —
 * no icon dependency needed.
 *
 * @example
 * <Spinner size="sm" />
 */
const Spinner = React.forwardRef<HTMLDivElement, SpinnerProps>(
  ({ size = 'default', className, ...props }, ref) => (
    <div
      ref={ref}
      role="status"
      aria-label="Loading"
      className={cn(
        'animate-spin rounded-full border-2 border-muted border-t-foreground',
        spinnerSizes[size],
        className
      )}
      {...props}
    />
  )
);
Spinner.displayName = 'Spinner';


export interface PageLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Optional text shown below the spinner, e.g. "Loading tasks...". */
  label?: React.ReactNode;
  size?: SpinnerProps['size'];
}

/**
 * PAGE LOADER
 * Centered spinner with vertical padding — the "this whole page/section is
 * loading" case. Drop-in replacement for the many bespoke
 * `<div className="flex justify-center py-12"><div className="... animate-spin" /></div>`
 * blocks that used to be scattered across pages.
 *
 * @example
 * <PageLoader />
 *
 * @example With a label
 * <PageLoader label="Loading shopping lists..." />
 */
const PageLoader = React.forwardRef<HTMLDivElement, PageLoaderProps>(
  ({ label, size = 'default', className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col items-center justify-center gap-3 py-12', className)}
      {...props}
    >
      <Spinner size={size} />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  )
);
PageLoader.displayName = 'PageLoader';


export { Spinner, PageLoader };
