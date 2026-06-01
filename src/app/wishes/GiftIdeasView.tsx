'use client';

import { useState, useMemo } from 'react';
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
import { useConfirmDialog } from '@/lib/hooks/useConfirmDialog';
import { useFamily } from '@/components/providers/FamilyProvider';
import { useAuth } from '@/components/providers';
import { useGiftIdeas } from '@/lib/hooks/useGiftIdeas';
import { cn } from '@/lib/utils';
import { useOrientation } from '@/lib/hooks/useOrientation';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import type { GiftIdea, FamilyMember } from '@/types';

export function GiftIdeasView() {
  const { members } = useFamily();
  const { activeUser, requireAuth } = useAuth();
  const { ideas, loading, error, addIdea, updateIdea, deleteIdea, togglePurchased } = useGiftIdeas(activeUser?.id);
  const { confirm, dialogProps } = useConfirmDialog();
  const orientation = useOrientation();
  const isMobile = useIsMobile();
  const isPortrait = orientation === 'portrait';

  const [editingIdea, setEditingIdea] = useState<GiftIdea | null>(null);
  const [quickAddByUser, setQuickAddByUser] = useState<Record<string, string>>({});

  const otherMembers = useMemo(() => members, [members]);

  // Group ideas by forUserId
  const ideasByUser = useMemo(() => {
    const map: Record<string, GiftIdea[]> = {};
    for (const idea of ideas) {
      if (!map[idea.forUserId]) map[idea.forUserId] = [];
      map[idea.forUserId]!.push(idea);
    }
    return map;
  }, [ideas]);

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
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Lightbulb className="h-12 w-12 mb-3 opacity-40" />
        <p>Log in to see your gift ideas</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-muted-foreground text-center py-8">Loading...</div>;
  }

  if (error) {
    return <div className="text-destructive text-center py-8">{error}</div>;
  }

  // Desktop: min-width columns + horizontal scroll. Mobile (multi-member):
  // viewport-wide columns + scroll-snap carousel — same UX as Chores/Tasks.
  const isSwipeCarousel = isMobile && otherMembers.length > 1;
  return (
    <>
      <div
        className={cn(
          'grid gap-3 h-full overflow-x-auto',
          isSwipeCarousel && 'snap-x snap-mandatory'
        )}
        style={{
          gridTemplateColumns: isSwipeCarousel
            ? `repeat(${otherMembers.length}, calc(100vw - 32px))`
            : `repeat(${Math.max(otherMembers.length, 1)}, minmax(220px, 1fr))`,
        }}
      >
        {otherMembers.map((member) => {
          const memberIdeas = ideasByUser[member.id] || [];
          return (
            <div
              key={member.id}
              className={cn(
                'flex flex-col rounded-xl border-2 bg-card/50 overflow-hidden min-h-0',
                isSwipeCarousel && 'snap-start'
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
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                  <p className="text-xs text-muted-foreground text-center py-4">No ideas yet</p>
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

function GiftIdeaRow({
  idea,
  onTogglePurchased,
  onEdit,
  onDelete,
}: {
  idea: GiftIdea;
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
          className="h-7 w-7 opacity-0 group-hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
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
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
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
