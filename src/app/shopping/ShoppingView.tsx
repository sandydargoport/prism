'use client';

import { useState, useRef, useEffect, useCallback, KeyboardEvent, FocusEvent } from 'react';
import Link from 'next/link';
import { getMonth } from 'date-fns';
import {
  ShoppingCart,
  Plus,
  Home,
  Settings,
  ChevronsDown,
  Maximize2,
  Minimize2,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { PageWrapper } from '@/components/layout';
import { ShoppingItemRow } from '@/app/shopping/ShoppingItemRow';
import { ItemModal } from '@/app/shopping/ItemModal';
import { ListModal } from '@/app/shopping/ListModal';
import { ShoppingCelebration } from '@/app/shopping/ShoppingCelebration';
import { useShoppingViewData } from './useShoppingViewData';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { cn } from '@/lib/utils';
import type { ShoppingItem } from '@/types';

// Default grocery categories in a logical store layout order
const DEFAULT_GROCERY_CATEGORIES: GroceryCategory[] = ['produce', 'bakery', 'meat', 'dairy', 'frozen', 'pantry'];
type GroceryCategory = 'produce' | 'bakery' | 'meat' | 'dairy' | 'frozen' | 'pantry';

// LocalStorage key for category order
const CATEGORY_ORDER_KEY = 'prism:grocery-category-order';

// Base number of empty lines to show in each category
const BASE_EMPTY_LINES = 6;

export function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'produce': return '🥬';
    case 'dairy': return '🥛';
    case 'meat': return '🥩';
    case 'bakery': return '🥖';
    case 'frozen': return '🧊';
    case 'pantry': return '🥫';
    case 'household': return '🧴';
    default: return '🛒';
  }
}

function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    produce: '#22C55E', // green
    bakery: '#F59E0B',  // amber
    meat: '#EF4444',    // red
    dairy: '#3B82F6',   // blue
    frozen: '#8B5CF6',  // purple
    pantry: '#F97316',  // orange
  };
  return colorMap[category] || '#3B82F6';
}

