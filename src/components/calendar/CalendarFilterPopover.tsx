'use client';

import * as React from 'react';
import { useState, useRef, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarGroup } from '@/lib/hooks/useCalendarFilter';

export interface CalendarFilterPopoverProps {
  calendarGroups: CalendarGroup[];
  selectedCalendarIds: Set<string>;
  onToggle: (id: string) => void;
}

export function CalendarFilterPopover({
  calendarGroups,
  selectedCalendarIds,
  onToggle,
}: CalendarFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (calendarGroups.length === 0) return null;

  const allSelected = selectedCalendarIds.has('all');

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'p-1 rounded hover:bg-accent transition-colors',
          open && 'bg-accent'
        )}
        aria-label="Filter calendars"
      >
        <Filter className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-card border border-border rounded-lg shadow-lg p-2 min-w-[160px]">
          {/* All toggle */}
          <button
            onClick={() => onToggle('all')}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded text-xs font-medium transition-colors',
              allSelected
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-accent text-muted-foreground'
            )}
          >
            All Calendars
          </button>

          <div className="border-t border-border my-1" />

          {/* Individual calendars */}
          {calendarGroups.map((group) => {
            const isSelected = selectedCalendarIds.has(group.id) || allSelected;
            return (
              <button
                key={group.id}
                onClick={() => onToggle(group.id)}
                className={cn(
                  'w-full text-left px-2 py-1.5 rounded text-xs font-medium transition-colors flex items-center gap-2',
                  isSelected ? 'text-white' : 'hover:bg-accent text-muted-foreground'
                )}
                style={isSelected ? { backgroundColor: group.color } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 border border-white/60 dark:border-white/80"
                  style={{ backgroundColor: group.color }}
                />
                {group.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
