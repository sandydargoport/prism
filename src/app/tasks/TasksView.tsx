'use client';

import Link from 'next/link';
import {
  CheckSquare,
  Plus,
  SortAsc,
  Home,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageWrapper } from '@/components/layout';
import { TaskItem } from '@/app/tasks/TaskItem';
import { TaskModal } from '@/app/tasks/TaskModal';
import { useTasksViewData } from './useTasksViewData';

export function TasksView() {
  const {
    loading, error, refreshTasks, familyMembers,
    filterPerson, setFilterPerson,
    filterPriority, setFilterPriority,
    filterCompleted, setFilterCompleted,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingTask, setEditingTask,
    filteredTasks,
    toggleTask, editTask, deleteTask, handleAddClick,
    completedCount, totalCount,
  } = useTasksViewData();

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link href="/" aria-label="Back to dashboard"><Home className="h-5 w-5" /></Link>
              </Button>
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Tasks</h1>
                <Badge variant="secondary">{completedCount}/{totalCount}</Badge>
              </div>
            </div>
            <Button onClick={handleAddClick}>
              <Plus className="h-4 w-4 mr-1" />Add Task
            </Button>
          </div>
        </header>

        <div className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-2">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Person:</span>
              <div className="flex gap-1">
                <Button variant={filterPerson === null ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterPerson(null)}>All</Button>
                {familyMembers.map((member) => (
                  <Button key={member.id} variant={filterPerson === member.id ? 'secondary' : 'ghost'} size="sm"
                    onClick={() => setFilterPerson(member.id)} className="gap-1">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: member.color }} />
                    {member.name}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Priority:</span>
              <div className="flex gap-1">
                <Button variant={filterPriority === null ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterPriority(null)}>All</Button>
                {['high', 'medium', 'low'].map((priority) => (
                  <Button key={priority} variant={filterPriority === priority ? 'secondary' : 'ghost'} size="sm"
                    onClick={() => setFilterPriority(priority)} className="capitalize">{priority}</Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Status:</span>
              <div className="flex gap-1">
                <Button variant={filterCompleted === null ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterCompleted(null)}>All</Button>
                <Button variant={filterCompleted === false ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterCompleted(false)}>Active</Button>
                <Button variant={filterCompleted === true ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterCompleted(true)}>Completed</Button>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <SortAsc className="h-4 w-4 text-muted-foreground" />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="text-sm bg-card text-foreground border border-border rounded px-2 py-1 [&>option]:bg-card [&>option]:text-foreground">
                <option value="dueDate">Due Date</option>
                <option value="priority">Priority</option>
                <option value="title">Title</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Clock className="h-12 w-12 mb-4 opacity-50 animate-pulse" /><p>Loading tasks...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-destructive">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" /><p>{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => refreshTasks()}>Try Again</Button>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <CheckSquare className="h-12 w-12 mb-4 opacity-50" /><p>No tasks found</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowAddModal(true)}>Add your first task</Button>
            </div>
          ) : (
            <div className="space-y-2 max-w-4xl mx-auto">
              {filteredTasks.map((task) => (
                <TaskItem key={task.id} task={task}
                  onToggle={() => toggleTask(task.id)}
                  onEdit={() => editTask(task)}
                  onDelete={() => deleteTask(task.id)} />
              ))}
            </div>
          )}
        </div>

        {showAddModal && (
          <TaskModal
            onClose={() => setShowAddModal(false)}
            onSave={async (task) => {
              try {
                const response = await fetch('/api/tasks', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: task.title, description: task.description, priority: task.priority,
                    category: task.category, assignedTo: task.assignedTo?.id, dueDate: task.dueDate?.toISOString(),
                  }),
                });
                if (!response.ok) throw new Error('Failed to create task');
                refreshTasks();
                setShowAddModal(false);
              } catch (err) {
                console.error('Error creating task:', err);
                alert('Failed to create task');
              }
            }}
            familyMembers={familyMembers}
          />
        )}

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
                    title: updatedTask.title, description: updatedTask.description, priority: updatedTask.priority,
                    category: updatedTask.category, assignedTo: updatedTask.assignedTo?.id,
                    dueDate: updatedTask.dueDate?.toISOString(), completed: updatedTask.completed,
                  }),
                });
                if (!response.ok) throw new Error('Failed to update task');
                refreshTasks();
                setEditingTask(null);
              } catch (err) {
                console.error('Error updating task:', err);
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
