'use client';

import * as React from 'react';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  onSave: (task: Omit<Task, 'id'> & { listId?: string }) => void;
  familyMembers: FamilyMember[];
  taskLists?: TaskList[];
  defaultListId?: string | null;
}) {
  const [title, setTitle] = useState(task?.title || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(task?.priority || 'medium');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo?.id || '');
  const [category, setCategory] = useState(task?.category || '');
  const [listId, setListId] = useState((task as Task & { listId?: string })?.listId || defaultListId || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const selectedMember = familyMembers.find((m) => m.id === assignedTo);

    onSave({
      title: title.trim(),
      priority,
      category: category.trim() || undefined,
      assignedTo: selectedMember || undefined,
      completed: task?.completed || false,
      dueDate: task?.dueDate,
      listId: listId || undefined,
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
            {task ? 'Edit Task' : 'Add Task'}
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
      </div>
    </div>
  );
}
