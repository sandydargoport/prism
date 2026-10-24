'use client';

import { useState, useMemo, useRef } from 'react';
import { toast } from '@/components/ui/use-toast';
import {
  Lightbulb,
  Plus,
  ExternalLink,
  Pencil,
  Trash2,
  GripVertical,
  DollarSign,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { CarouselArrows } from '@/components/ui/CarouselArrows';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useFamily } from '@/components/providers/FamilyProvider';
import { useAuth } from '@/components/providers';
import { useGiftIdeas } from '@/lib/hooks/useGiftIdeas';
import { cn } from '@/lib/utils';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import type { GiftIdea, FamilyMember } from '@/types';

interface GiftIdeasViewProps {
  /** PersonFilter selection from the parent. null/empty = show all members. */
  selectedMemberIds?: string[] | null;
  /** When false (the default), show one combined list; when true, one column
   *  per person. Driven by the shared "Group" control in WishesView. */
  groupByUser?: boolean;
  /** Hide ideas already marked purchased. */
  hidePurchased?: boolean;
}

export function GiftIdeasView({ selectedMemberIds, groupByUser = false, hidePurchased = false }: GiftIdeasViewProps = {}) {
  const { members } = useFamily();
  const { activeUser, requireAuth } = useAuth();
  const { ideas, loading, error, addIdea, updateIdea, deleteIdea, togglePurchased } = useGiftIdeas(activeUser?.id);
  const { confirm, dialogProps } = useConfirmDialog();
  const orientation = useOrientation();
  const isMobile = useIsMobile();
  const isPortrait = orientation === 'portrait';

  const [editingIdea, setEditingIdea] = useState<GiftIdea | null>(null);
  const [quickAddByUser, setQuickAddByUser] = useState<Record<string, string>>({});
  // Flat-view quick add: unlike the per-person columns, the flat list has no
  // column to type into, so it carries its own recipient picker + input.
  const [flatAddName, setFlatAddName] = useState('');
  const [flatRecipient, setFlatRecipient] = useState<string>('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keyed on the ids themselves, so a new array with the same people does not
  // recompute the columns.
  const selectedKey = selectedMemberIds?.join(',') ?? '';
  const otherMembers = useMemo(() => {
    // Gift ideas are tracked for OTHER people — never render a self-column
    // (the API already excludes the active user, so a self-column is blank).
    const withoutSelf = members.filter((m) => m.id !== activeUser?.id);
    if (!selectedKey) return withoutSelf;
    const selected = selectedKey.split(',');
    return withoutSelf.filter((m) => selected.includes(m.id));
  }, [members, selectedKey, activeUser?.id]);

  // Apply the "Hide purchased" toggle once, up front.
  const visibleIdeas = useMemo(
    () => (hidePurchased ? ideas.filter(i => !i.purchased) : ideas),
    [ideas, hidePurchased],
  );

  // Group ideas by forUserId (for the per-person column view)
  const ideasByUser = useMemo(() => {
    const map: Record<string, GiftIdea[]> = {};
    for (const idea of visibleIdeas) {
      if (!map[idea.forUserId]) map[idea.forUserId] = [];
      map[idea.forUserId]!.push(idea);
    }
    return map;
  }, [visibleIdeas]);

  // Flat (ungrouped) list — every visible recipient's ideas in one list, with
  // an owner tag per row. Ordered to follow the member order on screen.
  const flatIdeas = useMemo(() => {
    const order = new Map(otherMembers.map((m, i) => [m.id, i]));
    return visibleIdeas
      .filter(i => order.has(i.forUserId))
      .sort((a, b) => (order.get(a.forUserId)! - order.get(b.forUserId)!));
  }, [visibleIdeas, otherMembers]);

  // Default the flat-view recipient to the one filtered person, else the first.
  const flatRecipientId = flatRecipient && otherMembers.some(m => m.id === flatRecipient)
    ? flatRecipient
    : otherMembers[0]?.id || '';

  const handleQuickAdd = async (forUserId: string) => {
    const name = (quickAddByUser[forUserId] || '').trim();
    if (!name) return;
    const user = await requireAuth("Who's adding this idea?");
    if (!user) return;
    try {
      await addIdea({ forUserId, name });
      setQuickAddByUser((prev) => ({ ...prev, [forUserId]: '' }));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to add', variant: 'destructive' });
    }
  };

  const handleFlatAdd = async () => {
    const name = flatAddName.trim();
    if (!name || !flatRecipientId) return;
    const user = await requireAuth("Who's adding this idea?");
    if (!user) return;
    try {
      await addIdea({ forUserId: flatRecipientId, name });
      setFlatAddName('');
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'Failed to add', variant: 'destructive' });
    }
  };

  const handleDelete = async (idea: GiftIdea) => {
    const ok = await confirm(`Remove "${idea.name}"?`, 'This gift idea will be permanently deleted.');
    if (!ok) return;
    try {
      await deleteIdea(idea.id);
      toast({ title: `Removed "${idea.name}"` });
    } catch {
      toast({ title: 'Failed to delete', variant: 'destructive' });
    }
  };

  const handleTogglePurchased = async (idea: GiftIdea) => {
    try {
      await togglePurchased(idea.id);
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    }
  };

  if (!activeUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <EmptyState icon={<Lightbulb />} title="Log in to see your gift ideas" />
      </div>
    );
  }

  if (loading) {
    return <PageLoader className="py-8" />;
  }

  if (error) {
    return <div className="text-destructive text-center py-8">{error}</div>;
  }

  // See ChoreGroupGrid for full context. N members visible at a time
  // (1 mobile, 4 desktop); snap carousel when total exceeds N.
  const groupsPerScreen = isMobile ? 1 : 4;
  const isCarousel = otherMembers.length > groupsPerScreen;
  const colTrack = isCarousel
    ? isMobile
      ? 'calc(100vw - 32px)'
      : `calc((100% - ${(groupsPerScreen - 1) * 12}px) / ${groupsPerScreen})`
    : 'minmax(220px, 1fr)';
  return (
    <>
      {!groupByUser ? (
        <GiftIdeasFlatList
          ideas={flatIdeas}
          otherMembers={otherMembers}
          recipientId={flatRecipientId}
          onRecipientChange={setFlatRecipient}
          addName={flatAddName}
          onAddNameChange={setFlatAddName}
          onAdd={handleFlatAdd}
          onTogglePurchased={handleTogglePurchased}
          onEdit={setEditingIdea}
          onDelete={handleDelete}
        />
      ) : (
      <div className="relative h-full">
      <div
        ref={scrollRef}
        className={cn(
          // See ChoreGroupGrid for the grid-rows-1 reasoning.
          'grid grid-rows-1 gap-3 h-full overflow-x-auto scroll-smooth',
          isCarousel && 'snap-x snap-mandatory'
        )}
        style={{
          gridTemplateColumns: `repeat(${Math.max(otherMembers.length, 1)}, ${colTrack})`,
        }}
      >
        {otherMembers.map((member) => {
          const memberIdeas = ideasByUser[member.id] || [];
          return (
            <div
              key={member.id}
              className={cn(
                'flex flex-col rounded-xl border-2 bg-card/50 overflow-hidden min-h-0',
                isCarousel && 'snap-start'
              )}
              style={{ borderColor: member.color }}
            >
              {/* Card header */}
              <div
                className="flex items-center gap-1 px-2 py-1.5 shrink-0 select-none"
                style={{ backgroundColor: member.color + '20' }}
              >
                <Lightbulb className="h-4 w-4 shrink-0" style={{ color: member.color }} />
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: member.color }}
                />
                <h3 className="font-semibold text-sm truncate" style={{ color: member.color }}>
                  {member.name}
                </h3>
                <span className="text-xs text-muted-foreground whitespace-nowrap ml-1">
                  {memberIdeas.length}
                </span>
              </div>

              {/* Quick add + item list */}
              <div className="flex-1 overflow-y-auto overscroll-contain p-2 space-y-1">
                <Input
                  placeholder={`Gift idea for ${member.name}...`}
                  value={quickAddByUser[member.id] || ''}
                  onChange={(e) => setQuickAddByUser((prev) => ({ ...prev, [member.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleQuickAdd(member.id);
                    }
                  }}
                  className="h-8 text-sm mb-1"
                />
                {memberIdeas.length === 0 ? (
                  <EmptyState size="sm" title="No ideas yet" />
                ) : (
                  memberIdeas.map((idea) => (
                    <GiftIdeaRow
                      key={idea.id}
                      idea={idea}
                      onTogglePurchased={() => handleTogglePurchased(idea)}
                      onEdit={() => setEditingIdea(idea)}
                      onDelete={() => handleDelete(idea)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
        {isCarousel && !isMobile && <CarouselArrows scrollRef={scrollRef} />}
      </div>
      )}

      {/* Edit modal (inline for simplicity) */}
      {editingIdea && (
        <EditGiftIdeaModal
          idea={editingIdea}
          onClose={() => setEditingIdea(null)}
          onSave={async (data) => {
            try {
              await updateIdea(editingIdea.id, data);
              setEditingIdea(null);
              toast({ title: 'Gift idea updated' });
            } catch {
              toast({ title: 'Failed to update', variant: 'destructive' });
            }
          }}
        />
      )}

      <ConfirmDialog {...dialogProps} />
    </>
  );
}

/** Flat (ungrouped) gift-ideas list: one combined list with an owner tag per
 *  row, plus a recipient picker beside the add box (there's no per-person
 *  column to type into here). */
function GiftIdeasFlatList({
  ideas,
  otherMembers,
  recipientId,
  onRecipientChange,
  addName,
  onAddNameChange,
  onAdd,
  onTogglePurchased,
  onEdit,
  onDelete,
}: {
  ideas: GiftIdea[];
  otherMembers: FamilyMember[];
  recipientId: string;
  onRecipientChange: (id: string) => void;
  addName: string;
  onAddNameChange: (v: string) => void;
  onAdd: () => void;
  onTogglePurchased: (idea: GiftIdea) => void;
  onEdit: (idea: GiftIdea) => void;
  onDelete: (idea: GiftIdea) => void;
}) {
  const membersById = useMemo(
    () => new Map(otherMembers.map(m => [m.id, m])),
    [otherMembers],
  );
  // The owner tag only earns its place when more than one recipient is in view.
  const showOwner = otherMembers.length > 1;

  if (otherMembers.length === 0) {
    return (
      <div className="py-8">
        <EmptyState icon={<Lightbulb />} title="No one to add gift ideas for" />
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl mx-auto">
      {/* Add box with a recipient picker */}
      <div className="flex gap-2">
        <select
          value={recipientId}
          onChange={(e) => onRecipientChange(e.target.value)}
          aria-label="Gift idea recipient"
          className="h-8 shrink-0 rounded-md border border-input bg-background px-2 text-sm"
        >
          {otherMembers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <Input
          placeholder="Add a gift idea..."
          value={addName}
          onChange={(e) => onAddNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onAdd();
            }
          }}
          className="h-8 text-sm"
        />
      </div>

      {ideas.length === 0 ? (
        <EmptyState icon={<Lightbulb />} title="No gift ideas yet" />
      ) : (
        ideas.map((idea) => (
          <GiftIdeaRow
            key={idea.id}
            idea={idea}
            owner={showOwner ? membersById.get(idea.forUserId) : undefined}
            onTogglePurchased={() => onTogglePurchased(idea)}
            onEdit={() => onEdit(idea)}
            onDelete={() => onDelete(idea)}
          />
        ))
      )}
    </div>
  );
}

function GiftIdeaRow({
  idea,
  owner,
  onTogglePurchased,
  onEdit,
  onDelete,
}: {
  idea: GiftIdea;
  /** Shown as a small name/color tag in the flat (ungrouped) list, where the
   *  recipient isn't implied by a per-person column. */
  owner?: FamilyMember;
  onTogglePurchased: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border border-border cursor-pointer',
        'hover:bg-muted/50 transition-colors group',
        idea.purchased && 'opacity-60',
      )}
      onClick={onTogglePurchased}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {owner && (
            <span
              className="inline-flex items-center gap-1 shrink-0 text-xs font-medium rounded-full px-1.5 py-0.5"
              style={{ backgroundColor: owner.color + '20', color: owner.color }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: owner.color }} />
              {owner.name}
            </span>
          )}
          <span className={cn('font-medium text-sm truncate', idea.purchased && 'line-through text-muted-foreground')}>
            {idea.name}
          </span>
          {idea.url && (
            <a
              href={idea.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-foreground shrink-0"
              title="Open link"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {idea.price && (
            <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-0.5">
              <DollarSign className="h-3 w-3" />{idea.price}
            </span>
          )}
        </div>
        {idea.notes && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">{idea.notes}</p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-60"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-60 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function EditGiftIdeaModal({
  idea,
  onClose,
  onSave,
}: {
  idea: GiftIdea;
  onClose: () => void;
  onSave: (data: { name: string; url?: string; notes?: string; price?: string }) => void;
}) {
  const [name, setName] = useState(idea.name);
  const [url, setUrl] = useState(idea.url || '');
  const [notes, setNotes] = useState(idea.notes || '');
  const [price, setPrice] = useState(idea.price || '');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">Edit Gift Idea</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Link (optional)</label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} autoCapitalize="none" placeholder="https://..." />
          </div>
          <div>
            <label className="text-sm font-medium">Price (optional)</label>
            <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="29.99" />
          </div>
          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Size, color, etc." />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave({ name, url: url || undefined, notes: notes || undefined, price: price || undefined })} disabled={!name.trim()}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
