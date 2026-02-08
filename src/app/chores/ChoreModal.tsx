'use client';

import * as React from 'react';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { getCategoryEmoji } from '@/app/chores/ChoreItem';
import type { Chore, FamilyMember } from '@/types';

export function ChoreModal({
  chore,
  onClose,
  onSave,
  familyMembers,
}: {
  chore?: Chore;
  onClose: () => void;
  onSave: (chore: Omit<Chore, 'id' | 'createdAt'>) => void;
  familyMembers: FamilyMember[];
}) {
  const [title, setTitle] = useState(chore?.title || '');
  const [description, setDescription] = useState(chore?.description || '');
  const [category, setCategory] = useState<Chore['category']>(chore?.category || 'cleaning');
  const [frequency, setFrequency] = useState<Chore['frequency']>(chore?.frequency || 'weekly');
  const [pointValue, setPointValue] = useState(chore?.pointValue || 5);
  const [requiresApproval, setRequiresApproval] = useState(chore?.requiresApproval || false);
  const [assignedTo, setAssignedTo] = useState(chore?.assignedTo?.id || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedMember = familyMembers.find((m) => m.id === assignedTo);

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      frequency,
      pointValue,
      requiresApproval,
      assignedTo: selectedMember || undefined,
      enabled: chore?.enabled ?? true,
      lastCompleted: chore?.lastCompleted,
      nextDue: chore?.nextDue,
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 pb-20 md:pb-0"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg border border-border max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">
            {chore ? 'Edit Chore' : 'Add Chore'}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Chore title..."
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details..."
            />
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <div className="flex gap-2 mt-1 flex-wrap">
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

          <div>
            <label className="text-sm font-medium">Frequency</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'semi-annually', 'annually'] as const).map((freq) => (
                <Button
                  key={freq}
                  type="button"
                  variant={frequency === freq ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFrequency(freq)}
                  className="capitalize"
                >
                  {freq === 'semi-annually' ? 'Semi-Annual' : freq}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Points</label>
            <Input
              type="number"
              value={pointValue}
              onChange={(e) => setPointValue(parseInt(e.target.value) || 0)}
              min="0"
              max="100"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={requiresApproval}
              onCheckedChange={setRequiresApproval}
            />
            <label className="text-sm font-medium">Requires approval</label>
          </div>

          <div>
            <label className="text-sm font-medium">Assign To</label>
            <div className="flex gap-2 mt-1 flex-wrap">
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
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {chore ? 'Save Changes' : 'Add Chore'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
