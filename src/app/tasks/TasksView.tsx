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
import {
  CheckSquare,
  Plus,
  SortAsc,
  Home,
  AlertCircle,
  Settings,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/avatar';
import { PageWrapper } from '@/components/layout';
import { useAuth } from '@/components/providers';
import { useTasks } from '@/lib/hooks';
import { TaskItem } from '@/app/tasks/TaskItem';
import { TaskModal } from '@/app/tasks/TaskModal';
import type { Task, FamilyMember } from '@/types';



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

    if (filterPerson) {
      result = result.filter((task) => task.assignedTo?.id === filterPerson);
    }

    if (filterPriority) {
      result = result.filter((task) => task.priority === filterPriority);
    }

    if (filterCompleted !== null) {
      result = result.filter((task) => task.completed === filterCompleted);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'dueDate':
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case 'priority':
          const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
          return (priorityOrder[a.priority ?? 'low'] ?? 2) - (priorityOrder[b.priority ?? 'low'] ?? 2);
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

    const user = await requireAuth("Who's completing this task?");
    if (!user) return;

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
        {/* HEADER */}
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
        <div className="flex items-center justify-between">
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

          <div className="flex items-center gap-2">
            <Button onClick={async () => {
              const user = await requireAuth("Who's adding a task?");
              if (user) setShowAddModal(true);
            }}>
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>

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

            <Button variant="ghost" size="icon" onClick={() => router.push('/settings')}>
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* FILTERS */}
      <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center gap-4 flex-wrap">
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

      {/* TASK LIST */}
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

      {/* Add Task Modal */}
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
