'use client';

import { Plus } from 'lucide-react';
import { useCurrentPageAdd } from '@/lib/hooks/usePageAdd';
import { cn } from '@/lib/utils';

export interface MobileFabProps {
  uiHidden?: boolean;
}

/**
 * The phone's round button (#1354): the page's Add and nothing else. A page
 * with no Add, the dashboard among them, has no round button. The phone's own
 * tools (Cards, Reorder, Reload) are under More > This phone. Never over an
 * open window.
 */
export function MobileFab({ uiHidden }: MobileFabProps) {
  const pageAdd = useCurrentPageAdd();
  if (!pageAdd) return null;
  return (
    <button
      type="button"
      onClick={pageAdd.run}
      aria-label={pageAdd.label}
      data-page-add
      className={cn(
        'fixed right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg',
        'transition-all duration-300 ease-in-out active:scale-95 [body:has([role=dialog])_&]:hidden',
        uiHidden && 'translate-y-24 opacity-0',
      )}
      // Above the dock (#924).
      style={{ bottom: 'calc(var(--nav-bottom, 0px) + 1rem)' }}
    >
      <Plus className="h-6 w-6" />
    </button>
  );
}
