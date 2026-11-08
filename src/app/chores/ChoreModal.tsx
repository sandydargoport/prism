'use client';

import * as React from 'react';
import { useState } from 'react';
import { DAYS_SHORT_ARRAY, DAYS_LONG_ARRAY } from '@/lib/constants/days';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
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
import { usePets } from '@/lib/hooks/usePets';

export function ChoreModal({
  chore,
  onClose,
  onSave,
  onDelete,
  onToggleEnabled,
  familyMembers,
  defaultAssignedTo,
  kind: newKind = 'chore',
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
  /** What a brand-new item is (#1109); an existing one keeps its own. */
  kind?: 'chore' | 'reminder';
}) {
  const kind = chore?.kind ?? newKind;
  const isReminder = kind === 'reminder';
  const [title, setTitle] = useState(chore?.title || '');
  const [description, setDescription] = useState(chore?.description || '');
  const [category, setCategory] = useState<Chore['category']>(chore?.category || 'cleaning');
  const [frequency, setFrequency] = useState<Chore['frequency']>(chore?.frequency || (isReminder ? 'daily' : 'weekly'));
  const [startDay, setStartDay] = useState(chore?.startDay || '');
  const [pointValue, setPointValue] = useState(chore?.pointValue || 5);
  const [requiresApproval, setRequiresApproval] = useState(chore?.requiresApproval ?? true);
  const [enabled, setEnabled] = useState(chore?.enabled ?? true);
  const [assignedTo, setAssignedTo] = useState(chore?.assignedTo?.id || defaultAssignedTo || '');
  // A new reminder starts today, so it is on the list from the start.
  const [nextDue, setNextDue] = useState<string>(chore?.nextDue || (isReminder && !chore ? format(new Date(), 'yyyy-MM-dd') : ''));
  const [nextDueTime, setNextDueTime] = useState<string>(chore?.nextDueTime || '');
  const [timesPerDay, setTimesPerDay] = useState<number>(chore?.timesPerDay ?? 1);
  // Who it is for, when that is a pet (#996).
  const { pets } = usePets();
  const [petId, setPetId] = useState<string>(chore?.pet?.id ?? '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || (isReminder && !nextDueTime)) return;

    const selectedMember = familyMembers.find((m) => m.id === assignedTo);

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      category,
      frequency,
      startDay: startDay || undefined,
      // A reminder has no points or approval (#1109); the server holds to it too.
      pointValue: isReminder ? 0 : pointValue,
      requiresApproval: isReminder ? false : requiresApproval,
      kind,
      pet: petId ? { id: petId, name: '', color: '' } : null,
      assignedTo: selectedMember || undefined,
      enabled,
      lastCompleted: chore?.lastCompleted,
      // Allow explicit clearing: empty input → null/undefined, not fallback to old value.
      nextDue: nextDue || undefined,
      nextDueTime: nextDueTime || null,
      timesPerDay: frequency === 'daily' ? timesPerDay : 1,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isReminder ? (chore ? 'Edit Reminder' : 'Add Reminder') : (chore ? 'Edit Chore' : 'Add Chore')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isReminder ? 'Allergy tablet, feed the cat...' : 'Chore title...'}
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

          {/* More than once a day (#1107): feeding a pet morning and evening. */}
          {frequency === 'daily' && (
            <div>
              <label className="text-sm font-medium" id="times-a-day">Times a day</label>
              <div className="mt-1 flex gap-2" role="group" aria-labelledby="times-a-day">
                {[1, 2, 3, 4].map((n) => (
                  <Button key={n} type="button" size="sm" variant={timesPerDay === n ? 'default' : 'outline'}
                    onClick={() => setTimesPerDay(n)} aria-pressed={timesPerDay === n} data-chore-times-a-day={n}>
                    {n === 1 ? 'Once' : `${n} times`}
                  </Button>
                ))}
              </div>
            </div>
          )}

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
              <label className="text-sm font-medium" htmlFor="chore-due-time">{isReminder ? 'Time' : 'Due Time'}</label>
              <Input
                id="chore-due-time"
                type="time"
                value={nextDueTime}
                onChange={(e) => setNextDueTime(e.target.value)}
                className="mt-1"
                required={isReminder}
                data-chore-time
              />
              <p className="text-xs text-muted-foreground mt-1">{isReminder ? 'Marked late once it passes.' : 'Optional. Marked late once it passes.'}</p>
            </div>
          </div>

          {!isReminder && <>
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
          <p className="text-xs text-muted-foreground -mt-2">When off, a child&apos;s completion counts right away.</p>
          </>}

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

          {/* For a pet (#996): a person does it, the pet is who it is for. */}
          {pets.length > 0 && (
            <div>
              <label className="text-sm font-medium" id="chore-for">For</label>
              <div className="flex gap-2 mt-1 flex-wrap" role="group" aria-labelledby="chore-for">
                <Button type="button" size="sm" variant={!petId ? 'default' : 'outline'} onClick={() => setPetId('')} aria-pressed={!petId}>
                  No one
                </Button>
                {pets.map((p) => (
                  <Button key={p.id} type="button" size="sm" variant={petId === p.id ? 'default' : 'outline'}
                    onClick={() => setPetId(p.id)} aria-pressed={petId === p.id} className="gap-1" data-chore-for={p.name}>
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    {p.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

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
            <Button type="submit" disabled={!title.trim() || (isReminder && !nextDueTime)}>
              {chore ? 'Save Changes' : isReminder ? 'Add Reminder' : 'Add Chore'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
