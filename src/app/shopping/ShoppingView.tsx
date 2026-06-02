'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { ShoppingCart, Plus, Settings, Maximize2, Minimize2, Tags, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PageWrapper, SubpageHeader, UndoButton } from '@/components/layout';
import type { OverflowItem } from '@/components/layout';
import { ShoppingItemRow } from '@/app/shopping/ShoppingItemRow';
import { ShoppingCategoryCard } from '@/app/shopping/ShoppingCategoryCard';
import { ItemModal } from '@/app/shopping/ItemModal';
import { ListModal } from '@/app/shopping/ListModal';
import { ShoppingCelebration } from '@/app/shopping/ShoppingCelebration';
import { ManageCategoriesModal } from '@/app/shopping/ManageCategoriesModal';
import { ScanFlowSheet } from '@/app/shopping/ScanFlowSheet';
import { KrogerCartModal } from '@/app/shopping/KrogerCartModal';
import { useShoppingViewData } from './useShoppingViewData';
import { useShoppingCategories } from '@/lib/hooks/useShoppingCategories';
import { useShoppingDragReorder } from './useShoppingDragReorder';
import { useShoppingInlineInput, BASE_EMPTY_LINES } from './useShoppingInlineInput';
import { useShoppingCelebration } from './useShoppingCelebration';
import { useShoppingScanFlow } from './useShoppingScanFlow';
import { useShoppingCrudHandlers } from './useShoppingCrudHandlers';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useSwipeNavigation } from '@/lib/hooks/useSwipeNavigation';
import { cn } from '@/lib/utils';
import type { ShoppingItem } from '@/types';
import dynamic from 'next/dynamic';

const CameraScannerOverlay = dynamic(
  () => import('@/components/input/CameraScannerOverlay').then(m => m.CameraScannerOverlay),
  { ssr: false }
);

export function getCategoryEmoji(category: string): string {
  // Fallback function — components should prefer the hook's getCategoryEmoji
  const defaults: Record<string, string> = {
    produce: '🥬', dairy: '🥛', meat: '🥩', bakery: '🥖',
    frozen: '🧊', pantry: '🥫', household: '🧴',
  };
  return defaults[category] || '🛒';
}

