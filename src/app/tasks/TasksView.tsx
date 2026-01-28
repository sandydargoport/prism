/**
 * ============================================================================
 * PRISM - Tasks View Component
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * The main interactive tasks view with filtering, sorting, and task management.
 *
 * FEATURES:
 * - Task list with checkboxes
 * - Filter by person, priority, completion status
 * - Sort by due date, priority, title
 * - Add new task modal
 * - Inline editing
 *
 * ============================================================================
 */

'use client';

import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { format, isToday, isTomorrow, isPast, addDays } from 'date-fns';
import {
  CheckSquare,
  Plus,
  SortAsc,
  Home,
  AlertCircle,
  Trash2,
  Edit2,
  X,
  Settings,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { PageWrapper } from '@/components/layout';
import { useAuth } from '@/components/providers';
import { useTasks } from '@/lib/hooks';


/**
 * TASK INTERFACE
 */
interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  dueDate?: Date;
  priority: 'high' | 'medium' | 'low';
  category?: string;
  assignedTo?: {
    id: string;
    name: string;
    color: string;
  };
}


/**
 * FAMILY MEMBER TYPE
 */
interface FamilyMember {
  id: string;
  name: string;
  color: string;
}



/**
 * TASKS VIEW COMPONENT
 */
export function TasksView() {
  const router = useRouter();
  const { activeUser, requireAuth, clearActiveUser } = useAuth();

  // Fetch tasks from API using the hook
  const {
    tasks: apiTasks,
    loading: tasksLoading,
    error: tasksError,
    refresh: refreshTasks,
    toggleTask: apiToggleTask,
  } = useTasks({ showCompleted: true, limit: 100 });

  // Local state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [filterCompleted, setFilterCompleted] = useState<boolean | null>(false);
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'title'>('dueDate');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Sync API tasks to local state
  useEffect(() => {
    if (apiTasks.length > 0) {
      setTasks(apiTasks.map(t => ({
        ...t,
        dueDate: t.dueDate instanceof Date ? t.dueDate : (t.dueDate ? new Date(t.dueDate) : undefined),
      })));
    }
  }, [apiTasks]);

  // Fetch family members from API
  useEffect(() => {
    async function fetchFamilyMembers() {
      try {
        const response = await fetch('/api/family');
        if (response.ok) {
          const data = await response.json();
          setFamilyMembers(data.members.map((m: { id: string; name: string; color: string }) => ({
            id: m.id,
            name: m.name,
            color: m.color,
          })));
        }
      } catch (error) {
        console.error('Failed to fetch family members:', error);
      }
    }
    fetchFamilyMembers();
  }, []);

  // Filter and sort tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Apply filters
    if (filterPerson) {
      result = result.filter((task) => task.assignedTo?.id === filterPerson);
    }

    if (filterPriority) {
      result = result.filter((task) => task.priority === filterPriority);
    }

    if (filterCompleted !== null) {
      result = result.filter((task) => task.completed === filterCompleted);
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.getTime() - b.dueDate.getTime();
        case 'priority':
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return result;
  }, [tasks, filterPerson, filterPriority, filterCompleted, sortBy]);

  // Toggle task completion - requires auth and ownership
  const toggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Require authentication
    const user = await requireAuth("Who's completing this task?");
    if (!user) return;

    // Check ownership - parents can complete any task, others can only complete their own or unassigned tasks
    const isParent = user.role === 'parent';
    const isAssignedToUser = !task.assignedTo || task.assignedTo.id === user.id;

    if (!isParent && !isAssignedToUser) {
      alert(`This task is assigned to ${task.assignedTo?.name}. Only they can mark it complete.`);
      return;
    }

    try {
      await apiToggleTask(taskId, !task.completed);
    } catch (error) {
      console.error('Error toggling task:', error);
      alert('Failed to update task');
    }
  };

  // Edit task - requires auth and parent role
  const editTask = async (task: Task) => {
    const user = await requireAuth("Who's editing this task?");
    if (!user) return;

    // Only parents can edit tasks
    if (user.role !== 'parent') {
      alert('Only parents can edit tasks.');
      return;
    }

    setEditingTask(task);
  };

  // Delete task - requires auth and parent role
  const deleteTask = async (taskId: string) => {
    const user = await requireAuth("Who's deleting this task?");
    if (!user) return;

    // Only parents can delete tasks
    if (user.role !== 'parent') {
      alert('Only parents can delete tasks.');
      return;
    }

    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }

    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      // Refresh to get updated state
      refreshTasks();
    } catch (error) {
      console.error('Error deleting task:', error);
      alert('Failed to delete task');
    }
  };

  // Task counts
  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        {/* ================================================================ */}
        {/* HEADER */}
        {/* ================================================================ */}
        <header className="flex-shrink-0 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Back and title */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/" aria-label="Back to dashboard">
                <Home className="h-5 w-5" />
              </Link>
            </Button>

            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <h1 className="text-xl font-bold">Tasks</h1>
              <Badge variant="secondary">
                {completedCount}/{totalCount}
              </Badge>
            </div>
          </div>

          {/* Right: Add button, user avatar, settings */}
          <div className="flex items-center gap-2">
            <Button onClick={async () => {
              const user = await requireAuth("Who's adding a task?");
              if (user) setShowAddModal(true);
            }}>
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>

            {/* User avatar */}
            <button
              onClick={activeUser ? clearActiveUser : () => requireAuth()}
              className="flex items-center gap-2 p-1.5 rounded-full hover:bg-accent transition-colors"
              aria-label={activeUser ? 'Log out' : 'Log in'}
            >
              {activeUser ? (
                <UserAvatar
                  name={activeUser.name}
                  color={activeUser.color}
                  size="sm"
                  className="h-8 w-8"
                />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted border-2 border-dashed border-muted-foreground/50">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground">
                    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </button>

            {/* Settings */}
            <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* FILTERS */}
      {/* ================================================================== */}
      <div className="flex-shrink-0 border-b border-border bg-card/50 px-4 py-2">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Filter by person */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Person:</span>
            <div className="flex gap-1">
              <Button
                variant={filterPerson === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterPerson(null)}
              >
                All
              </Button>
              {familyMembers.map((member) => (
                <Button
                  key={member.id}
                  variant={filterPerson === member.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterPerson(member.id)}
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

          {/* Filter by priority */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Priority:</span>
            <div className="flex gap-1">
              <Button
                variant={filterPriority === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterPriority(null)}
              >
                All
              </Button>
              {['high', 'medium', 'low'].map((priority) => (
                <Button
                  key={priority}
                  variant={filterPriority === priority ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setFilterPriority(priority)}
                  className="capitalize"
                >
                  {priority}
                </Button>
              ))}
            </div>
          </div>

          {/* Filter by completion */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <div className="flex gap-1">
              <Button
                variant={filterCompleted === null ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterCompleted(null)}
              >
                All
              </Button>
              <Button
                variant={filterCompleted === false ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterCompleted(false)}
              >
                Active
              </Button>
              <Button
                variant={filterCompleted === true ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterCompleted(true)}
              >
                Completed
              </Button>
            </div>
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2 ml-auto">
            <SortAsc className="h-4 w-4 text-muted-foreground" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'dueDate' | 'priority' | 'title')}
              className="text-sm bg-transparent border border-border rounded px-2 py-1"
            >
              <option value="dueDate">Due Date</option>
              <option value="priority">Priority</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>
      </div>

      {/* ================================================================== */}
      {/* TASK LIST */}
      {/* ================================================================== */}
      <div className="flex-1 overflow-y-auto p-4">
        {tasksLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Clock className="h-12 w-12 mb-4 opacity-50 animate-pulse" />
            <p>Loading tasks...</p>
          </div>
        ) : tasksError ? (
          <div className="flex flex-col items-center justify-center h-full text-destructive">
            <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
            <p>{tasksError}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => refreshTasks()}
            >
              Try Again
            </Button>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <CheckSquare className="h-12 w-12 mb-4 opacity-50" />
            <p>No tasks found</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setShowAddModal(true)}
            >
              Add your first task
            </Button>
          </div>
        ) : (
          <div className="space-y-2 max-w-4xl mx-auto">
            {filteredTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() => toggleTask(task.id)}
                onEdit={() => editTask(task)}
                onDelete={() => deleteTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Task Modal (simplified) */}
      {showAddModal && (
        <TaskModal
          onClose={() => setShowAddModal(false)}
          onSave={async (task) => {
            try {
              const response = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: task.title,
                  description: task.description,
                  priority: task.priority,
                  category: task.category,
                  assignedTo: task.assignedTo?.id,
                  dueDate: task.dueDate?.toISOString(),
                }),
              });
              if (!response.ok) throw new Error('Failed to create task');
              refreshTasks();
              setShowAddModal(false);
            } catch (error) {
              console.error('Error creating task:', error);
              alert('Failed to create task');
            }
          }}
          familyMembers={familyMembers}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSave={async (updatedTask) => {
            try {
              const response = await fetch(`/api/tasks/${editingTask.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: updatedTask.title,
                  description: updatedTask.description,
                  priority: updatedTask.priority,
                  category: updatedTask.category,
                  assignedTo: updatedTask.assignedTo?.id,
                  dueDate: updatedTask.dueDate?.toISOString(),
                  completed: updatedTask.completed,
                }),
              });
              if (!response.ok) throw new Error('Failed to update task');
              refreshTasks();
              setEditingTask(null);
            } catch (error) {
              console.error('Error updating task:', error);
              alert('Failed to update task');
            }
          }}
          familyMembers={familyMembers}
        />
      )}
      </div>
    </PageWrapper>
  );
}


/**
 * TASK ITEM COMPONENT
 */
function TaskItem({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isOverdue = task.dueDate && isPast(task.dueDate) && !task.completed;

  const formatDueDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM d');
  };

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg border border-border',
        'hover:bg-accent/30 transition-colors',
        task.completed && 'opacity-60 bg-muted/30'
      )}
    >
      {/* Checkbox */}
      <Checkbox
        checked={task.completed}
        onCheckedChange={onToggle}
        className="flex-shrink-0"
        style={task.assignedTo ? { borderColor: task.assignedTo.color } : undefined}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'font-medium',
              task.completed && 'line-through text-muted-foreground'
            )}
          >
            {task.title}
          </span>

          {task.priority === 'high' && (
            <Badge variant="destructive" className="text-xs">
              High
            </Badge>
          )}

          {task.category && (
            <Badge variant="outline" className="text-xs">
              {task.category}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          {task.assignedTo && (
            <div className="flex items-center gap-1">
              <UserAvatar
                name={task.assignedTo.name}
                color={task.assignedTo.color}
                size="sm"
                className="h-4 w-4 text-[8px]"
              />
              <span>{task.assignedTo.name}</span>
            </div>
          )}

          {task.dueDate && (
            <span className={cn(isOverdue && 'text-destructive font-medium')}>
              {isOverdue && <AlertCircle className="h-3 w-3 inline mr-1" />}
              {formatDueDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8"
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}


/**
 * TASK MODAL COMPONENT
 */
function TaskModal({
  task,
  onClose,
  onSave,
  familyMembers,
}: {
  task?: Task;
  onClose: () => void;
  onSave: (task: Omit<Task, 'id'>) => void;
  familyMembers: FamilyMember[];
}) {
  const [title, setTitle] = useState(task?.title || '');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(task?.priority || 'medium');
  const [assignedTo, setAssignedTo] = useState(task?.assignedTo?.id || '');
  const [category, setCategory] = useState(task?.category || '');

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
    });
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-lg"
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