export function ShoppingView() {
  const {
    lists, loading, error, refreshLists, familyMembers,
    requireAuth, apiAddItem,
    activeListId, setActiveListId,
    showChecked, setShowChecked,
    showAddItemModal, setShowAddItemModal,
    editingItem, setEditingItem,
    showListModal, setShowListModal,
    editingList, setEditingList,
    activeList, filteredItems,
    toggleItem, deleteItem,
    totalItems, checkedItems, progress,
  } = useShoppingViewData();

  // Track which category to default when opening modal
  const [defaultCategory, setDefaultCategory] = useState<GroceryCategory | null>(null);

  // Category order (persisted in localStorage)
  const [categoryOrder, setCategoryOrder] = useState<GroceryCategory[]>(DEFAULT_GROCERY_CATEGORIES);
  const [draggedCategory, setDraggedCategory] = useState<GroceryCategory | null>(null);

  // Non-grocery column order (persisted in localStorage)
  const NON_GROCERY_ORDER_KEY = 'prism:non-grocery-column-order';
  const [columnOrder, setColumnOrder] = useState<[1, 2] | [2, 1]>([1, 2]);
  const [draggedColumn, setDraggedColumn] = useState<1 | 2 | null>(null);

  // Touch drag state
  const touchStartRef = useRef<{ x: number; y: number; element: HTMLElement | null }>({ x: 0, y: 0, element: null });

  // Load category order from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CATEGORY_ORDER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === DEFAULT_GROCERY_CATEGORIES.length) {
          setCategoryOrder(parsed as GroceryCategory[]);
        }
      }
      // Load non-grocery column order
      const savedColumns = localStorage.getItem(NON_GROCERY_ORDER_KEY);
      if (savedColumns) {
        const parsed = JSON.parse(savedColumns);
        if (Array.isArray(parsed) && parsed.length === 2) {
          setColumnOrder(parsed as [1, 2] | [2, 1]);
        }
      }
    } catch {
      // Use default order
    }
  }, []);

  // Save category order to localStorage
  const saveCategoryOrder = useCallback((order: GroceryCategory[]) => {
    setCategoryOrder(order);
    try {
      localStorage.setItem(CATEGORY_ORDER_KEY, JSON.stringify(order));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Save non-grocery column order
  const saveColumnOrder = useCallback((order: [1, 2] | [2, 1]) => {
    setColumnOrder(order);
    try {
      localStorage.setItem(NON_GROCERY_ORDER_KEY, JSON.stringify(order));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Drag and drop handlers for category reordering (mouse)
  const handleDragStart = useCallback((category: GroceryCategory) => {
    setDraggedCategory(category);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetCategory: GroceryCategory) => {
    e.preventDefault();
    if (!draggedCategory || draggedCategory === targetCategory) return;

    const newOrder = [...categoryOrder];
    const draggedIndex = newOrder.indexOf(draggedCategory);
    const targetIndex = newOrder.indexOf(targetCategory);

    if (draggedIndex !== -1 && targetIndex !== -1) {
      newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedCategory);
      saveCategoryOrder(newOrder);
    }
  }, [draggedCategory, categoryOrder, saveCategoryOrder]);

  const handleDragEnd = useCallback(() => {
    setDraggedCategory(null);
  }, []);

  // Touch handlers for category reordering
  const handleTouchStart = useCallback((e: React.TouchEvent, category: GroceryCategory) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      element: e.currentTarget as HTMLElement,
    };
    setDraggedCategory(category);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggedCategory) return;
    const touch = e.touches[0];
    if (!touch) return;

    // Find which category we're over
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    for (const el of elements) {
      const categoryAttr = el.getAttribute('data-category');
      if (categoryAttr && categoryAttr !== draggedCategory) {
        const targetCategory = categoryAttr as GroceryCategory;
        const newOrder = [...categoryOrder];
        const draggedIndex = newOrder.indexOf(draggedCategory);
        const targetIndex = newOrder.indexOf(targetCategory);

        if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
          newOrder.splice(draggedIndex, 1);
          newOrder.splice(targetIndex, 0, draggedCategory);
          saveCategoryOrder(newOrder);
        }
        break;
      }
    }
  }, [draggedCategory, categoryOrder, saveCategoryOrder]);

  const handleTouchEnd = useCallback(() => {
    setDraggedCategory(null);
    touchStartRef.current = { x: 0, y: 0, element: null };
  }, []);

  // Non-grocery column drag handlers (mouse)
  const handleColumnDragStart = useCallback((col: 1 | 2) => {
    setDraggedColumn(col);
  }, []);

  const handleColumnDragOver = useCallback((e: React.DragEvent, targetCol: 1 | 2) => {
    e.preventDefault();
    if (!draggedColumn || draggedColumn === targetCol) return;
    // Swap columns - simply reverse the order
    saveColumnOrder(columnOrder[0] === 1 ? [2, 1] : [1, 2]);
  }, [draggedColumn, columnOrder, saveColumnOrder]);

  const handleColumnDragEnd = useCallback(() => {
    setDraggedColumn(null);
  }, []);

  // Touch handlers for non-grocery column reordering
  const handleColumnTouchStart = useCallback((e: React.TouchEvent, col: 1 | 2) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      element: e.currentTarget as HTMLElement,
    };
    setDraggedColumn(col);
  }, []);

  const handleColumnTouchMove = useCallback((e: React.TouchEvent) => {
    if (!draggedColumn) return;
    const touch = e.touches[0];
    if (!touch) return;

    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    for (const el of elements) {
      const colAttr = el.getAttribute('data-column');
      if (colAttr) {
        const targetCol = parseInt(colAttr, 10) as 1 | 2;
        if (targetCol !== draggedColumn) {
          // Swap columns - simply reverse the order
          saveColumnOrder(columnOrder[0] === 1 ? [2, 1] : [1, 2]);
        }
        break;
      }
    }
  }, [draggedColumn, columnOrder, saveColumnOrder]);

  const handleColumnTouchEnd = useCallback(() => {
    setDraggedColumn(null);
    touchStartRef.current = { x: 0, y: 0, element: null };
  }, []);

  // Track inline input values for each category
  const [inlineInputs, setInlineInputs] = useState<Record<string, string>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Track extra rows per category
  const [extraRows, setExtraRows] = useState<Record<string, number>>({});

  // Track celebration animation
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastCheckedCount, setLastCheckedCount] = useState<number | null>(null);
  const isInitialLoadRef = useRef(true);
  const prevListIdRef = useRef<string | null>(null);

  // Reset initial load tracking when list changes
  useEffect(() => {
    if (activeListId !== prevListIdRef.current) {
      isInitialLoadRef.current = true;
      setLastCheckedCount(null);
      prevListIdRef.current = activeListId;
    }
  }, [activeListId]);

  // Detect when all items are checked off
  useEffect(() => {
    // Skip if no items or not all checked
    if (totalItems === 0 || checkedItems !== totalItems) {
      // Once we've seen unchecked items, initial load is complete
      if (totalItems > 0 && checkedItems < totalItems) {
        isInitialLoadRef.current = false;
      }
      setLastCheckedCount(checkedItems);
      return;
    }

    // All items are checked - should we celebrate?
    // Only celebrate if:
    // 1. Not initial load (we've seen the list in incomplete state)
    // 2. The count actually increased (user checked something)
    if (!isInitialLoadRef.current && lastCheckedCount !== null && lastCheckedCount < checkedItems) {
      setShowCelebration(true);
    }

    // Mark initial load complete after first data arrives
    isInitialLoadRef.current = false;
    setLastCheckedCount(checkedItems);
  }, [checkedItems, totalItems, lastCheckedCount]);

  // Orientation for responsive layout
  const orientation = useOrientation();
  const isPortrait = orientation === 'portrait';

  // Shopping mode - full screen list without filters
  const [shoppingMode, setShoppingMode] = useState(false);

  // Get list type (default to grocery for now)
  const listType = activeList?.listType || 'grocery';
  const isGroceryLayout = listType === 'grocery';

  // Add/remove extra rows from a category
  const addExtraRows = (category: string, count: number) => {
    setExtraRows(prev => {
      const current = prev[category] || 0;
      const newValue = Math.max(-BASE_EMPTY_LINES + 1, current + count); // Allow reducing to minimum 1 empty line
      return { ...prev, [category]: newValue };
    });
  };

  // For grocery layout, organize items by the user's category order
  const groceryCategoryItems = categoryOrder.map((cat) => ({
    category: cat,
    items: (filteredItems[cat] || []) as ShoppingItem[],
  }));

  // For non-grocery, use the existing filteredItems
  const otherItems = Object.entries(filteredItems).filter(
    ([cat]) => !categoryOrder.includes(cat as GroceryCategory)
  );

  // Handle adding item with login prompt
  const handleAddItem = async (category?: GroceryCategory) => {
    const user = await requireAuth("Who's adding an item?");
    if (!user) return;

    if (category) {
      setDefaultCategory(category);
    }
    setShowAddItemModal(true);
  };

  // Handle inline item add
  const handleInlineAdd = async (category: GroceryCategory) => {
    const name = inlineInputs[category]?.trim();
    if (!name || !activeList) return;

    const user = await requireAuth("Who's adding an item?");
    if (!user) return;

    try {
      await apiAddItem(activeList.id, {
        name,
        category,
      });
      setInlineInputs(prev => ({ ...prev, [category]: '' }));
    } catch (err) {
      console.error('Failed to add item:', err);
      alert('Failed to add item. Please try again.');
    }
  };

  const handleInlineKeyDown = (e: KeyboardEvent<HTMLInputElement>, category: GroceryCategory) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInlineAdd(category);
    }
  };

  const handleInlineBlur = (e: FocusEvent<HTMLInputElement>, category: GroceryCategory) => {
    // Add item when user taps out of the input
    handleInlineAdd(category);
  };

  // Handle non-grocery inline item add
  const handleNonGroceryInlineAdd = async (colNum: 1 | 2) => {
    const name = inlineInputs[`list${colNum}`]?.trim();
    if (!name || !activeList) return;

    const user = await requireAuth("Who's adding an item?");
    if (!user) return;

    try {
      await apiAddItem(activeList.id, {
        name,
        category: 'general',
      });
      setInlineInputs(prev => ({ ...prev, [`list${colNum}`]: '' }));
    } catch (err) {
      console.error('Failed to add item:', err);
      alert('Failed to add item. Please try again.');
    }
  };

  // Handle new list creation
  const handleNewList = async () => {
    const user = await requireAuth("Who's creating a list?");
    if (user) {
      setEditingList(null);
      setShowListModal(true);
    }
  };

  // Handle edit item with auth
  const handleEditItem = async (item: ShoppingItem) => {
    const user = await requireAuth("Who's editing this item?");
    if (user) {
      setEditingItem(item);
    }
  };

  // Handle delete item with auth
  const handleDeleteItem = async (itemId: string) => {
    const user = await requireAuth("Who's deleting this item?");
    if (user) {
      deleteItem(itemId);
    }
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* Collapsible header - hidden in shopping mode */}
        {!shoppingMode && (
          <>
            <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-3 py-2 safe-area-top">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex">
                    <Link href="/" aria-label="Back to dashboard"><Home className="h-5 w-5" /></Link>
                  </Button>
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    <h1 className="text-xl font-bold">Shopping Lists</h1>
                    {activeList && <Badge variant="secondary">{checkedItems}/{totalItems} checked</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={() => setShoppingMode(true)} title="Enter shopping mode">
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button onClick={handleNewList} size="sm">
                    <Plus className="h-4 w-4 mr-1" />
                    Add List
                  </Button>
                </div>
              </div>
            </header>

            <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-3 py-1">
              <div className="flex items-center justify-between">
                <div className="flex gap-1 items-center flex-wrap">
                  {lists.map((list) => {
                    const assignedMember = list.assignedTo ? familyMembers.find(m => m.id === list.assignedTo) : null;
                    return (
                      <Button key={list.id} variant={activeListId === list.id ? 'secondary' : 'ghost'} size="sm"
                        onClick={() => setActiveListId(list.id)} className="relative">
                        {list.name}
                        {assignedMember && (
                          <span className="ml-1.5 w-3 h-3 rounded-full inline-block"
                            style={{ backgroundColor: assignedMember.color }} title={`Assigned to ${assignedMember.name}`} />
                        )}
                        <Badge variant="outline" className="ml-2 text-xs">{list.items.length}</Badge>
                      </Button>
                    );
                  })}
                  <Button variant="outline" size="sm" className="border-dashed" onClick={handleNewList}>
                    <Plus className="h-3 w-3 mr-1" />New List
                  </Button>
                </div>
                <div className="flex gap-2">
                  {activeList && (
                    <Button variant="ghost" size="sm" title="Edit list settings"
                      onClick={async () => {
                        const user = await requireAuth("Who's editing this list?");
                        if (user && user.role === 'parent') { setEditingList(activeList); setShowListModal(true); }
                        else if (user) alert('Only parents can edit list settings');
                      }}>
                      <Settings className="h-4 w-4 mr-1" />Edit List
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setShowChecked(!showChecked)}>
                    {showChecked ? 'Hide' : 'Show'} checked items
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Compact header for shopping mode */}
        {shoppingMode && (
          <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-3 py-1 safe-area-top">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="font-medium">{activeList?.name}</span>
                <Badge variant="secondary" className="text-xs">{checkedItems}/{totalItems}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-2 w-24" />
                <Button variant="ghost" size="sm" onClick={() => setShoppingMode(false)} title="Exit shopping mode">
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </header>
        )}

        {activeList && totalItems > 0 && !shoppingMode && (
          <div className="flex-shrink-0 px-3 py-1 bg-card/85 backdrop-blur-sm">
            <div className="max-w-6xl mx-auto flex items-center gap-3">
              <Progress value={progress} className="h-2 flex-1" />
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                {checkedItems}/{totalItems} ({Math.round(progress)}%)
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50 animate-pulse" /><p className="text-lg">Loading shopping lists...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-destructive text-lg">Error: {error}</p>
              <p className="text-base mt-2">Please check your connection</p>
            </div>
          ) : !activeList ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50" /><p className="text-lg">No shopping lists yet</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={handleNewList}>Create your first list</Button>
            </div>
          ) : isGroceryLayout ? (
            /* Grocery-style grid layout - 3 cols landscape, 2 cols portrait */
            <div className="max-w-7xl mx-auto">
              <div className={cn(
                'grid gap-2',
                isPortrait ? 'grid-cols-2' : 'grid-cols-3'
              )}>
                {groceryCategoryItems.map(({ category, items }) => {
                  const categoryColor = getCategoryColor(category);
                  const categoryExtraRows = extraRows[category] || 0;
                  const totalEmptyLines = BASE_EMPTY_LINES + categoryExtraRows;
                  const emptyLinesNeeded = Math.max(0, totalEmptyLines - items.length);
                  const isDragging = draggedCategory === category;

                  return (
                    <div
                      key={category}
                      data-category={category}
                      draggable
                      onDragStart={() => handleDragStart(category)}
                      onDragOver={(e) => handleDragOver(e, category)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={(e) => handleTouchStart(e, category)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      className={cn(
                        'border-2 rounded-lg overflow-hidden bg-card/90 backdrop-blur-sm',
                        'flex flex-col cursor-grab active:cursor-grabbing transition-all touch-none',
                        isDragging && 'opacity-50 scale-95 ring-4 ring-primary/50'
                      )}
                      style={{ borderColor: categoryColor }}
                    >
                      {/* Category header with Add Item button - draggable handle */}
                      <div
                        className="px-2 py-1 flex items-center gap-1 select-none"
                        style={{ backgroundColor: categoryColor + '20' }}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        <span className="text-xl">{getCategoryEmoji(category)}</span>
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
                          onClick={() => handleAddItem(category)}
                          style={{ color: categoryColor }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Items with notebook lines */}
                      <div className="flex-1 p-1">
                        {/* Existing items */}
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="border-b border-muted-foreground/30"
                            style={{ borderColor: categoryColor + '40' }}
                          >
                            <ShoppingItemRow
                              item={item}
                              onToggle={() => toggleItem(item.id)}
                              onEdit={() => handleEditItem(item)}
                              onDelete={() => handleDeleteItem(item.id)}
                            />
                          </div>
                        ))}

                        {/* Inline input row */}
                        <div
                          className="border-b border-muted-foreground/30 py-1 px-2"
                          style={{ borderColor: categoryColor + '40' }}
                        >
                          <Input
                            ref={(el) => { inputRefs.current[category] = el; }}
                            value={inlineInputs[category] || ''}
                            onChange={(e) => setInlineInputs(prev => ({ ...prev, [category]: e.target.value }))}
                            onKeyDown={(e) => handleInlineKeyDown(e, category)}
                            onBlur={(e) => handleInlineBlur(e, category)}
                            placeholder="Add item..."
                            className="h-7 border-none bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                          />
                        </div>

                        {/* Empty underlined rows */}
                        {Array.from({ length: emptyLinesNeeded }).map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            className="h-7 border-b border-muted-foreground/30"
                            style={{ borderColor: categoryColor + '40' }}
                          />
                        ))}

                        {/* Add/remove rows buttons */}
                        <div className="flex items-center justify-center gap-1 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={() => addExtraRows(category, -1)}
                            disabled={(extraRows[category] || 0) <= 0 && items.length >= BASE_EMPTY_LINES}
                          >
                            -1
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={() => addExtraRows(category, 1)}
                          >
                            +1
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={() => addExtraRows(category, 5)}
                          >
                            +5
                          </Button>
                          <ChevronsDown className="h-3 w-3 text-muted-foreground/50" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Other categories below the grid */}
              {otherItems.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-muted-foreground">Other Items</h3>
                  {otherItems.map(([category, items]) => (
                    <div key={category} className="border rounded-lg p-3 bg-card/90 backdrop-blur-sm">
                      <h4 className="text-base font-semibold text-muted-foreground mb-2 capitalize flex items-center gap-2">
                        <span>{getCategoryEmoji(category)}</span><span>{category}</span>
                      </h4>
                      <div className="space-y-1">
                        {(items as ShoppingItem[]).map((item) => (
                          <ShoppingItemRow key={item.id} item={item}
                            onToggle={() => toggleItem(item.id)}
                            onEdit={() => handleEditItem(item)}
                            onDelete={() => handleDeleteItem(item.id)} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Non-grocery layout - 2 columns matching grocery card style */
            <div className="max-w-7xl mx-auto">
              <div className="grid grid-cols-2 gap-2">
                {columnOrder.map((colNum) => {
                  const allItems = Object.values(filteredItems).flat() as ShoppingItem[];
                  const columnItems = allItems.filter((_, i) => i % 2 === (colNum - 1));
                  const columnColor = colNum === 1 ? '#3B82F6' : '#8B5CF6';
                  const columnExtraRows = extraRows[`list${colNum}`] || 0;
                  const totalEmptyLines = BASE_EMPTY_LINES + columnExtraRows;
                  const emptyLinesNeeded = Math.max(0, totalEmptyLines - columnItems.length);
                  const isDragging = draggedColumn === colNum;

                  return (
                    <div
                      key={colNum}
                      data-column={colNum}
                      draggable
                      onDragStart={() => handleColumnDragStart(colNum)}
                      onDragOver={(e) => handleColumnDragOver(e, colNum)}
                      onDragEnd={handleColumnDragEnd}
                      onTouchStart={(e) => handleColumnTouchStart(e, colNum)}
                      onTouchMove={handleColumnTouchMove}
                      onTouchEnd={handleColumnTouchEnd}
                      className={cn(
                        'border-2 rounded-lg overflow-hidden bg-card/90 backdrop-blur-sm flex flex-col',
                        'cursor-grab active:cursor-grabbing transition-all touch-none',
                        isDragging && 'opacity-50 scale-95 ring-4 ring-primary/50'
                      )}
                      style={{ borderColor: columnColor }}
                    >
                      {/* Column header */}
                      <div
                        className="px-2 py-1 flex items-center gap-1 select-none"
                        style={{ backgroundColor: columnColor + '20' }}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        <span className="text-xl">📋</span>
                        <h3
                          className="text-base font-bold"
                          style={{ color: columnColor }}
                        >
                          List {colNum}
                        </h3>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {columnItems.length}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1"
                          onClick={() => handleAddItem()}
                          style={{ color: columnColor }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Items with notebook lines */}
                      <div className="flex-1 p-1">
                        {columnItems.map((item) => (
                          <div
                            key={item.id}
                            className="border-b border-muted-foreground/30"
                            style={{ borderColor: columnColor + '40' }}
                          >
                            <ShoppingItemRow
                              item={item}
                              onToggle={() => toggleItem(item.id)}
                              onEdit={() => handleEditItem(item)}
                              onDelete={() => handleDeleteItem(item.id)}
                            />
                          </div>
                        ))}

                        {/* Inline input row */}
                        <div
                          className="border-b border-muted-foreground/30 py-1 px-2"
                          style={{ borderColor: columnColor + '40' }}
                        >
                          <Input
                            ref={(el) => { inputRefs.current[`list${colNum}`] = el; }}
                            value={inlineInputs[`list${colNum}`] || ''}
                            onChange={(e) => setInlineInputs(prev => ({ ...prev, [`list${colNum}`]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleNonGroceryInlineAdd(colNum);
                              }
                            }}
                            onBlur={() => handleNonGroceryInlineAdd(colNum)}
                            placeholder="Add item..."
                            className="h-7 border-none bg-transparent shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                          />
                        </div>

                        {/* Empty underlined rows */}
                        {Array.from({ length: emptyLinesNeeded }).map((_, i) => (
                          <div
                            key={`empty-${i}`}
                            className="h-7 border-b border-muted-foreground/30"
                            style={{ borderColor: columnColor + '40' }}
                          />
                        ))}

                        {/* Add/remove rows buttons */}
                        <div className="flex items-center justify-center gap-1 pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={() => addExtraRows(`list${colNum}`, -1)}
                          >
                            -1
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={() => addExtraRows(`list${colNum}`, 1)}
                          >
                            +1
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs text-muted-foreground"
                            onClick={() => addExtraRows(`list${colNum}`, 5)}
                          >
                            +5
                          </Button>
                          <ChevronsDown className="h-3 w-3 text-muted-foreground/50" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {showAddItemModal && activeList && (
          <ItemModal
            listId={activeList.id}
            lists={lists}
            defaultCategory={defaultCategory || undefined}
            onClose={() => { setShowAddItemModal(false); setDefaultCategory(null); }}
            onSave={async (item) => {
              const user = await requireAuth("Who's adding an item?");
              if (!user) {
                setShowAddItemModal(false);
                setDefaultCategory(null);
                return;
              }
              try {
                await apiAddItem(item.listId, {
                  name: item.name, quantity: item.quantity ?? undefined,
                  unit: item.unit ?? undefined, category: item.category ?? undefined,
                  notes: item.notes ?? undefined,
                });
                setShowAddItemModal(false);
                setDefaultCategory(null);
                if (item.listId !== activeList.id) setActiveListId(item.listId);
              } catch (err) {
                console.error('Failed to add item:', err);
                alert('Failed to add item. Please try again.');
              }
            }} />
        )}

        {editingItem && (
          <ItemModal listId={editingItem.listId} item={editingItem}
            onClose={() => setEditingItem(null)}
            onSave={async (updatedItem) => {
              try {
                const response = await fetch(`/api/shopping-items/${editingItem.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: updatedItem.name, quantity: updatedItem.quantity,
                    unit: updatedItem.unit, category: updatedItem.category, notes: updatedItem.notes,
                  }),
                });
                if (!response.ok) throw new Error('Failed to update item');
                setEditingItem(null);
              } catch (err) {
                console.error('Failed to update item:', err);
                alert('Failed to update item. Please try again.');
              }
            }} />
        )}

        {showListModal && (
          <ListModal list={editingList} familyMembers={familyMembers}
            onClose={() => { setShowListModal(false); setEditingList(null); }}
            onSave={async (listData) => {
              try {
                if (editingList) {
                  const response = await fetch(`/api/shopping-lists/${editingList.id}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(listData),
                  });
                  if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || 'Failed to update list');
                  }
                } else {
                  const response = await fetch('/api/shopping-lists', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(listData),
                  });
                  if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.error || 'Failed to create list');
                  }
                  const newList = await response.json();
                  setActiveListId(newList.id);
                }
                setShowListModal(false);
                setEditingList(null);
                refreshLists();
              } catch (err) {
                console.error('Failed to save list:', err);
                alert(err instanceof Error ? err.message : 'Failed to save list. Please try again.');
              }
            }}
            onDelete={editingList ? async () => {
              try {
                const response = await fetch(`/api/shopping-lists/${editingList.id}`, {
                  method: 'DELETE',
                });
                if (!response.ok) {
                  const data = await response.json().catch(() => ({}));
                  throw new Error(data.error || 'Failed to delete list');
                }
                setShowListModal(false);
                setEditingList(null);
                const remainingLists = lists.filter(l => l.id !== editingList.id);
                setActiveListId(remainingLists[0]?.id || '');
                refreshLists();
              } catch (err) {
                console.error('Failed to delete list:', err);
                alert(err instanceof Error ? err.message : 'Failed to delete list. Please try again.');
              }
            } : undefined} />
        )}

        {/* Celebration animation when all items checked */}
        <ShoppingCelebration
          show={showCelebration}
          onComplete={() => setShowCelebration(false)}
        />
      </div>
    </PageWrapper>
  );
}
