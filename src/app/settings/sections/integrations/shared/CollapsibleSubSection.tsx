'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  id: string;
  label: string;
  /** One-line summary shown on the collapsed header (e.g. "3 lists, last synced 2h ago"). */
  summary?: React.ReactNode;
  /** Icon shown next to the label. */
  icon?: React.ReactNode;
  /** Force the section open (e.g. when URL hash matches). */
  forceOpen?: boolean;
  /** Open by default (e.g. when the parent provider is disconnected). */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSubSection({
  id,
  label,
  summary,
  icon,
  forceOpen,
  defaultOpen,
  children,
}: Props) {
  const [open, setOpen] = React.useState<boolean>(!!defaultOpen);

  React.useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const isOpen = forceOpen || open;

  return (
    <div id={id} className="border-t border-border first:border-t-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left',
          'hover:bg-accent/30 transition-colors',
          isOpen && 'bg-accent/20',
        )}
        aria-expanded={isOpen}
        aria-controls={`${id}-body`}
      >
        {icon && <span className="flex-shrink-0 text-muted-foreground">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{label}</div>
          {summary && (
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{summary}</div>
          )}
        </div>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground transition-transform flex-shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>
      {isOpen && (
        <div id={`${id}-body`} className="px-4 pb-4">
          {children}
        </div>
      )}
    </div>
  );
}
