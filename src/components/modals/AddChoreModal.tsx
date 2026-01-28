/**
 * ============================================================================
 * PRISM - Add Chore Modal
 * ============================================================================
 *
 * A modal dialog for creating and editing chores.
 * Includes form fields for title, category, frequency, points, and assignment.
 *
 * USAGE:
 *   <AddChoreModal
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     onChoreCreated={(chore) => console.log('Created:', chore)}
 *   />
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Switch,
} from '@/components/ui';

/**
 * Family member for assignment dropdown
 */
interface FamilyMember {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
}

/**
 * Chore data returned after creation
 */
export interface CreatedChore {
  id: string;
  title: string;
  description: string | null;
  category: 'cleaning' | 'laundry' | 'dishes' | 'yard' | 'pets' | 'trash' | 'other';
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  customIntervalDays?: number | null;
  pointValue: number;
  requiresApproval: boolean;
  assignedTo: {
    id: string;
    name: string;
    color: string;
  } | null;
}

/**
 * Chore data for editing
 */
export interface ChoreToEdit {
  id: string;
  title: string;
  description?: string;
  category: 'cleaning' | 'laundry' | 'dishes' | 'yard' | 'pets' | 'trash' | 'other';
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  customIntervalDays?: number;
  pointValue: number;
  requiresApproval: boolean;
  assignedTo?: {
    id: string;
    name: string;
    color: string;
  };
}

/**
 * AddChoreModal Props
 */
export interface AddChoreModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when chore is successfully created or updated */
  onChoreCreated?: (chore: CreatedChore) => void;
  /** Chore to edit (if provided, modal is in edit mode) */
  chore?: ChoreToEdit;
}

/**
 * Category emoji mapping
 */
function getCategoryEmoji(category: string): string {
  switch (category) {
    case 'cleaning': return '🧹';
    case 'laundry': return '🧺';
    case 'dishes': return '🍽️';
    case 'yard': return '🌿';
    case 'pets': return '🐾';
    case 'trash': return '🗑️';
    default: return '✨';
  }
}

/**
 * ADD CHORE MODAL COMPONENT
 */
export function AddChoreModal({
  open,
  onOpenChange,
  onChoreCreated,
  chore,
}: AddChoreModalProps) {
  const isEditMode = !!chore;

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<'cleaning' | 'laundry' | 'dishes' | 'yard' | 'pets' | 'trash' | 'other'>('cleaning');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom'>('weekly');
  const [customIntervalDays, setCustomIntervalDays] = useState<number>(7);
  const [pointValue, setPointValue] = useState(5);
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>('');

  // Loading/error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Family members for assignment
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Fetch family members when modal opens
  useEffect(() => {
    if (open) {
      fetchFamilyMembers();
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (open && chore) {
      setTitle(chore.title);
      setDescription(chore.description || '');
      setCategory(chore.category);
      setFrequency(chore.frequency);
      setCustomIntervalDays(chore.customIntervalDays || 7);
      setPointValue(chore.pointValue);
      setRequiresApproval(chore.requiresApproval);
      setAssignedTo(chore.assignedTo?.id || '');
    }
  }, [open, chore]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setCategory('cleaning');
      setFrequency('weekly');
      setCustomIntervalDays(7);
      setPointValue(5);
      setRequiresApproval(false);
      setAssignedTo('');
      setError(null);
    }
  }, [open]);

  async function fetchFamilyMembers() {
    try {
      setLoadingMembers(true);
      const response = await fetch('/api/family');
      if (response.ok) {
        const data = await response.json();
        setFamilyMembers(
          data.members.map((m: { id: string; name: string; color: string; avatarUrl?: string | null }) => ({
            id: m.id,
            name: m.name,
            color: m.color,
            avatarUrl: m.avatarUrl,
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch family members:', err);
    } finally {
      setLoadingMembers(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        frequency,
        pointValue,
        requiresApproval,
        assignedTo: assignedTo || undefined,
      };

      if (frequency === 'custom') {
        payload.customIntervalDays = customIntervalDays;
      }

      const url = isEditMode ? `/api/chores/${chore.id}` : '/api/chores';
      const method = isEditMode ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save chore');
      }

      const savedChore = await response.json();

      if (onChoreCreated) {
        onChoreCreated(savedChore);
      }

      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save chore:', err);
      setError(err instanceof Error ? err.message : 'Failed to save chore');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Chore' : 'Add Chore'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update chore details and assignment.' : 'Create a new household chore with category and frequency.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="chore-title">Title</Label>
            <Input
              id="chore-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chore title..."
              autoFocus
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="chore-description">Description (optional)</Label>
            <Input
              id="chore-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details..."
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex gap-2 flex-wrap">
              {(['cleaning', 'laundry', 'dishes', 'yard', 'pets', 'trash', 'other'] as const).map((cat) => (
                <Button
                  key={cat}
                  type="button"
                  variant={category === cat ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCategory(cat)}
                  className="capitalize"
                >
                  {getCategoryEmoji(cat)} {cat}
                </Button>
              ))}
            </div>
          </div>

          {/* Frequency */}
          <div className="space-y-2">
            <Label>Frequency</Label>
            <div className="flex gap-2 flex-wrap">
              {(['daily', 'weekly', 'biweekly', 'monthly'] as const).map((freq) => (
                <Button
                  key={freq}
                  type="button"
                  variant={frequency === freq ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFrequency(freq)}
                  className="capitalize"
                >
                  {freq}
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Interval (only show if frequency is custom) */}
          {frequency === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-days">Custom Interval (days)</Label>
              <Input
                id="custom-days"
                type="number"
                value={customIntervalDays}
                onChange={(e) => setCustomIntervalDays(parseInt(e.target.value) || 1)}
                min="1"
                max="365"
              />
            </div>
          )}

          {/* Points */}
          <div className="space-y-2">
            <Label htmlFor="chore-points">Points</Label>
            <Input
              id="chore-points"
              type="number"
              value={pointValue}
              onChange={(e) => setPointValue(parseInt(e.target.value) || 0)}
              min="0"
              max="100"
            />
          </div>

          {/* Requires Approval */}
          <div className="flex items-center gap-2">
            <Switch
              id="requires-approval"
              checked={requiresApproval}
              onCheckedChange={setRequiresApproval}
            />
            <Label htmlFor="requires-approval" className="cursor-pointer">
              Requires approval
            </Label>
          </div>

          {/* Assign To */}
          <div className="space-y-2">
            <Label>Assign To</Label>
            {loadingMembers ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading family members...
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <Button
                  type="button"
                  variant={!assignedTo ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAssignedTo('')}
                >
                  Anyone
                </Button>
                {familyMembers.map((member) => (
                  <Button
                    key={member.id}
                    type="button"
                    variant={assignedTo === member.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setAssignedTo(member.id)}
                    className="gap-1"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: member.color }}
                    />
                    {member.name}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              {error}
            </div>
          )}

          {/* Footer */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {isEditMode ? 'Saving...' : 'Creating...'}
                </>
              ) : (
                isEditMode ? 'Save Changes' : 'Add Chore'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
