'use client';

import { Plus, GripVertical, ChevronsDown } from 'lucide-react';
import { Emoji } from '@/components/ui/Emoji';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingItemRow } from '@/app/shopping/ShoppingItemRow';
import { cn } from '@/lib/utils';
import type { ShoppingItem } from '@/types';
import type { KeyboardEvent, FocusEvent, MutableRefObject } from 'react';

interface ShoppingCategoryCardProps {
  category: string;
  items: ShoppingItem[];
  categoryColor: string;
  categoryEmoji: string;
  isDragging: boolean;
  emptyLinesNeeded: number;
  extraRowCount: number;
  baseEmptyLines: number;
  inlineInputValue: string;
  inputRefs: MutableRefObject<Record<string, HTMLInputElement | null>>;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onToggleItem: (itemId: string) => void;
  onEditItem: (item: ShoppingItem) => void;
  onDeleteItem: (itemId: string) => void;
  onAddItem: (category: string) => void;
  onInlineInputChange: (category: string, value: string) => void;
  onInlineKeyDown: (e: KeyboardEvent<HTMLInputElement>, category: string) => void;
  onInlineBlur: (e: FocusEvent<HTMLInputElement>, category: string) => void;
  onAddExtraRows: (category: string, count: number) => void;
  isMobile?: boolean;
}

export function ShoppingCategoryCard({
  category,
  items,
  categoryColor,
  categoryEmoji,
  isDragging,
  emptyLinesNeeded,
  extraRowCount,
  baseEmptyLines,
  inlineInputValue,
  inputRefs,
  onDragStart,
  onDragOver,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onToggleItem,
  onEditItem,
  onDeleteItem,
  onAddItem,
  onInlineInputChange,
  onInlineKeyDown,
  onInlineBlur,
  onAddExtraRows,
  isMobile = false,
}: ShoppingCategoryCardProps) {
  return (
    <div
      data-category={category}
      draggable={!isMobile}
      onDragStart={!isMobile ? onDragStart : undefined}
      onDragOver={!isMobile ? onDragOver : undefined}
      onDragEnd={!isMobile ? onDragEnd : undefined}
      className={cn(
        'border-2 rounded-lg overflow-hidden bg-card/90 backdrop-blur-xs',
        'flex flex-col transition-all',
        isDragging && 'opacity-50 scale-95 ring-4 ring-primary/50'
      )}
      style={{ borderColor: categoryColor }}
    >
      {/*
        The header is the drag handle on a touchscreen, and the rest of the
        card is not. Touching anywhere on the card used to begin a reorder,
        and the card carried `touch-none`, which tells the browser not to
        scroll for a gesture that starts on it. On a wall-sized display the
        lists cover the width, so there was no background left to push: every
        attempt to scroll the page grabbed a list and moved it instead.

        This has to be a handle rather than a press-and-hold. `touch-action`
        is read when a gesture begins, so a card that decides mid-gesture that
        it is being dragged cannot stop the page scrolling under it by then.
        A handle decides before the finger lands. The grip icon is what says
        which part it is.
      */}
      <div
        onTouchStart={!isMobile ? onTouchStart : undefined}
        onTouchMove={!isMobile ? onTouchMove : undefined}
        onTouchEnd={!isMobile ? onTouchEnd : undefined}
        className={cn(
          'px-2 py-1 flex items-center gap-1 select-none',
          !isMobile && 'cursor-grab active:cursor-grabbing touch-none'
        )}
        style={{ backgroundColor: categoryColor + '20' }}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 hidden md:block" />
        <span className="text-xl"><Emoji e={categoryEmoji} /></span>
        <h3
          className="text-base font-bold capitalize"
          style={{ color: categoryColor }}
        >
          {category}
        </h3>
        <Badge variant="outline" className="ml-auto text-xs">
          {items.length}
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1"
          onClick={() => onAddItem(category)}
          style={{ color: categoryColor }}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 p-1">
        {items.map((item) => (
          <div
            key={item.id}
            className="border-b border-muted-foreground/30"
            style={{ borderColor: categoryColor + '40' }}
          >
            <ShoppingItemRow
              item={item}
              onToggle={() => onToggleItem(item.id)}
              onEdit={() => onEditItem(item)}
              onDelete={() => onDeleteItem(item.id)}
            />
          </div>
        ))}

        <div
          className="border-b border-muted-foreground/30 py-1 px-2"
          style={{ borderColor: categoryColor + '40' }}
        >
          <Input
            ref={(el) => { inputRefs.current[category] = el; }}
            value={inlineInputValue}
            onChange={(e) => onInlineInputChange(category, e.target.value)}
            onKeyDown={(e) => onInlineKeyDown(e, category)}
            onBlur={(e) => onInlineBlur(e, category)}
            placeholder="Add item..."
            className="h-7 border-none bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />
        </div>

        {Array.from({ length: emptyLinesNeeded }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="h-7 border-b border-muted-foreground/30"
            style={{ borderColor: categoryColor + '40' }}
          />
        ))}

        <div className="flex items-center justify-center gap-1 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => onAddExtraRows(category, -1)}
            disabled={extraRowCount <= 0 && items.length >= baseEmptyLines}
          >
            -1
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => onAddExtraRows(category, 1)}
          >
            +1
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => onAddExtraRows(category, 5)}
          >
            +5
          </Button>
          <ChevronsDown className="h-3 w-3 text-muted-foreground/50" />
        </div>
      </div>
    </div>
  );
}
