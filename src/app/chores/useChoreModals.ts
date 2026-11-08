'use client';

import { toast } from '@/components/ui/use-toast';
import type { Chore } from '@/types';

interface ChoreFormData {
  title: string;
  description?: string;
  category: string;
  frequency: string;
  startDay?: string | null;
  pointValue: number;
  requiresApproval: boolean;
  assignedTo?: { id: string } | null;
  enabled?: boolean;
  nextDue?: string | null;
  nextDueTime?: string | null;
  timesPerDay?: number;
}

interface UseChoreModalsProps {
  refreshChores: () => void;
  setShowAddModal: (show: boolean) => void;
  setEditingChore: (chore: Chore | null) => void;
  deleteChore: (id: string) => void;
}

export function useChoreModals({
  refreshChores,
  setShowAddModal,
  setEditingChore,
  deleteChore,
}: UseChoreModalsProps) {
  const saveNewChore = async (chore: ChoreFormData) => {
    try {
      const response = await fetch('/api/chores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: chore.title,
          description: chore.description,
          category: chore.category,
          frequency: chore.frequency,
          startDay: chore.startDay || null,
          pointValue: chore.pointValue,
          requiresApproval: chore.requiresApproval,
          assignedTo: chore.assignedTo?.id,
          nextDue: chore.nextDue || undefined,
          nextDueTime: chore.nextDueTime ?? undefined,
          timesPerDay: chore.timesPerDay,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to create chore');
      }
      refreshChores();
      setShowAddModal(false);
    } catch (err) {
      console.error('Error creating chore:', err);
      toast({ title: err instanceof Error ? err.message : 'Failed to create chore', variant: 'destructive' });
    }
  };

  const saveEditedChore = async (choreId: string, updatedChore: ChoreFormData) => {
    try {
      const response = await fetch(`/api/chores/${choreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: updatedChore.title,
          description: updatedChore.description,
          category: updatedChore.category,
          frequency: updatedChore.frequency,
          startDay: updatedChore.startDay || null,
          pointValue: updatedChore.pointValue,
          requiresApproval: updatedChore.requiresApproval,
          assignedTo: updatedChore.assignedTo?.id,
          enabled: updatedChore.enabled,
          // null clears the field on the server; undefined would be stripped
          // and leave the prior value in place.
          nextDue: updatedChore.nextDue ?? null,
          nextDueTime: updatedChore.nextDueTime ?? null,
          timesPerDay: updatedChore.timesPerDay,
        }),
      });
      if (!response.ok) throw new Error('Failed to update chore');
      refreshChores();
      setEditingChore(null);
    } catch (err) {
      console.error('Error updating chore:', err);
      toast({ title: 'Failed to update chore', variant: 'destructive' });
    }
  };

  const handleDeleteFromModal = (choreId: string) => {
    setEditingChore(null);
    deleteChore(choreId);
  };

  return { saveNewChore, saveEditedChore, handleDeleteFromModal };
}
