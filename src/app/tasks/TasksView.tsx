'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  CheckSquare,
  Plus,
  SortAsc,
  Home,
  AlertCircle,
  Clock,
  RefreshCw,
  Users,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageWrapper } from '@/components/layout';
import { TaskItem } from '@/app/tasks/TaskItem';
import { TaskModal } from '@/app/tasks/TaskModal';
import { useTasksViewData } from './useTasksViewData';
import { useAuth } from '@/components/providers';

export function TasksView() {
  const { requireAuth } = useAuth();
  const {
    loading, error, refreshTasks, familyMembers,
    filterPerson, setFilterPerson,
    filterPriority, setFilterPriority,
    filterCompleted, setFilterCompleted,
    filterList, setFilterList,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingTask, setEditingTask,
    filteredTasks,
    toggleTask, editTask, deleteTask, handleAddClick,
    completedCount, totalCount,
    taskLists,
    autoSyncing,
  } = useTasksViewData();

  // Group by user toggle
  const [groupByUser, setGroupByUser] = useState(false);

  // Group tasks by assigned user
  const tasksByUser = useMemo(() => {
    if (!groupByUser) return null;

    const groups: { user: { id: string; name: string; color: string } | null; tasks: typeof filteredTasks }[] = [];

    // Group by each family member
    familyMembers.forEach((member) => {
      const userTasks = filteredTasks.filter((t) => t.assignedTo?.id === member.id);
      if (userTasks.length > 0) {
        groups.push({ user: member, tasks: userTasks });
      }
    });

    // Unassigned tasks
    const unassigned = filteredTasks.filter((t) => !t.assignedTo);
    if (unassigned.length > 0) {
      groups.push({ user: null, tasks: unassigned });
    }

    return groups;
  }, [groupByUser, filteredTasks, familyMembers]);

  const handleAddWithAuth = async () => {
    const user = await requireAuth('Add Task', 'Please log in to add a task');
    if (!user) return;
    handleAddClick();
  };

  return (
    <PageWrapper>
      <div className="h-screen flex flex-col">
        <header className="flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-3 safe-area-top">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild className="hidden md:inline-flex">
                <Link href="/" aria-label="Back to dashboard"><Home className="h-5 w-5" /></Link>
              </Button>
              <div className="flex items-center gap-2">
                <CheckSquare className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold">Tasks</h1>
                <Badge variant="secondary">{completedCount}/{totalCount}</Badge>
                {autoSyncing && (
                  <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />
                )}
              </div>
            </div>
            <Button onClick={handleAddWithAuth} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Task
            </Button>
          </div>
        </header>

        <div className="hidden md:block flex-shrink-0 border-b border-border bg-card/85 backdrop-blur-sm px-4 py-2">
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
            {taskLists.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">List:</span>
                <div className="flex gap-1 flex-wrap">
                  <Button variant={filterList === null ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterList(null)}>All</Button>
                  <Button variant={filterList === 'none' ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterList('none')}>None</Button>
                  {taskLists.map((list) => (
                    <Button key={list.id} variant={filterList === list.id ? 'secondary' : 'ghost'} size="sm"
                      onClick={() => setFilterList(list.id)} className="gap-1">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: list.color || '#6B7280' }} />
                      {list.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant={groupByUser ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setGroupByUser(!groupByUser)}
                className="gap-1"
              >
                <Users className="h-4 w-4" />
                Group by Person
              </Button>
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
              <Button variant="outline" size="sm" className="mt-4" onClick={handleAddWithAuth}>Add your first task</Button>
            </div>
          ) : groupByUser && tasksByUser ? (
            <div className="space-y-6 max-w-4xl mx-auto">
              {tasksByUser.map(({ user, tasks }) => (
                <div key={user?.id || 'unassigned'} className="space-y-2">
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-lg border-l-4"
                    style={{
                      borderLeftColor: user?.color || '#6B7280',
                      backgroundColor: (user?.color || '#6B7280') + '10',
                    }}
                  >
                    {user ? (
                      <UserAvatar name={user.name} color={user.color} size="sm" className="h-6 w-6" />
                    ) : (
                      <CheckSquare className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h3 className="font-semibold" style={{ color: user?.color || '#6B7280' }}>
                      {user?.name || 'Unassigned'}
                    </h3>
                    <Badge variant="outline" className="ml-auto">
                      {tasks.filter((t) => t.completed).length}/{tasks.length} done
                    </Badge>
                  </div>
                  <div className="space-y-2 pl-2">
                    {tasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={() => toggleTask(task.id)}
                        onEdit={() => editTask(task)}
                        onDelete={() => deleteTask(task.id)}
                        taskLists={taskLists}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2 max-w-4xl mx-auto">
              {filteredTasks.map((task) => (
                <TaskItem key={task.id} task={task}
                  onToggle={() => toggleTask(task.id)}
                  onEdit={() => editTask(task)}
                  onDelete={() => deleteTask(task.id)}
                  taskLists={taskLists} />
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
                    listId: task.listId,
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
            taskLists={taskLists}
            defaultListId={filterList}
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
                    listId: updatedTask.listId,
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
            taskLists={taskLists}
          />
        )}
      </div>
    </PageWrapper>
  );
}