export function ShoppingView() {
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showKrogerModal, setShowKrogerModal] = useState(false);

  const { scan, clearScan, handleCameraScan, handleListChosen, doAdd } = useShoppingScanFlow();

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

  // Auto-advance: if only 1 list, skip list picker and go straight to category
  useEffect(() => {
    if (scan?.step !== 'list' || lists.length !== 1) return;
    handleListChosen(lists[0]!.id, lists[0]!.name);
  }, [scan?.step, lists, handleListChosen]);

  // Listen for PWA FAB "Scan" button
  useEffect(() => {
    const handler = () => setShowCameraScanner(true);
    window.addEventListener('prism:open-barcode-scanner', handler);
    return () => window.removeEventListener('prism:open-barcode-scanner', handler);
  }, []);

  // Listen for scan results — scroll to and highlight the added/updated item
  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent<{ itemId?: string }>).detail;
      if (!data?.itemId) return;
      refreshLists();
      setTimeout(() => {
        const el = document.getElementById(`shopping-item-${data.itemId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          el.classList.add('scan-highlight');
          setTimeout(() => el.classList.remove('scan-highlight'), 1500);
        }
      }, 400);
    };
    window.addEventListener('prism:scan-result', handler);
    return () => window.removeEventListener('prism:scan-result', handler);
  }, [refreshLists]);

  const {
    categories: dynamicCategories,
    addCategory, removeCategory, reorderCategories,
    getCategoryEmoji: getDynCategoryEmoji,
    getCategoryColor: getDynCategoryColor,
  } = useShoppingCategories();

  const [defaultCategory, setDefaultCategory] = useState<string | null>(null);
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);

  const categoryOrder = dynamicCategories.map(c => c.id);
  const effectiveCategoryOrder = activeList?.visibleCategories
    ? categoryOrder.filter(id => activeList.visibleCategories!.includes(id))
    : categoryOrder;

  const {
    draggedCategory,
    handleDragStart, handleDragOver, handleDragEnd,
    handleTouchStart, handleTouchMove, handleTouchEnd,
  } = useShoppingDragReorder({ categoryOrder, dynamicCategories, reorderCategories });

  const {
    inlineInputs, setInlineInputs, inputRefs, extraRows,
    handleInlineKeyDown, handleInlineBlur, addExtraRows,
  } = useShoppingInlineInput({ activeList, requireAuth, apiAddItem });

  const { showCelebration, setShowCelebration } = useShoppingCelebration(activeListId, checkedItems, totalItems);

  const orientation = useOrientation();
  const isMobile = useIsMobile();
  const isPortrait = orientation === 'portrait';
  const [shoppingMode, setShoppingMode] = useState(false);

  // Mobile-only: swipe to switch lists. The pill bar collapses into a
  // compact prev/dots/next indicator when there's more than one list.
  // Single-list households skip the affordance entirely (UX recommendation).
  const currentListIdx = lists.findIndex((l) => l.id === activeListId);
  const goPrevList = () => {
    if (currentListIdx > 0) setActiveListId(lists[currentListIdx - 1]!.id);
  };
  const goNextList = () => {
    if (currentListIdx >= 0 && currentListIdx < lists.length - 1) {
      setActiveListId(lists[currentListIdx + 1]!.id);
    }
  };
  const swipeRef = useSwipeNavigation<HTMLDivElement>({
    onSwipeLeft: goNextList,
    onSwipeRight: goPrevList,
    enabled: isMobile && lists.length > 1 && !shoppingMode,
    threshold: 60,
  });

  const groceryCategoryItems = effectiveCategoryOrder.map((cat) => ({
    category: cat,
    items: (filteredItems[cat] || []) as ShoppingItem[],
  }));

  const otherItems = Object.entries(filteredItems).filter(
    ([cat]) => !effectiveCategoryOrder.includes(cat)
  );

  const {
    handleAddItem, handleNewList, handleEditItem, handleDeleteItem,
    handleSaveNewItem, handleUpdateItem, handleSaveList, handleDeleteList,
  } = useShoppingCrudHandlers({
    requireAuth, refreshLists,
    setShowAddItemModal, setDefaultCategory, setEditingItem,
    setShowListModal, setEditingList, setActiveListId,
    deleteItem, apiAddItem,
    activeList, editingItem, editingList, lists,
  });

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {!shoppingMode && (
          <>
            <SubpageHeader
              icon={<ShoppingCart className="h-5 w-5 text-primary" />}
              title="Shopping"
              badge={activeList ? <Badge variant="secondary">{checkedItems}/{totalItems}</Badge> : undefined}
              actions={<>
                <UndoButton />
                {activeList && activeList.items.some((i) => !i.checked) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const user = await requireAuth('Send to Kroger');
                      if (!user) return;
                      setShowKrogerModal(true);
                    }}
                    title="Send unchecked items to Kroger / Mariano's cart"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send to Kroger
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setShoppingMode(true)} title="Enter shopping mode">
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button onClick={handleNewList} size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Add List
                </Button>
              </>}
              overflow={[
                ...(activeList ? [{
                  label: 'Edit List',
                  icon: Settings,
                  onClick: async () => {
                    const user = await requireAuth("Who's editing this list?");
                    if (user && user.role === 'parent') { setEditingList(activeList); setShowListModal(true); }
                    else if (user) toast({ title: 'Only parents can edit list settings', variant: 'warning' });
                  },
                }] : []),
                { label: 'Manage Categories', icon: Tags, onClick: () => setShowCategoriesModal(true) },
                { label: showChecked ? 'Hide Checked Items' : 'Show Checked Items', checked: showChecked, onClick: () => setShowChecked(!showChecked) },
              ] as OverflowItem[]}
            />

            {isMobile && lists.length > 1 ? (
              <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-2 py-1">
                <div className="flex items-center justify-between gap-2">
                  <Button size="icon" variant="ghost" onClick={goPrevList}
                    disabled={currentListIdx <= 0} aria-label="Previous list" className="h-8 w-8 shrink-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="flex flex-col items-center min-w-0 flex-1">
                    <span className="font-semibold text-sm truncate max-w-full">{activeList?.name}</span>
                    <div className="flex gap-1 mt-0.5">
                      {lists.map((l, i) => (
                        <span key={l.id} className={cn(
                          'rounded-full transition-all',
                          i === currentListIdx ? 'bg-primary w-3 h-1.5' : 'bg-muted-foreground/40 w-1.5 h-1.5'
                        )} />
                      ))}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={goNextList}
                    disabled={currentListIdx >= lists.length - 1} aria-label="Next list" className="h-8 w-8 shrink-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : !isMobile ? (
              <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-3 py-1">
                <div className="overflow-x-auto">
                  <div className="flex gap-1 items-center min-w-max">
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
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}

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

        <div ref={swipeRef} className="flex-1 overflow-y-auto p-2 pb-24">
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
          ) : activeList ? (
            <div className="max-w-7xl mx-auto">
              <div className={cn(
                'grid gap-2',
                isMobile ? 'grid-cols-1' : isPortrait ? 'grid-cols-2' : 'grid-cols-3'
              )}>
                {groceryCategoryItems.map(({ category, items }) => {
                  const categoryExtraRows = extraRows[category] || 0;
                  const totalEmptyLines = BASE_EMPTY_LINES + categoryExtraRows;
                  const emptyLinesNeeded = Math.max(0, totalEmptyLines - items.length);
                  return (
                    <ShoppingCategoryCard
                      key={category}
                      category={category}
                      items={items}
                      categoryColor={getDynCategoryColor(category)}
                      categoryEmoji={getDynCategoryEmoji(category)}
                      isDragging={draggedCategory === category}
                      emptyLinesNeeded={emptyLinesNeeded}
                      extraRowCount={categoryExtraRows}
                      baseEmptyLines={BASE_EMPTY_LINES}
                      inlineInputValue={inlineInputs[category] || ''}
                      inputRefs={inputRefs}
                      onDragStart={() => handleDragStart(category)}
                      onDragOver={(e) => handleDragOver(e, category)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={(e) => handleTouchStart(e, category)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      onToggleItem={(itemId) => toggleItem(itemId)}
                      onEditItem={handleEditItem}
                      onDeleteItem={(itemId) => handleDeleteItem(itemId)}
                      onAddItem={handleAddItem}
                      onInlineInputChange={(cat, value) => setInlineInputs(prev => ({ ...prev, [cat]: value }))}
                      onInlineKeyDown={handleInlineKeyDown}
                      onInlineBlur={handleInlineBlur}
                      onAddExtraRows={addExtraRows}
                      isMobile={isMobile}
                    />
                  );
                })}
              </div>

              {otherItems.length > 0 && (
                <div className="mt-6 space-y-4">
                  <h3 className="text-lg font-semibold text-muted-foreground">Other Items</h3>
                  {otherItems.map(([category, items]) => (
                    <div key={category} className="border rounded-lg p-3 bg-card/90 backdrop-blur-sm">
                      <h4 className="text-base font-semibold text-muted-foreground mb-2 capitalize flex items-center gap-2">
                        <span>{getDynCategoryEmoji(category)}</span><span>{category}</span>
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
          ) : null}
        </div>

        {showAddItemModal && activeList && (
          <ItemModal listId={activeList.id} lists={lists} defaultCategory={defaultCategory || undefined}
            onClose={() => { setShowAddItemModal(false); setDefaultCategory(null); }}
            onSave={handleSaveNewItem} />
        )}

        {editingItem && (
          <ItemModal listId={editingItem.listId} item={editingItem}
            onClose={() => setEditingItem(null)} onSave={handleUpdateItem} />
        )}

        {showListModal && (
          <ListModal list={editingList} familyMembers={familyMembers} categories={dynamicCategories}
            onClose={() => { setShowListModal(false); setEditingList(null); }}
            onSave={handleSaveList} onDelete={handleDeleteList} />
        )}

        <ManageCategoriesModal open={showCategoriesModal} onOpenChange={setShowCategoriesModal} />

        {showCameraScanner && (
          <CameraScannerOverlay
            onClose={() => setShowCameraScanner(false)}
            onScan={(barcode) => handleCameraScan(barcode, () => setShowCameraScanner(false))}
          />
        )}

        <ScanFlowSheet
          scan={scan}
          lists={lists}
          activeListId={activeListId}
          dynamicCategories={dynamicCategories}
          getCategoryEmoji={getDynCategoryEmoji}
          onClear={clearScan}
          onListChosen={handleListChosen}
          onDoAdd={doAdd}
        />

        <ShoppingCelebration show={showCelebration} onComplete={() => setShowCelebration(false)} />

        {showKrogerModal && activeList && (
          <KrogerCartModal
            items={activeList.items.filter((i) => !i.checked)}
            onClose={() => setShowKrogerModal(false)}
          />
        )}
      </div>
    </PageWrapper>
  );
}
