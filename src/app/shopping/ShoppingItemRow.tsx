'use client';

import { Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ShoppingItem } from '@/types';

export function ShoppingItemRow({
  item,
  onToggle,
  onEdit,
  onDelete,
}: {
  item: ShoppingItem;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const quantityDisplay = item.quantity
    ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
    : null;

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1 px-2 rounded cursor-pointer',
        'hover:bg-muted/50 transition-all group',
        item.checked && 'opacity-60'
      )}
      onClick={onToggle}
      onTouchEnd={(e) => { e.preventDefault(); onToggle(); }}
    >
      {/* Content - tap to toggle */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-base',
              item.checked && 'line-through text-muted-foreground'
            )}
          >
            {item.name}
          </span>

          {quantityDisplay && (
            <Badge variant="secondary" className="text-xs">
              {quantityDisplay}
            </Badge>
          )}
        </div>

        {item.notes && (
          <p className="text-sm text-muted-foreground mt-0.5">{item.notes}</p>
        )}
      </div>

      {/* Actions - always visible for touch support */}
      <div className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onEdit(); }}
          className="h-8 w-8"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
          className="h-8 w-8 text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
