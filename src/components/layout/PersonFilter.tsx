'use client';

import { cn } from '@/lib/utils';

export interface PersonFilterProps {
  members: Array<{ id: string; name: string; color: string; avatarUrl?: string | null }>;
  selected: string[] | null;
  onSelect: (ids: string[] | null) => void;
  className?: string;
}

export function PersonFilter({ members, selected, onSelect, className }: PersonFilterProps) {
  const isAll = !selected || selected.length === 0;

  const toggle = (id: string) => {
    const current = selected ?? [];
    const next = current.includes(id)
      ? current.filter((x) => x !== id)
      : [...current, id];
    onSelect(next.length === 0 ? null : next);
  };

  return (
    <div className={cn('flex gap-1 flex-wrap shrink-0', className)}>
      <button
        onClick={() => onSelect(null)}
        className={cn(
          'h-8 px-3 rounded-md text-sm font-medium transition-colors',
          isAll
            ? 'bg-secondary text-secondary-foreground'
            : 'hover:bg-accent text-muted-foreground',
        )}
      >
        All
      </button>
      {members.map((member) => {
        const active = selected?.includes(member.id) ?? false;
        return (
          <button
            key={member.id}
            onClick={() => toggle(member.id)}
            className={cn(
              'h-8 flex items-center gap-1.5 px-2 rounded-md text-sm font-medium transition-colors',
              active
                ? 'bg-secondary text-secondary-foreground'
                : 'hover:bg-accent text-muted-foreground',
            )}
          >
            <span
              className="h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: member.color }}
            />
            <span className="hidden sm:inline">{member.name}</span>
          </button>
        );
      })}
    </div>
  );
}
