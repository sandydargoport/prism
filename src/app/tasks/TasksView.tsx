'use client';

import { useState, useMemo } from 'react';
import { toast } from '@/components/ui/use-toast';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  CheckSquare,
  Plus,
  RefreshCw,
  Users,
  List,
  X,
} from 'lucide-react';
import { PlaneCelebration } from '@/components/ui/PlaneCelebration';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageWrapper, SubpageHeader, FilterBar, SortSelect, FilterDropdown, PersonFilter, UndoButton } from '@/components/layout';
import type { OverflowItem, FilterOption } from '@/components/layout';
import { TaskModal } from '@/app/tasks/TaskModal';
import { useTasksViewData } from './useTasksViewData';
import { useAuth } from '@/components/providers';
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useTaskGrouping } from '@/app/tasks/useTaskGrouping';
import { TaskContentArea } from '@/app/tasks/TaskContentArea';
import type { GroupBy } from '@/app/tasks/taskGroupTypes';

export function TasksView() {
  const { requireAuth } = useAuth();
  const {
    loading, error, refreshTasks, familyMembers,
    filterPerson, setFilterPerson,
    filterPriority, setFilterPriority,
    showCompleted, setShowCompleted,
    filterList, setFilterList,
    sortBy, setSortBy,
    showAddModal, setShowAddModal,
    editingTask, setEditingTask,
    filteredTasks,
    toggleTask, editTask, handleAddClick,
    completedCount, totalCount,
    taskLists,
    autoSyncing,
    confirmDialogProps,
  } = useTasksViewData();

  const isMobile = useIsMobile();
  const [celebratingUser, setCelebratingUser] = useState<{ id: string; name: string } | null>(null);

  const {
    primaryGroup, setPrimaryGroup,
    secondaryGroup, setSecondaryGroup,
    groupMode,
    inlineTask, setInlineTask,
    inlineTaskByUser, setInlineTaskByUser,
    inlineTaskByList, setInlineTaskByList,
    handleInlineAdd,
    tasksByUser, tasksByList, tasksByPersonThenList, tasksByListThenPerson,
  } = useTaskGrouping({ filteredTasks, familyMembers, taskLists, filterList, filterPerson, refreshTasks, requireAuth });

  const hasActiveFilters = (filterPerson !== null && filterPerson.length > 0) || filterPriority !== null || filterList !== null;
  const clearFilters = () => { setFilterPerson(null); setFilterPriority(null); setFilterList(null); };

  const handleAddWithAuth = async () => {
    const user = await requireAuth('Add Task', 'Please log in to add a task');
    if (!user) return;
    handleAddClick();
  };

  const overflowItems: OverflowItem[] = [
    { label: 'Show Completed', checked: showCompleted, onClick: () => setShowCompleted(!showCompleted) },
  ];

  const listOptions = useMemo(() => {
    const opts = [{ value: 'none', label: 'No List' }];
    taskLists.forEach((list) => opts.push({ value: list.id, label: list.name }));
    return opts;
  }, [taskLists]);

  const primaryGroupOptions = useMemo((): FilterOption[] => {
    const opts: FilterOption[] = [{ value: 'none', label: 'None' }, { value: 'person', label: 'Person' }];
    if (taskLists.length > 0) opts.push({ value: 'list', label: 'List' });
    return opts;
  }, [taskLists]);

  const secondaryGroupOptions = useMemo((): FilterOption[] => {
    const opts: FilterOption[] = [{ value: 'none', label: 'None' }];
    if (primaryGroup !== 'person') opts.push({ value: 'person', label: 'Person' });
    if (primaryGroup !== 'list' && taskLists.length > 0) opts.push({ value: 'list', label: 'List' });
    return opts;
  }, [primaryGroup, taskLists]);

  return (
    <PageWrapper>
      {/*
        h-screen + flex-col + inner overflow-y-auto pins the SubpageHeader
        and FilterBar to the top so they don't scroll away when the user
        scrolls within a task list. Matches Chores, Shopping, Meals.
        Was `h-full` which left the page-level scroll unconstrained.
      */}
      <div className="h-screen flex flex-col">
        <SubpageHeader
          icon={<CheckSquare className="h-5 w-5 text-primary" />}
          title="Tasks"
          badge={<>
            <Badge variant="secondary">{completedCount}/{totalCount}</Badge>
            {autoSyncing && <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />}
          </>}
          actions={<>
            <UndoButton />
            <Button onClick={handleAddWithAuth} size="sm">
              <Plus className="h-4 w-4 mr-1" />Add Task
            </Button>
          </>}
          overflow={overflowItems}
        />

        <FilterBar>
          <PersonFilter members={familyMembers} selected={filterPerson} onSelect={setFilterPerson} />
          {!isMobile && (
            <>
              <div className="w-px h-5 bg-border shrink-0" />
              <div className="flex gap-1 shrink-0">
                <Button variant={filterPriority === null ? 'secondary' : 'ghost'} size="sm" onClick={() => setFilterPriority(null)} className="h-8">All</Button>
                {(['high', 'medium', 'low'] as const).map((priority) => (
                  <Button key={priority} variant={filterPriority === priority ? 'secondary' : 'ghost'} size="sm"
                    onClick={() => setFilterPriority(priority)} className="capitalize h-8">{priority}</Button>
                ))}
              </div>
              {taskLists.length > 0 && (
                <>
                  <div className="w-px h-5 bg-border shrink-0" />
                  <FilterDropdown label="List" options={listOptions}
                    selected={filterList ? new Set([filterList]) : new Set()}
                    onSelectionChange={(s) => setFilterList(s.size > 0 ? [...s][0]! : null)}
                    mode="single" icon={<List className="h-3.5 w-3.5" />}
                  />
                </>
              )}
            </>
          )}
          <div className="w-px h-5 bg-border shrink-0" />
          <FilterDropdown label="Group" options={primaryGroupOptions} selected={new Set([primaryGroup])}
            onSelectionChange={(s) => {
              const val = (s.size > 0 ? [...s][0]! : 'none') as GroupBy;
              setPrimaryGroup(val);
              if (val === 'none') setSecondaryGroup('none');
            }}
            mode="single" icon={<Users className="h-3.5 w-3.5" />}
          />
          {primaryGroup !== 'none' && taskLists.length > 0 && (
            <FilterDropdown label="Then by" options={secondaryGroupOptions} selected={new Set([secondaryGroup])}
              onSelectionChange={(s) => setSecondaryGroup((s.size > 0 ? [...s][0]! : 'none') as GroupBy)}
              mode="single"
            />
          )}
          <SortSelect value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}
            options={[{ value: 'dueDate', label: 'Due Date' }, { value: 'priority', label: 'Priority' }, { value: 'title', label: 'Title' }]}
            showSortIcon className="ml-auto"
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 text-muted-foreground h-8">
              <X className="h-3 w-3 mr-1" />Clear
            </Button>
          )}
        </FilterBar>

        <div className="flex-1 overflow-y-auto p-4">
          <TaskContentArea
            loading={loading} error={error} filteredTasks={filteredTasks}
            groupMode={groupMode}
            tasksByUser={tasksByUser} tasksByList={tasksByList}
            tasksByPersonThenList={tasksByPersonThenList} tasksByListThenPerson={tasksByListThenPerson}
            inlineTask={inlineTask} setInlineTask={setInlineTask}
            inlineTaskByUser={inlineTaskByUser} setInlineTaskByUser={setInlineTaskByUser}
            inlineTaskByList={inlineTaskByList} setInlineTaskByList={setInlineTaskByList}
            handleInlineAdd={handleInlineAdd}
            toggleTask={toggleTask} editTask={editTask} setCelebratingUser={setCelebratingUser}
            taskLists={taskLists} isMobile={isMobile}
            refreshTasks={refreshTasks} handleAddWithAuth={handleAddWithAuth}
          />
        </div>

        {showAddModal && (
          <TaskModal
            onClose={() => setShowAddModal(false)}
            onSave={async (task) => {
              try {
                const res = await fetch('/api/tasks', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: task.title, description: task.description, priority: task.priority,
                    category: task.category, assignedTo: task.assignedTo?.id,
                    dueDate: task.dueDate ? task.dueDate.toISOString() : undefined,
                    listId: task.listId,
                  }),
                });
                if (!res.ok) throw new Error('Failed to create task');
                refreshTasks();
                setShowAddModal(false);
              } catch (err) {
                console.error('Error creating task:', err);
                toast({ title: 'Failed to create task', variant: 'destructive' });
              }
            }}
            familyMembers={familyMembers} taskLists={taskLists}
            defaultListId={filterList === 'none' ? null : filterList}
          />
        )}

        {editingTask && (
          <TaskModal
            task={editingTask}
            onClose={() => setEditingTask(null)}
            onSave={async (updatedTask) => {
              try {
                const res = await fetch(`/api/tasks/${editingTask.id}`, {
                  method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    title: updatedTask.title, description: updatedTask.description, priority: updatedTask.priority,
                    category: updatedTask.category, assignedTo: updatedTask.assignedTo?.id,
                    // null forwards as JSON null and triggers the server-side clear branch.
                    dueDate: updatedTask.dueDate === null ? null : updatedTask.dueDate.toISOString(),
                    completed: updatedTask.completed,
                    listId: updatedTask.listId,
                  }),
                });
                if (!res.ok) throw new Error('Failed to update task');
                refreshTasks();
                setEditingTask(null);
              } catch (err) {
                console.error('Error updating task:', err);
                toast({ title: 'Failed to update task', variant: 'destructive' });
              }
            }}
            familyMembers={familyMembers} taskLists={taskLists}
          />
        )}

        <PlaneCelebration show={!!celebratingUser} userName={celebratingUser?.name || ''} onComplete={() => setCelebratingUser(null)} />
        <ConfirmDialog {...confirmDialogProps} />
      </div>
    </PageWrapper>
  );
}
