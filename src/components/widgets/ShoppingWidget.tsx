/**
 *
 * Displays shopping lists with items that can be checked off.
 *
 * FEATURES:
 * - Multiple shopping lists (Grocery, Target, etc.)
 * - Check off items as you shop
 * - Categories (produce, dairy, etc.)
 * - Quick add item button
 * - Progress indicator (X of Y checked)
 * - Checked items are hidden unless showChecked is set
 *
 * INTERACTION:
 * - Tap checkbox to mark item as purchased
 * - Tap list to switch between lists
 * - Add new items quickly
 *
 * USAGE:
 *   <ShoppingWidget />
 *   <ShoppingWidget listId="grocery" />
 *
 */

'use client';

import * as React from 'react';
import { Emoji } from '@/components/ui/Emoji';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ShoppingCart, Plus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WidgetContainer, WidgetEmpty } from './WidgetContainer';
import { Button, Checkbox, Badge, Progress } from '@/components/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';

/**
 * SHOPPING ITEM TYPE
 */
// Shopping types imported from shared types
import type { ShoppingItem, ShoppingList } from '@/types';
export type { ShoppingItem, ShoppingList };

/** How long an item ticked on the widget stays visible before it is hidden. */
const TICK_GRACE_MS = 5000;

/**
 * SHOPPING WIDGET PROPS
 */
export interface ShoppingWidgetProps {
  /** Shopping lists to display (if provided externally) */
  lists?: ShoppingList[];
  /** Active list ID (defaults to first list) */
  listId?: string;
  /** Loading state */
  loading?: boolean;
  /** Error message */
  error?: string | null;
  /** Show items that are already checked off. Off by default: a display
   *  wants what is left to buy, as the Tasks widget hides finished tasks. */
  showChecked?: boolean;
  /** Callback when item is toggled */
  onItemToggle?: (itemId: string, checked: boolean) => void;
  /** Callback when add button is clicked */
  onAddClick?: () => void;
  /** Callback when list is changed */
  onListChange?: (listId: string) => void;
  /** URL for the full shopping page (makes title clickable) */
  titleHref?: string;
  /** Additional CSS classes */
  className?: string;
}

/**
 * SHOPPING WIDGET COMPONENT
 * Displays a shopping list with checkable items.
 *
 * @example Basic usage
 * <ShoppingWidget />
 *
 * @example Specific list
 * <ShoppingWidget listId="grocery" />
 *
 * @example With callbacks
 * <ShoppingWidget
 *   onItemToggle={(id, checked) => updateItem(id, checked)}
 *   onAddClick={() => openAddItemDialog()}
 * />
 */
