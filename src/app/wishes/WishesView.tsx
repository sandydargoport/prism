'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import { pushUndo } from '@/lib/hooks/useUndoStack';
import {
  Gift,
  Lightbulb,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  GripVertical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageWrapper, SubpageHeader, PersonFilter, UndoButton } from '@/components/layout';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CarouselArrows } from '@/components/ui/CarouselArrows';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useDragReorder } from '@/lib/hooks/useDragReorder';
import { useFamily } from '@/components/providers/FamilyProvider';
import { useAuth } from '@/components/providers';
import { useWishItems } from '@/lib/hooks/useWishItems';
import { WishItemModal } from './WishItemModal';
import { GiftIdeasView } from './GiftIdeasView';
import { cn } from '@/lib/utils';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import type { WishItem, FamilyMember } from '@/types';

export function WishesView() {
  const { members, loading: familyLoading } = useFamily();
  const { activeUser, requireAuth } = useAuth();

  const [activeTab, setActiveTab] = useState<'wishes' | 'ideas'>('wishes');

  // null = "All" (grouped by person), string[] = filtered to those members
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[] | null>(null);
  const viewerId = activeUser?.id || undefined;

  // Single selection optimises fetch; multi/none fetches all
  const selectedMemberId = selectedMemberIds?.length === 1 ? selectedMemberIds[0]! : null;
  const fetchMemberId = selectedMemberId || 'all';

  const {
    items,
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    claimItem,
    unclaimItem,
  } = useWishItems(fetchMemberId, viewerId);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForMemberId, setAddForMemberId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<WishItem | null>(null);
  const [authedUser, setAuthedUser] = useState<{ id: string } | null>(null);
  const [quickAddName, setQuickAddName] = useState('');
  const { confirm, dialogProps } = useConfirmDialog();

  const orientation = useOrientation();
  const isMobile = useIsMobile();
  const isPortrait = orientation === 'portrait';
  const showingAll = !selectedMemberIds || selectedMemberIds.length === 0;
  const wishGridRef = useRef<HTMLDivElement>(null);

  // --- Card drag-to-swap ---
  const memberIds = useMemo(() => members.map(m => m.id), [members]);
  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('prism:wish-card-order');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const effectiveOrder = useMemo(() => {
    const known = cardOrder.filter(k => memberIds.includes(k));
    const newKeys = memberIds.filter(k => !known.includes(k));
    return [...known, ...newKeys];
  }, [cardOrder, memberIds]);

  const saveCardOrder = useCallback((order: string[]) => {
    setCardOrder(order);
    try { localStorage.setItem('prism:wish-card-order', JSON.stringify(order)); } catch {}
  }, []);

  const { draggedId: draggedMemberId, getDragProps } = useDragReorder({
    order: effectiveOrder,
    onReorder: saveCardOrder,
  });

  // Members in card order
  const orderedMembers = useMemo(() => {
    return effectiveOrder
      .map(id => members.find(m => m.id === id))
      .filter((m): m is FamilyMember => m != null);
  }, [members, effectiveOrder]);

  // Group items by member when showing all
  const groupedItems = useMemo(() => {
    if (!showingAll) return null;
    const groups: Record<string, WishItem[]> = {};
    for (const item of items) {
      const key = item.memberId;
      if (!groups[key]) groups[key] = [];
      groups[key]!.push(item);
    }
    return groups;
  }, [items, showingAll]);

  // Resolve which member to add items to
  const targetMemberId = selectedMemberId || addForMemberId || activeUser?.id || members[0]?.id || null;

  const isOwnList = (memberId: string) => memberId === viewerId;

  // Auth before opening the add modal
  const handleOpenAddModal = async (forMemberId?: string) => {
    const user = await requireAuth("Who's adding a wish?");
    if (!user) return;
    setAuthedUser(user);
    if (forMemberId) setAddForMemberId(forMemberId);
    setShowAddModal(true);
  };

  // Auth before opening the edit modal
  const handleOpenEditModal = async (item: WishItem) => {
    const user = await requireAuth("Who's editing this wish?");
    if (!user) return;
    setAuthedUser(user);
    setEditingItem(item);
  };

  const handleQuickAdd = async (forMemberId?: string) => {
    const name = quickAddName.trim();
    const memberId = forMemberId || targetMemberId;
    if (!name || !memberId) return;

    const user = await requireAuth("Who's adding a wish?");
    if (!user) return;

    try {
      await addItem({ memberId, name, addedBy: user.id });
      setQuickAddName('');
      toast({ title: `Added "${name}"` });
    } catch {
      toast({ title: 'Failed to add item', variant: 'destructive' });
    }
  };

  const handleSaveModal = async (data: { name: string; url?: string; notes?: string }) => {
    const userId = authedUser?.id;
    if (!userId) return;

    if (editingItem) {
      await updateItem(editingItem.id, data);
      toast({ title: 'Wish updated' });
    } else {
      const memberId = addForMemberId || selectedMemberId || activeUser?.id || members[0]?.id;
      if (!memberId) return;
      await addItem({ memberId, ...data, addedBy: userId });
      toast({ title: `Added "${data.name}"` });
    }
  };

  const handleDelete = async (item: WishItem) => {
    const user = await requireAuth("Who's deleting this wish?");
    if (!user) return;

    const ok = await confirm(
      `Remove "${item.name}"?`,
      'This will permanently delete this wish list item.'
    );
    if (!ok) return;

    try {
      await deleteItem(item.id);
      toast({ title: `Removed "${item.name}"` });
    } catch {
      toast({ title: 'Failed to delete item', variant: 'destructive' });
    }
  };

  const handleClaim = async (item: WishItem) => {
    const user = await requireAuth();
    if (!user) return;

    try {
      if (item.claimed && item.claimedBy?.id === user.id) {
        await unclaimItem(item.id);
        toast({ title: `Unmarked "${item.name}"` });
      } else if (item.claimed && isOwnList(item.memberId)) {
        // Own list, already crossed off — unclaim
        await unclaimItem(item.id);
        toast({ title: `Uncrossed "${item.name}"` });
      } else {
        await claimItem(item.id, user.id);
        pushUndo(item.name, () => unclaimItem(item.id));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update';
      // Special handling for "someone already got this"
      if (message.includes('already got this')) {
        toast({ title: message, variant: 'success' });
      } else {
        toast({ title: message, variant: 'destructive' });
      }
    }
  };

  return (
    <PageWrapper>
      {/*
        h-screen + flex-col so the inner flex-1 overflow-auto content area
        fills remaining vertical space. Without this wrapper the toolbar
        and content stack at natural heights and the per-member columns
        collapse to their content — matches the Tasks / Chores / Shopping
        pattern.
      */}
      <div className="h-screen flex flex-col">
      <SubpageHeader
        title="Wishes"
        icon={<Gift className="h-6 w-6" />}
        actions={<>
          <UndoButton />
          {activeTab === 'wishes' && (
            <Button variant="ghost" size="icon" onClick={() => handleOpenAddModal()} aria-label="Add wish">
              <Plus className="h-5 w-5" />
            </Button>
          )}
        </>}
      />

      {/* Tab toggle + Member tabs */}
      <div className="px-4 pb-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center border rounded-md">
          <button
            onClick={() => setActiveTab('wishes')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-l-md transition-colors',
              activeTab === 'wishes' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            )}
          >
            <Gift className="h-3.5 w-3.5" />
            Wishes
          </button>
          <button
            onClick={() => setActiveTab('ideas')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-r-md transition-colors border-l',
              activeTab === 'ideas' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            )}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            Gift Ideas
          </button>
        </div>

        {!familyLoading && members.length > 0 && (
          <PersonFilter
            members={members}
            selected={selectedMemberIds}
            onSelect={setSelectedMemberIds}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 pb-4">
        {activeTab === 'ideas' ? (
          <GiftIdeasView selectedMemberIds={selectedMemberIds} />
        ) : loading || familyLoading ? (
          <div className="text-muted-foreground text-center py-8">Loading...</div>
        ) : error ? (
          <div className="text-destructive text-center py-8">{error}</div>
        ) : (
          /* See ChoreGroupGrid for full context. N members visible at a time
             (1 mobile, 4 desktop); snap carousel when total exceeds N. */
          (() => {
            const visibleMembers = orderedMembers.filter(m => showingAll || selectedMemberIds!.includes(m.id));
            const groupsPerScreen = isMobile ? 1 : 4;
            const isCarousel = visibleMembers.length > groupsPerScreen;
            const colTrack = isCarousel
              ? isMobile
                ? 'calc(100vw - 32px)'
                : `calc((100% - ${(groupsPerScreen - 1) * 12}px) / ${groupsPerScreen})`
              : 'minmax(220px, 1fr)';
            return (
          <div className="relative h-full">
          <div
            ref={wishGridRef}
            className={cn(
              // See ChoreGroupGrid for the grid-rows-1 reasoning.
              'grid grid-rows-1 gap-3 h-full overflow-x-auto scroll-smooth',
              isCarousel && 'snap-x snap-mandatory'
            )}
            style={{
              gridTemplateColumns: `repeat(${Math.max(visibleMembers.length, 1)}, ${colTrack})`,
            }}
          >
            {visibleMembers.map(member => {
              const memberItems = groupedItems?.[member.id] || [];
              const isDragging = draggedMemberId === member.id;
              return (
                <div key={member.id} className={cn(isCarousel && 'snap-start')}>
                  <MemberWishCard
                    member={member}
                    items={memberItems}
                    isOwnList={isOwnList(member.id)}
                    viewerId={viewerId}
                    isDragging={isDragging}
                    dragProps={isMobile ? {} : getDragProps(member.id)}
                    isMobile={isMobile}
                    onEdit={handleOpenEditModal}
                    onDelete={handleDelete}
                    onClaim={handleClaim}
                    onAdd={() => handleOpenAddModal(member.id)}
                  />
                </div>
              );
            })}
          </div>
            {isCarousel && !isMobile && <CarouselArrows scrollRef={wishGridRef} />}
          </div>
            );
          })()
        )}
      </div>

      {/* Add/Edit Modal */}
      <WishItemModal
        open={showAddModal || !!editingItem}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingItem(null);
            setAuthedUser(null);
            setAddForMemberId(null);
          }
        }}
        onSave={handleSaveModal}
        editingItem={editingItem}
      />

      <ConfirmDialog {...dialogProps} />
      </div>
    </PageWrapper>
  );
}


