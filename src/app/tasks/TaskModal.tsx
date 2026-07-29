'use client';

import * as React from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Task, FamilyMember } from '@/types';

interface TaskList {
  id: string;
  name: string;
  color?: string | null;
}

export function TaskModal({
  task,
  onClose,
  onSave,
  familyMembers,
  taskLists = [],
  defaultListId,
}: {
  task?: Task;
  onClose: () => void;
  // dueDate may be `null` to signal explicit clearing (server distinguishes
  // null = clear from undefined = leave untouched).
  onSave: (task: Omit<Task, 'id' | 'dueDate'> & { dueDate: Date | null; listId?: string }) => void;
  familyMembers: FamilyMember[];
  taskLists?: TaskList[];
  defaultListId?: string | null;
}) {
  const [title, setTitle] = useState(task?.title || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(task?.priority || 'medium');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo?.id || '');
  const [category, setCategory] = useState(task?.category || '');
  const [listId, setListId] = useState((task as Task & { listId?: string })?.listId || defaultListId || '');
  // dueDate is stored as a full timestamp; split for the form into a date
  // (yyyy-MM-dd) and a time (HH:mm). We treat 23:59 as the "no time" sentinel.
  const initialDue = task?.dueDate ? new Date(task.dueDate) : null;
  const [dueDate, setDueDate] = useState<string>(
    initialDue
      ? `${initialDue.getFullYear()}-${String(initialDue.getMonth() + 1).padStart(2, '0')}-${String(initialDue.getDate()).padStart(2, '0')}`
      : ''
  );
  const [dueTime, setDueTime] = useState<string>(
    initialDue && !(initialDue.getHours() === 23 && initialDue.getMinutes() >= 58)
      ? `${String(initialDue.getHours()).padStart(2, '0')}:${String(initialDue.getMinutes()).padStart(2, '0')}`
      : ''
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedMember = familyMembers.find((m) => m.id === assignedTo);

    let combinedDue: Date | undefined;
    if (dueDate) {
      const [yy, mm, dd] = dueDate.split('-').map(Number);
      const [hh, mi] = (dueTime || '23:59').split(':').map(Number);
      combinedDue = new Date(yy!, (mm || 1) - 1, dd || 1, hh ?? 23, mi ?? 59, 0, 0);
    }

    onSave({
      title: title.trim(),
      priority,
      category: category.trim() || undefined,
      assignedTo: selectedMember || undefined,
      completed: task?.completed || false,
      // null = user cleared the field; Date = user set it. Don't fall back to
      // task?.dueDate or clearing becomes impossible.
      dueDate: combinedDue ?? null,
      listId: listId || undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Add Task'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              autoFocus
            />
          </div>

          <div>
            <label className="text-sm font-medium">Priority</label>
            <div className="flex gap-2 mt-1">
              {(['high', 'medium', 'low'] as const).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={priority === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPriority(p)}
                  className="capitalize"
                >
                  {p}
                </Button>
              ))}
            </div>
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Due Date</label>
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Due Time</label>
              <Input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="mt-1"
                disabled={!dueDate}
              />
              <p className="text-xs text-muted-foreground mt-1">Optional.</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Category</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Errands, School, Home..."
            />
          </div>

          {taskLists.length > 0 && (
            <div>
              <label className="text-sm font-medium">List</label>
              <div className="flex gap-2 mt-1 flex-wrap">
                <Button
                  type="button"
                  variant={!listId ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setListId('')}
                >
                  No List
                </Button>
                {taskLists.map((list) => (
                  <Button
                    key={list.id}
                    type="button"
                    variant={listId === list.id ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setListId(list.id)}
                    className="gap-1"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: list.color || '#6B7280' }}
                    />
                    {list.name}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {task ? 'Save Changes' : 'Add Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
