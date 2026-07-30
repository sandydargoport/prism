'use client';

import { CheckSquare, AlertCircle, List } from 'lucide-react';
import { UserAvatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { PageLoader } from '@/components/ui/spinner';
import { TaskRow } from '@/app/tasks/TaskRow';
import { GroupedTaskGrid } from '@/app/tasks/GroupedTaskGrid';
import { NestedGroupedTaskGrid } from '@/app/tasks/NestedGroupedTaskGrid';
import type { Task } from '@/types';
import type { GroupMode } from '@/app/tasks/taskGroupTypes';

interface TaskContentAreaProps {
  loading: boolean;
  error: string | null;
  filteredTasks: Task[];
  groupMode: GroupMode;
  tasksByUser: { user: { id: string; name: string; color: string } | null; tasks: Task[] }[] | null;
  tasksByList: { list: { id: string; name: string; color: string } | null; tasks: Task[] }[] | null;
  tasksByPersonThenList: { member: { id: string; name: string; color: string } | null; tasks: Task[]; subGroups: { key: string; label: string; color: string; tasks: Task[] }[] }[] | null;
  tasksByListThenPerson: { list: { id: string; name: string; color: string } | null; tasks: Task[]; subGroups: { key: string; label: string; color: string; tasks: Task[] }[] }[] | null;
  inlineTask: string;
  setInlineTask: (v: string) => void;
  inlineTaskByUser: Record<string, string>;
  setInlineTaskByUser: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  inlineTaskByList: Record<string, string>;
  setInlineTaskByList: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  handleInlineAdd: (assignedTo?: string, listId?: string) => void;
  toggleTask: (id: string) => Promise<boolean>;
  editTask: (task: Task) => void;
  setCelebratingUser: (user: { id: string; name: string } | null) => void;
  taskLists: Array<{ id: string; name: string; color?: string | null }>;
  isMobile: boolean;
  refreshTasks: () => void;
  handleAddWithAuth: () => void;
}

export function TaskContentArea({
  loading,
  error,
  filteredTasks,
  groupMode,
  tasksByUser,
  tasksByList,
  tasksByPersonThenList,
  tasksByListThenPerson,
  inlineTask,
  setInlineTask,
  inlineTaskByUser,
  setInlineTaskByUser,
  inlineTaskByList,
  setInlineTaskByList,
  handleInlineAdd,
  toggleTask,
  editTask,
  setCelebratingUser,
  taskLists,
  isMobile,
  refreshTasks,
  handleAddWithAuth,
}: TaskContentAreaProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <PageLoader label="Loading tasks..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertCircle className="h-12 w-12 mb-4 opacity-50" /><p>{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refreshTasks()}>Try Again</Button>
      </div>
    );
  }

  const isPersonGrouped = (groupMode === 'person' && !!tasksByUser?.length) ||
    (groupMode === 'person_then_list' && !!tasksByPersonThenList?.length);
  if (filteredTasks.length === 0 && !isPersonGrouped) {
    return (
      <div className="flex items-center justify-center h-full">
        <EmptyState
          icon={<CheckSquare />}
          title="No tasks found"
          action={<Button variant="outline" size="sm" onClick={handleAddWithAuth}>Add your first task</Button>}
        />
      </div>
    );
  }

  if (groupMode === 'person' && tasksByUser) {
    return (
      <GroupedTaskGrid
        groups={tasksByUser.map(({ user, tasks }) => ({
          key: user?.id || 'unassigned',
          label: user?.name || 'Unassigned',
          color: user?.color || '#6B7280',
          avatar: user ? <UserAvatar name={user.name} color={user.color} size="sm" className="h-7 w-7" /> : <CheckSquare className="h-5 w-5 text-muted-foreground" />,
          tasks,
          inlineValue: user ? (inlineTaskByUser[user.id] || '') : inlineTask,
          onInlineChange: (v) => user ? setInlineTaskByUser(prev => ({ ...prev, [user.id]: v })) : setInlineTask(v),
          onInlineSubmit: () => handleInlineAdd(user?.id),
          celebrationTarget: user ? { id: user.id, name: user.name } : undefined,
        }))}
        toggleTask={toggleTask}
        editTask={editTask}
        setCelebratingUser={setCelebratingUser}
        taskLists={taskLists}
        isMobile={isMobile}
      />
    );
  }

  if (groupMode === 'list' && tasksByList) {
    return (
      <GroupedTaskGrid
        groups={tasksByList.map(({ list, tasks }) => ({
          key: list?.id || 'no-list',
          label: list?.name || 'No List',
          color: list?.color || '#6B7280',
          avatar: <List className="h-5 w-5" style={{ color: list?.color || '#6B7280' }} />,
          tasks,
          inlineValue: list ? (inlineTaskByList[list.id] || '') : inlineTask,
          onInlineChange: (v) => list ? setInlineTaskByList(prev => ({ ...prev, [list.id]: v })) : setInlineTask(v),
          onInlineSubmit: () => handleInlineAdd(undefined, list?.id),
        }))}
        toggleTask={toggleTask}
        editTask={editTask}
        setCelebratingUser={setCelebratingUser}
        taskLists={taskLists}
        isMobile={isMobile}
      />
    );
  }

  if (groupMode === 'person_then_list' && tasksByPersonThenList) {
    return (
      <NestedGroupedTaskGrid
        primaryGroups={tasksByPersonThenList.map(({ member, tasks, subGroups }) => ({
          key: member?.id || 'unassigned',
          label: member?.name || 'Unassigned',
          color: member?.color || '#6B7280',
          avatar: member
            ? <UserAvatar name={member.name} color={member.color} size="sm" className="h-7 w-7" />
            : <CheckSquare className="h-5 w-5 text-muted-foreground" />,
          tasks,
          subGroups,
          inlineValue: member ? (inlineTaskByUser[member.id] || '') : inlineTask,
          onInlineChange: (v) => member ? setInlineTaskByUser(prev => ({ ...prev, [member.id]: v })) : setInlineTask(v),
          onInlineSubmit: () => handleInlineAdd(member?.id),
          celebrationTarget: member ? { id: member.id, name: member.name } : undefined,
        }))}
        toggleTask={toggleTask}
        editTask={editTask}
        setCelebratingUser={setCelebratingUser}
        isMobile={isMobile}
      />
    );
  }

  if (groupMode === 'list_then_person' && tasksByListThenPerson) {
    return (
      <NestedGroupedTaskGrid
        primaryGroups={tasksByListThenPerson.map(({ list, tasks, subGroups }) => ({
          key: list?.id || 'no-list',
          label: list?.name || 'No List',
          color: list?.color || '#6B7280',
          avatar: <List className="h-5 w-5" style={{ color: list?.color || '#6B7280' }} />,
          tasks,
          subGroups,
          inlineValue: list ? (inlineTaskByList[list.id] || '') : inlineTask,
          onInlineChange: (v) => list ? setInlineTaskByList(prev => ({ ...prev, [list.id]: v })) : setInlineTask(v),
          onInlineSubmit: () => handleInlineAdd(undefined, list?.id),
        }))}
        toggleTask={toggleTask}
        editTask={editTask}
        setCelebratingUser={setCelebratingUser}
        isMobile={isMobile}
      />
    );
  }

  // Flat (no grouping) view
  return (
    <div className="space-y-1 max-w-4xl mx-auto">
      <Input
        placeholder="Add a task..."
        value={inlineTask}
        onChange={(e) => setInlineTask(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleInlineAdd();
          }
        }}
        className="h-9 mb-2"
      />
      {filteredTasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggle={() => toggleTask(task.id)}
          onEdit={() => editTask(task)}
          showAvatar={true}
          showList={true}
          taskLists={taskLists}
        />
      ))}
    </div>
  );
}
