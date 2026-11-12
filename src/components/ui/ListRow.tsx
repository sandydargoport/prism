/**
 * One list row (#932) for chores, lists, tasks, meals and messages: at least
 * 56px tall, no border and no card of its own; rows are set apart by space.
 * A mark on the left, the title, a quiet meta on the right. Editing controls
 * (pencil, trash, switches) show only while the list is being managed.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ListRowProps {
  mark?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Shown only while `editing`. */
  actions?: React.ReactNode;
  editing?: boolean;
  highlighted?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ListRow({ mark, title, meta, actions, editing = false, highlighted = false, onClick, className }: ListRowProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <div className={cn('flex min-h-[56px] items-center gap-3 rounded-2xl px-3', highlighted && 'bg-foreground/[0.08]', className)} data-list-row>
      {/* Beside the row's own button, never inside it: a mark may be a button too. */}
      {mark}
      <Tag
        {...(onClick ? { type: 'button' as const, onClick } : {})}
        className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-body">{title}</span>
        {meta && <span className="shrink-0 text-caption text-muted-foreground">{meta}</span>}
      </Tag>
      {editing && actions && <span className="flex shrink-0 items-center gap-1" data-list-row-actions>{actions}</span>}
    </div>
  );
}
