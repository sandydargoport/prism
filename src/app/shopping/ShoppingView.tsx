'use client';

import { usePageAdd } from '@/lib/hooks/usePageAdd';
import { ShoppingCalmList } from './ShoppingCalmList';
import { useState, useEffect } from 'react';
import { toast } from '@/components/ui/use-toast';
import { ShoppingCart, Plus, Settings, Maximize2, Minimize2, Tags, Send, ChevronLeft, ChevronRight, ScanLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { PageWrapper, SubpageHeader, UndoButton } from '@/components/layout';
import type { OverflowItem } from '@/components/layout';
import { ShoppingManage } from '@/app/shopping/ShoppingManage';
import { ItemModal } from '@/app/shopping/ItemModal';
import { ListModal } from '@/app/shopping/ListModal';
import { ShoppingCelebration } from '@/app/shopping/ShoppingCelebration';
import { ScanFlowSheet } from '@/app/shopping/ScanFlowSheet';
import { KrogerCartModal } from '@/app/shopping/KrogerCartModal';
import { useShoppingViewData } from './useShoppingViewData';
import { useShoppingCategories } from '@/lib/hooks/useShoppingCategories';
import { useShoppingDragReorder } from './useShoppingDragReorder';
import { useShoppingCelebration } from './useShoppingCelebration';
import { useShoppingScanFlow } from './useShoppingScanFlow';
import { useShoppingCrudHandlers } from './useShoppingCrudHandlers';
import { ALL_DEFAULT_CATEGORIES } from '@/lib/constants/shoppingPresets';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
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
    addCategory, removeCategory, reorderCategories, updateCategory,
    getCategoryEmoji: getDynCategoryEmoji,
    getCategoryColor: getDynCategoryColor,
  } = useShoppingCategories();

  const [defaultCategory, setDefaultCategory] = useState<string | null>(null);
  const { confirm, dialogProps: confirmProps } = useConfirmDialog();

  const categoryOrder = dynamicCategories.map(c => c.id);
  const effectiveCategoryOrder = activeList?.visibleCategories
    ? categoryOrder.filter(id => activeList.visibleCategories!.includes(id))
    : categoryOrder;

  const {
    draggedCategory,
    handleDragStart, handleDragOver, handleDragEnd,
    startTouchDrag, moveTouchDrag, endTouchDrag,
  } = useShoppingDragReorder({ categoryOrder, dynamicCategories, reorderCategories });

  const { showCelebration, setShowCelebration } = useShoppingCelebration(activeListId, checkedItems, totalItems);

  const isMobile = useIsMobile();
  // On a phone the round button adds an item (#1028): it brings up the list's add field.
  usePageAdd('Add item', () => {
    const field = document.querySelector<HTMLInputElement>('[data-shopping-add]');
    field?.scrollIntoView({ block: 'center' });
    field?.focus();
  });
  const [shoppingMode, setShoppingMode] = useState(false);
  // The page opens on one calm list (#881); the category cards are behind Manage.
  const [manage, setManage] = useState(false);

  // Mobile-only: swipe to switch lists. The pill bar collapses into a
  // compact prev/dots/next indicator when there's more than one list.
  // Single-list households skip the affordance entirely (UX recommendation).
  // The list on screen, not the id chosen at mount: that is empty when the
  // lists load after the first render, which left the arrows and swipe dead.
  const currentListIdx = lists.findIndex((l) => l.id === activeList?.id);
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

  // Items still to buy on this list, by category, for Manage's rows (#1055).
  const toBuy: Record<string, number> = {};
  for (const item of activeList?.items ?? []) {
    if (!item.checked) toBuy[item.category ?? 'other'] = (toBuy[item.category ?? 'other'] ?? 0) + 1;
  }

  // Manage changes the household's categories: a signed-in person, as adding one needed (#1053).
  const changeCategories = async () => Boolean(await requireAuth('Change the categories'));
  const setListCategories = async (visible: string[]) => {
    if (!activeList) return;
    const res = await fetch(`/api/shopping-lists/${activeList.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visibleCategories: visible }),
    });
    if (!res.ok) toast({ title: 'Could not change this list. Try again.', variant: 'destructive' });
    await refreshLists();
  };

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
      <div className="h-page flex flex-col">
        {!shoppingMode && (
          <>
            <SubpageHeader
              icon={<ShoppingCart className="h-5 w-5 text-primary" />}
              title="Shopping"
              badge={activeList ? <Badge variant="secondary">{checkedItems}/{totalItems}</Badge> : undefined}
              actions={<>
                <UndoButton />
                <Button variant={manage ? 'secondary' : 'outline'} size="sm" onClick={() => setManage(!manage)} data-shopping-manage>
                  {manage ? 'Done' : 'Manage'}
                </Button>
                {/* On a phone the header keeps Manage and the menu; the rest is in
                    the menu, so the title has room and the one "+" adds an item (#1020). */}
                {!isMobile && activeList && activeList.items.some((i) => !i.checked) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const user = await requireAuth('Send to Kroger');
                      if (!user) return;
                      setShowKrogerModal(true);
                    }}
                    title="Send unchecked items to Kroger / Mariano's cart"
                    aria-label="Send to Kroger"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send to Kroger
                  </Button>
                )}
                {!isMobile && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => setShoppingMode(true)} title="Enter shopping mode">
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleNewList} size="sm" aria-label="Add List" title="Add List">
                      <Plus className="h-4 w-4 mr-1" />
                      Add List
                    </Button>
                  </>
                )}
              </>}
              overflow={[
                ...(isMobile ? [
                  { label: 'Scan Barcode', icon: ScanLine, onClick: () => window.dispatchEvent(new CustomEvent('prism:open-barcode-scanner')) },
                  ...(activeList && activeList.items.some((i) => !i.checked) ? [{
                    label: 'Send to Kroger',
                    icon: Send,
                    onClick: async () => {
                      const user = await requireAuth('Send to Kroger');
                      if (user) setShowKrogerModal(true);
                    },
                  }] : []),
                  { label: 'Shopping mode', icon: Maximize2, onClick: () => setShoppingMode(true) },
                  { label: 'New list', icon: Plus, onClick: handleNewList },
                ] : []),
                ...(activeList ? [{
                  label: 'Edit List',
                  icon: Settings,
                  onClick: async () => {
                    const user = await requireAuth("Who's editing this list?");
                    if (user && user.role === 'parent') { setEditingList(activeList); setShowListModal(true); }
                    else if (user) toast({ title: 'Only parents can edit list settings', variant: 'warning' });
                  },
                }] : []),
                { label: 'Manage Categories', icon: Tags, onClick: () => setManage(true) },
                { label: showChecked ? 'Hide Checked Items' : 'Show Checked Items', checked: showChecked, onClick: () => setShowChecked(!showChecked) },
              ] as OverflowItem[]}
            />

            {isMobile && lists.length > 1 ? (
              <div className="shrink-0 border-b border-border bg-card/85 backdrop-blur-xs px-2 py-1">
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
              <div className="shrink-0 border-b border-border bg-card/85 backdrop-blur-xs px-3 py-1">
                <div className="overflow-x-auto">
                  <div className="flex gap-1 items-center min-w-max">
                    {lists.map((list) => {
                      const assignedMember = list.assignedTo ? familyMembers.find(m => m.id === list.assignedTo) : null;
                      return (
                        <Button key={list.id} variant={activeList?.id === list.id ? 'secondary' : 'ghost'} size="sm"
                          onClick={() => setActiveListId(list.id)} className="relative"
                          aria-pressed={activeList?.id === list.id} data-shopping-list-pill>
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
          <header className="shrink-0 border-b border-border bg-card/85 backdrop-blur-xs px-3 py-1 safe-area-top">
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

        <div ref={swipeRef} className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <PageLoader label="Loading shopping lists..." />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-destructive text-lg">Error: {error}</p>
              <p className="text-base mt-2">Please check your connection</p>
            </div>
          ) : !activeList ? (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={<ShoppingCart />}
                title="No shopping lists yet"
                action={<Button variant="outline" size="sm" onClick={handleNewList}>Create your first list</Button>}
              />
            </div>
          ) : activeList && !manage && !shoppingMode ? (
            <div className="pb-24 pt-2">
              <ShoppingCalmList
                // A new list starts fresh: a question left open belongs to the list it was asked on.
                key={activeList.id}
                items={activeList.items as ShoppingItem[]}
                order={effectiveCategoryOrder}
                allCategories={categoryOrder}
                onToggle={(id) => toggleItem(id)}
                onEdit={handleEditItem}
                onAdd={(name) => apiAddItem(activeList.id, { name, category: 'other' })}
                onFile={async (itemId, category) => {
                  const res = await fetch(`/api/shopping-items/${itemId}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category }),
                  });
                  if (!res.ok) { toast({ title: 'Could not move the item. Try again from its pencil.', variant: 'destructive' }); return; }
                  await refreshLists();
                }}
                label={(id) => dynamicCategories.find((c) => c.id === id)?.name ?? (id === 'other' ? 'Other' : id.charAt(0).toUpperCase() + id.slice(1))}
                color={getDynCategoryColor}
              />
            </div>
          ) : activeList ? (
            <div className="pb-24 pt-2">
              <ShoppingManage
                categories={dynamicCategories}
                listName={activeList.name}
                counts={toBuy}
                shown={(id) => effectiveCategoryOrder.includes(id)}
                drag={{
                  dragged: draggedCategory,
                  onDragStart: handleDragStart, onDragOver: handleDragOver, onDragEnd: handleDragEnd,
                  onTouchStart: startTouchDrag, onTouchMove: moveTouchDrag, onTouchEnd: endTouchDrag,
                }}
                onShow={async (id, show) => {
                  if (!(await changeCategories())) return;
                  const now = activeList.visibleCategories ?? categoryOrder;
                  await setListCategories(show ? [...now.filter((c) => c !== id), id] : now.filter((c) => c !== id));
                }}
                onRename={async (id, name) => {
                  if (!(await changeCategories())) return;
                  await updateCategory(id, { name });
                }}
                onEmoji={async (id, emoji) => {
                  if (!(await changeCategories())) return;
                  await updateCategory(id, { emoji });
                }}
                onRemove={async (cat) => {
                  if (!(await changeCategories())) return;
                  const ok = await confirm(`Remove "${cat.name}"?`, 'This removes the category from every shopping list. Its items move to Other.');
                  if (!ok) return;
                  await removeCategory(cat.id);
                  toast({ title: `Removed ${cat.name}.` });
                }}
                onAdd={async (name) => {
                  if (!(await changeCategories())) return false;
                  const added = await addCategory(name);
                  if (!added) { toast({ title: `There is already a ${name} category.`, variant: 'warning' }); return false; }
                  // A list that shows chosen categories gets the new one too (#1053).
                  if (activeList.visibleCategories) await setListCategories([...activeList.visibleCategories, added.id]);
                  toast({ title: `Added ${name} to ${activeList.name}.` });
                  return true;
                }}
                onReset={async () => {
                  if (!(await changeCategories())) return;
                  const ok = await confirm('Reset the categories?', 'This puts back the default categories and their order, for every list.');
                  if (!ok) return;
                  await reorderCategories([...ALL_DEFAULT_CATEGORIES]);
                  toast({ title: 'The default categories are back.' });
                }}
              />
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
            onClose={() => setEditingItem(null)} onSave={handleUpdateItem}
            onDelete={(id) => { setEditingItem(null); void handleDeleteItem(id); }} />
        )}

        {showListModal && (
          <ListModal list={editingList} familyMembers={familyMembers} categories={dynamicCategories}
            onClose={() => { setShowListModal(false); setEditingList(null); }}
            onSave={handleSaveList} onDelete={handleDeleteList} />
        )}

        <ConfirmDialog {...confirmProps} />

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