export const ShoppingWidget = React.memo(function ShoppingWidget({
  lists: externalLists,
  listId,
  loading = false,
  error = null,
  showChecked = false,
  onItemToggle,
  onAddClick,
  onListChange,
  titleHref,
  className,
}: ShoppingWidgetProps) {
  // Use provided lists (no demo data fallback in production)
  const allLists = externalLists || [];

  // Determine active list
  const [selectedListId, setSelectedListId] = useState<string | undefined>(listId);
  const activeListId = selectedListId || allLists[0]?.id;
  const activeList = allLists.find((l) => l.id === activeListId);

  // Local state for optimistic updates
  const [localChecked, setLocalChecked] = useState<Record<string, boolean>>({});

  // An item ticked here stays on screen, struck through, for a few seconds
  // before it is hidden, so a mis-tap on a wall display can be undone.
  const [justTicked, setJustTicked] = useState<ReadonlySet<string>>(() => new Set());
  const tickTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const timers = tickTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const handleToggle = useCallback((itemId: string, currentChecked: boolean) => {
    const newChecked = !currentChecked;
    setLocalChecked((prev) => ({ ...prev, [itemId]: newChecked }));
    onItemToggle?.(itemId, newChecked);

    clearTimeout(tickTimers.current.get(itemId));
    setJustTicked((prev) => new Set(prev).add(itemId));
    tickTimers.current.set(itemId, setTimeout(() => {
      tickTimers.current.delete(itemId);
      setJustTicked((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }, TICK_GRACE_MS));
  }, [onItemToggle]);

  const handleListChange = useCallback((newListId: string) => {
    setSelectedListId(newListId);
    onListChange?.(newListId);
  }, [onListChange]);

  const { items, visibleItems, checkedCount, totalCount, progress } = useMemo(() => {
    const items = activeList?.items || [];
    const isChecked = (item: ShoppingItem) =>
      localChecked[item.id] !== undefined ? localChecked[item.id] : item.checked;
    const checkedCount = items.filter(isChecked).length;
    const totalCount = items.length;
    const visibleItems = showChecked
      ? items
      : items.filter((item) => !isChecked(item) || justTicked.has(item.id));
    return { items, visibleItems, checkedCount, totalCount, progress: totalCount > 0 ? (checkedCount / totalCount) * 100 : 0 };
  }, [activeList, localChecked, showChecked, justTicked]);

  return (
    <WidgetContainer
      title="Shopping"
      titleHref={titleHref}
      icon={<ShoppingCart className="h-4 w-4" />}
      size="medium"
      loading={loading}
      error={error}
      actions={
        <div className="flex items-center gap-2">
          {allLists.length > 1 && activeList && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 px-2 text-xs font-normal"
                >
                  {activeList.name}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {allLists.map((list) => (
                  <DropdownMenuItem
                    key={list.id}
                    onClick={() => handleListChange(list.id)}
                  >
                    {list.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {onAddClick && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onAddClick();
              }}
              className="h-8 w-8"
              aria-label="Add shopping item"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      }
      className={className}
    >
      {!activeList || items.length === 0 ? (
        <WidgetEmpty
          icon={<ShoppingCart className="h-8 w-8" />}
          message="No items on your list"
          action={
            onAddClick && (
              <Button size="sm" variant="outline" onClick={onAddClick}>
                Add Item
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mb-3 space-y-1">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {checkedCount} of {totalCount} checked
              </p>
            </div>
          )}

          <div className="overflow-auto h-full -mr-2 pr-2">
            {visibleItems.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Everything is checked off
              </p>
            )}
            <div className="space-y-2">
              {visibleItems.map((item) => {
                const isChecked: boolean =
                  localChecked[item.id] !== undefined
                    ? localChecked[item.id]!
                    : (item.checked ?? false);

                return (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    checked={isChecked}
                    onToggle={() => handleToggle(item.id, isChecked)}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}
    </WidgetContainer>
  );
});

/**
 * SHOPPING ITEM ROW
 * A single shopping item with checkbox and details.
 */
function ShoppingItemRow({
  item,
  checked,
  onToggle,
}: {
  item: ShoppingItem;
  checked: boolean;
  onToggle: () => void;
}) {
  // Get category emoji
  const categoryEmoji = getCategoryEmoji(item.category);

  // Format quantity
  const quantityDisplay = item.quantity
    ? `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`
    : null;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-lg',
        'hover:bg-accent/50 transition-colors',
        'touch-action-manipulation',
        checked && 'opacity-60'
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        className="mt-0.5"
      />

      {/* Item content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Category emoji */}
          {categoryEmoji && <span className="text-sm"><Emoji e={categoryEmoji} /></span>}

          {/* Name */}
          <span
            className={cn(
              'text-sm font-medium truncate',
              checked && 'line-through text-muted-foreground'
            )}
          >
            {item.name}
          </span>

          {/* Quantity */}
          {quantityDisplay && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {quantityDisplay}
            </Badge>
          )}
        </div>

        {/* Notes */}
        {item.notes && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
        )}
      </div>
    </div>
  );
}

/**
 * GET CATEGORY EMOJI
 * Returns an emoji for the item category.
 */
function getCategoryEmoji(category?: string): string | null {
  switch (category) {
    case 'produce':
      return '🥬';
    case 'dairy':
      return '🥛';
    case 'meat':
      return '🥩';
    case 'bakery':
      return '🥖';
    case 'frozen':
      return '🧊';
    case 'pantry':
      return '🥫';
    case 'household':
      return '🧴';
    default:
      return null;
  }
}