/** Grid card: one quadrant per family member, draggable */
function MemberWishCard({
  member,
  items,
  isOwnList,
  viewerId,
  isDragging,
  dragProps,
  isMobile = false,
  onEdit,
  onDelete,
  onClaim,
  onAdd,
}: {
  member: FamilyMember;
  items: WishItem[];
  isOwnList: boolean;
  viewerId?: string;
  isDragging: boolean;
  dragProps: Record<string, unknown>;
  isMobile?: boolean;
  onEdit: (item: WishItem) => void;
  onDelete: (item: WishItem) => void;
  onClaim: (item: WishItem) => void;
  onAdd: () => void;
}) {
  return (
    <div
      {...dragProps}
      className={cn(
        // h-full so the card fills its (grid-stretched) wrapper — without
        // this it collapses to natural content height, leaving the
        // per-member columns short and the inner body's flex-1 unable to
        // engage. GiftIdeasView avoids this by making the card the grid
        // cell directly; here a wrapper div sits between the grid and
        // the card to attach snap-start without changing the card API.
        'flex flex-col h-full rounded-xl border-2 bg-card/50 overflow-hidden min-h-0',
        'transition-all',
        !isMobile && 'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-50 scale-95 ring-4 ring-primary/50',
      )}
      style={{ borderColor: member.color }}
    >
      {/* Card header — draggable handle */}
      <div
        className="flex items-center gap-1 px-2 py-1.5 shrink-0 select-none"
        style={{ backgroundColor: member.color + '20' }}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0 hidden md:block" />
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: member.color }}
        />
        <h3 className="font-semibold text-sm truncate" style={{ color: member.color }}>
          {member.name}
        </h3>
        <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">
          {items.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-auto shrink-0"
          onClick={onAdd}
          title={`Add wish for ${member.name}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Scrollable item list */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">No wishes yet</p>
        ) : (
          items.map(item => (
            <WishItemRow
              key={item.id}
              item={item}
              isOwnList={isOwnList}
              viewerId={viewerId}
              compact
              onEdit={() => onEdit(item)}
              onDelete={() => onDelete(item)}
              onClaim={() => onClaim(item)}
            />
          ))
        )}
      </div>
    </div>
  );
}


/** Single person view with quick add */
function SinglePersonView({
  items,
  memberId,
  member,
  isOwnList,
  viewerId,
  quickAddName,
  setQuickAddName,
  onQuickAdd,
  onEdit,
  onDelete,
  onClaim,
}: {
  items: WishItem[];
  memberId: string;
  member?: FamilyMember;
  isOwnList: boolean;
  viewerId?: string;
  quickAddName: string;
  setQuickAddName: (v: string) => void;
  onQuickAdd: () => void;
  onEdit: (item: WishItem) => void;
  onDelete: (item: WishItem) => void;
  onClaim: (item: WishItem) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 mb-2">
        <Input
          value={quickAddName}
          onChange={(e) => setQuickAddName(e.target.value)}
          placeholder={isOwnList ? 'Add a wish...' : `Add a gift idea for ${member?.name}...`}
          className="flex-1 h-9"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onQuickAdd();
            }
          }}
        />
        <Button onClick={onQuickAdd} disabled={!quickAddName.trim()} size="sm">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg font-medium mb-1">
            {isOwnList ? 'Your wish list is empty' : `${member?.name}'s wish list is empty`}
          </p>
          <p className="text-sm">
            {isOwnList ? 'Add things you want!' : 'Add a gift idea for them!'}
          </p>
        </div>
      ) : (
        items.map(item => (
          <WishItemRow
            key={item.id}
            item={item}
            isOwnList={isOwnList}
            viewerId={viewerId}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
            onClaim={() => onClaim(item)}
          />
        ))
      )}
    </div>
  );
}


