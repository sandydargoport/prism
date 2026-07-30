'use client';

import * as React from 'react';
import { useState } from 'react';
import { DAYS_SHORT_ARRAY, DAYS_LONG_ARRAY } from '@/lib/constants/days';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getCategoryEmoji } from '@/app/chores/ChoreItem';
import type { Chore, FamilyMember } from '@/types';

export function ChoreModal({
  chore,
  onClose,
  onSave,
  onDelete,
  onToggleEnabled,
  familyMembers,
  defaultAssignedTo,
}: {
  chore?: Chore;
  onClose: () => void;
  onSave: (chore: Omit<Chore, 'id' | 'createdAt'>) => void;
  onDelete?: () => void;
  onToggleEnabled?: () => void;
  familyMembers: FamilyMember[];
  /** Assignee to preselect for a brand-new chore (e.g. whoever is adding it),
   *  so it lands in their group instead of "Unassigned" by default. Ignored
   *  when editing an existing chore, which always keeps its own assignee. */
  defaultAssignedTo?: string;
}) {
  const [title, setTitle] = useState(chore?.title || '');
  const [description, setDescription] = useState(chore?.description || '');
  const [category, setCategory] = useState<Chore['category']>(chore?.category || 'cleaning');
  const [frequency, setFrequency] = useState<Chore['frequency']>(chore?.frequency || 'weekly');
  const [startDay, setStartDay] = useState(chore?.startDay || '');
  const [pointValue, setPointValue] = useState(chore?.pointValue || 5);
  const [requiresApproval, setRequiresApproval] = useState(chore?.requiresApproval || false);
  const [enabled, setEnabled] = useState(chore?.enabled ?? true);
  const [assignedTo, setAssignedTo] = useState(chore?.assignedTo?.id || defaultAssignedTo || '');
  const [nextDue, setNextDue] = useState<string>(chore?.nextDue || '');
  const [nextDueTime, setNextDueTime] = useState<string>(chore?.nextDueTime || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedMember = familyMembers.find((m) => m.id === assignedTo);

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      frequency,
      startDay: startDay || undefined,
      pointValue,
      requiresApproval,
      assignedTo: selectedMember || undefined,
      enabled,
      lastCompleted: chore?.lastCompleted,
      // Allow explicit clearing: empty input → null/undefined, not fallback to old value.
      nextDue: nextDue || undefined,
      nextDueTime: nextDueTime || null,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{chore ? 'Edit Chore' : 'Add Chore'}</DialogTitle>
        </DialogHeader>

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

          {/* Start Day / Reset Day */}
          {(['weekly', 'biweekly'].includes(frequency)) && (
            <div>
              <label className="text-sm font-medium">Reset Day</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {DAYS_SHORT_ARRAY.map((day, idx) => (
                  <Button
                    key={day}
                    type="button"
                    variant={startDay === String(idx) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStartDay(startDay === String(idx) ? '' : String(idx))}
                  >
                    {day}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {startDay ? `Resets every ${DAYS_LONG_ARRAY[parseInt(startDay)]}` : 'Defaults to Sunday'}
              </p>
            </div>
          )}

          {(['monthly', 'quarterly', 'semi-annually'].includes(frequency)) && (
            <div>
              <label className="text-sm font-medium">Reset Day of Month</label>
              <Input
                type="number"
                value={startDay || '1'}
                onChange={(e) => setStartDay(e.target.value)}
                min="1"
                max="28"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Day of the month the chore resets (1-28)</p>
            </div>
          )}

          {frequency === 'annually' && (
            <div>
              <label className="text-sm font-medium">Reset Date (MM-DD)</label>
              <Input
                value={startDay || ''}
                onChange={(e) => setStartDay(e.target.value)}
                placeholder="03-15"
                pattern="\d{2}-\d{2}"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Month and day the chore resets (e.g., 03-15 for March 15)</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Due Time</label>
              <Input
                type="time"
                value={nextDueTime}
                onChange={(e) => setNextDueTime(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">Optional. Reminder only.</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Points</label>
            <Input
              type="number"
              value={pointValue}
              onChange={(e) => setPointValue(parseInt(e.target.value) || 0)}
              min="0"
              max="1000"
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={requiresApproval}
              onCheckedChange={setRequiresApproval}
            />
            <label className="text-sm font-medium">Requires approval</label>
          </div>

          {chore && (
            <div className="flex items-center gap-2">
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <label className="text-sm font-medium">
                {enabled ? 'Enabled' : 'Disabled'}
              </label>
            </div>
          )}

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

          <div className="flex items-center gap-2 pt-4">
            {chore && onDelete && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {chore ? 'Save Changes' : 'Add Chore'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
