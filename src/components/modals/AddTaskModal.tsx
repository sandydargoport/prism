/**
 *
 * A modal dialog for creating new tasks.
 * Includes form fields for title, description, assignee, due date, and priority.
 *
 * USAGE:
 *   <AddTaskModal
 *     open={isOpen}
 *     onOpenChange={setIsOpen}
 *     onTaskCreated={(task) => console.log('Created:', task)}
 *   />
 *
 */

'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';
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
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UserAvatar,
} from '@/components/ui';
import { useFamily } from '@/components/providers';

/**
 * Task data returned after creation
 */
export interface CreatedTask {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: 'high' | 'medium' | 'low' | null;
  assignedTo: {
    id: string;
    name: string;
    color: string;
  } | null;
}

/**
 * AddTaskModal Props
 */
export interface AddTaskModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when task is successfully created */
  onTaskCreated?: (task: CreatedTask) => void;
  /** Pre-select an assignee */
  defaultAssignee?: string;
}

/**
 * ADD TASK MODAL COMPONENT
 */
export function AddTaskModal({
  open,
  onOpenChange,
  onTaskCreated,
  defaultAssignee,
}: AddTaskModalProps) {
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState<string>(defaultAssignee || '');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<string>('');

  // Loading/error state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Family members from context
  const { members: familyMembers, loading: loadingMembers } = useFamily();

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setTitle('');
      setDescription('');
      setAssignedTo(defaultAssignee || '');
      setDueDate('');
      setPriority('');
      setError(null);
    }
  }, [open, defaultAssignee]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validate
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null,
          assignedTo: assignedTo || null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          priority: priority || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create task');
      }

      const task = await response.json();

      // Notify parent
      onTaskCreated?.(task);

      // Close modal
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
          <DialogDescription>
            Create a new task for your family.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Pick up groceries..."
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={2}
            />
          </div>

          {/* Assign To */}
          <div className="space-y-2">
            <Label htmlFor="assignedTo">Assign To</Label>
            <Select value={assignedTo || '_unassigned'} onValueChange={(v) => setAssignedTo(v === '_unassigned' ? '' : v)}>
              <SelectTrigger id="assignedTo">
                <SelectValue placeholder={loadingMembers ? 'Loading...' : 'Select person'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_unassigned">
                  <span className="text-muted-foreground">Unassigned</span>
                </SelectItem>
                {familyMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <UserAvatar
                        name={member.name}
                        color={member.color}
                        imageUrl={member.avatarUrl || undefined}
                        size="sm"
                        className="h-5 w-5 text-[10px]"
                      />
                      <span>{member.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label htmlFor="dueDate">Due Date</Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={format(new Date(), 'yyyy-MM-dd')}
            />
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority || '_none'} onValueChange={(v) => setPriority(v === '_none' ? '' : v)}>
              <SelectTrigger id="priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">
                  <span className="text-muted-foreground">None</span>
                </SelectItem>
                <SelectItem value="high">
                  <span className="text-red-500 font-medium">High</span>
                </SelectItem>
                <SelectItem value="medium">
                  <span className="text-yellow-500 font-medium">Medium</span>
                </SelectItem>
                <SelectItem value="low">
                  <span className="text-green-500 font-medium">Low</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error message */}
          {error && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          {/* Actions */}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Add Task'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