/** Single wish item row */
function WishItemRow({
  item,
  isOwnList,
  viewerId,
  compact,
  onEdit,
  onDelete,
  onClaim,
}: {
  item: WishItem;
  isOwnList: boolean;
  viewerId?: string;
  compact?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClaim: () => void;
}) {
  const isClaimedByMe = item.claimedBy?.id === viewerId;

  // On other people's lists, don't allow toggling if claimed by someone else
  const canToggle = isOwnList || !item.claimed || isClaimedByMe;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-lg border border-border',
        'hover:bg-muted/50 transition-colors',
        compact ? 'p-2 gap-2' : 'p-3 gap-3',
        canToggle && 'cursor-pointer',
        item.claimed && 'opacity-60',
      )}
      onClick={canToggle ? onClaim : undefined}
    >
      {/* Item content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-medium text-sm truncate',
            item.claimed && 'line-through text-muted-foreground'
          )}>
            {item.name}
          </span>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground shrink-0"
              title="Open link"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
        {item.notes && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{item.notes}</p>
        )}
        {/* Show who purchased (on other people's lists) */}
        {!isOwnList && item.claimed && item.claimedBy && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            {isClaimedByMe ? 'You purchased this' : `Purchased by ${item.claimedBy.name}`}
          </p>
        )}
        {/* Show self-crossed-off status */}
        {isOwnList && item.claimed && (
          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
            Got it myself
          </p>
        )}
      </div>

      {/* Actions (only on own list) */}
      {isOwnList && (
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
