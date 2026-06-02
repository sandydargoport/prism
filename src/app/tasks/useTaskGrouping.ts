'use client';

import { useState, useMemo } from 'react';
import { toast } from '@/components/ui/use-toast';
import type { Task } from '@/types';
import type { GroupBy, GroupMode, SubGroupDef } from '@/app/tasks/taskGroupTypes';

interface UseTaskGroupingParams {
  filteredTasks: Task[];
  familyMembers: Array<{ id: string; name: string; color: string }>;
  taskLists: Array<{ id: string; name: string; color?: string | null }>;
  filterList: string | null;
  filterPerson: string[] | null;
  refreshTasks: () => void;
  requireAuth: (title: string, message: string) => Promise<{ id: string } | null>;
}

export function useTaskGrouping({
  filteredTasks,
  familyMembers,
  taskLists,
  filterList,
  filterPerson,
  refreshTasks,
  requireAuth,
}: UseTaskGroupingParams) {
  // When the user has narrowed the PersonFilter, hide the columns/sub-columns
  // for unselected people entirely (not just empty them). Matches Chores and
  // Wishes. Also suppresses the "Unassigned" bucket — the user has explicitly
  // asked to see only those people.
  const personFilterActive = filterPerson !== null && filterPerson.length > 0;
  const isMemberAllowed = (id: string) =>
    !personFilterActive || filterPerson!.includes(id);
  const allowedMembers = useMemo(
    () => familyMembers.filter(m => !m.id || isMemberAllowed(m.id)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [familyMembers, personFilterActive, filterPerson?.join(',')]
  );
  const [primaryGroup, setPrimaryGroup] = useState<GroupBy>('person');
  const [secondaryGroup, setSecondaryGroup] = useState<GroupBy>('none');

  const groupMode = useMemo((): GroupMode => {
    if (primaryGroup === 'none') return 'none';
    if (primaryGroup === 'person' && secondaryGroup === 'list') return 'person_then_list';
    if (primaryGroup === 'list' && secondaryGroup === 'person') return 'list_then_person';
    return primaryGroup;
  }, [primaryGroup, secondaryGroup]);

  // Inline task add state
  const [inlineTask, setInlineTask] = useState('');
  const [inlineTaskByUser, setInlineTaskByUser] = useState<Record<string, string>>({});
  const [inlineTaskByList, setInlineTaskByList] = useState<Record<string, string>>({});

  const handleInlineAdd = async (assignedTo?: string, listId?: string) => {
    let value: string | undefined;
    if (assignedTo) {
      value = inlineTaskByUser[assignedTo]?.trim();
    } else if (listId) {
      value = inlineTaskByList[listId]?.trim();
    } else {
      value = inlineTask.trim();
    }
    if (!value) return;

    const user = await requireAuth('Add Task', 'Please log in to add a task');
    if (!user) return;

    try {
      const body: Record<string, string> = { title: value };
      if (assignedTo) body.assignedTo = assignedTo;
      const effectiveListId = listId || (filterList && filterList !== 'none' ? filterList : undefined);
      if (effectiveListId) body.listId = effectiveListId;
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Failed to create task');
      refreshTasks();
      if (assignedTo) {
        setInlineTaskByUser(prev => ({ ...prev, [assignedTo]: '' }));
      } else if (listId) {
        setInlineTaskByList(prev => ({ ...prev, [listId]: '' }));
      } else {
        setInlineTask('');
      }
    } catch (err) {
      console.error('Error creating task:', err);
      toast({ title: 'Failed to create task', variant: 'destructive' });
    }
  };

  // Group tasks by assigned user
  const tasksByUser = useMemo(() => {
    if (groupMode !== 'person') return null;

    // Build assignee list from task data itself — works even when familyMembers has
    // empty IDs (unauthenticated state: /api/family returns id:'' before login).
    const assigneeMap = new Map<string, { id: string; name: string; color: string }>();
    filteredTasks.forEach(t => { if (t.assignedTo) assigneeMap.set(t.assignedTo.id, t.assignedTo); });

    // All family members always get a column; append any extra assignees not in family
    const ordered: { id: string; name: string; color: string }[] = [];
    familyMembers.forEach(member => {
      if (member.id && isMemberAllowed(member.id)) {
        ordered.push(member);
        assigneeMap.delete(member.id);
      }
    });
    // Any assignees not yet in familyMembers (e.g., before family refresh post-login)
    assigneeMap.forEach(a => { if (isMemberAllowed(a.id)) ordered.push(a); });

    const groups: { user: { id: string; name: string; color: string } | null; tasks: Task[] }[] = [];
    ordered.forEach(member => {
      const userTasks = filteredTasks.filter(t => t.assignedTo?.id === member.id);
      groups.push({ user: member, tasks: userTasks });
    });

    if (!personFilterActive) {
      const unassigned = filteredTasks.filter(t => !t.assignedTo);
      if (unassigned.length > 0) groups.push({ user: null, tasks: unassigned });
    }

    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupMode, filteredTasks, familyMembers, personFilterActive, filterPerson?.join(',')]);

  // Group tasks by list
  const tasksByList = useMemo(() => {
    if (groupMode !== 'list') return null;

    const groups: { list: { id: string; name: string; color: string } | null; tasks: Task[] }[] = [];

    taskLists.forEach((list) => {
      const listTasks = filteredTasks.filter((t) => (t as typeof t & { listId?: string }).listId === list.id);
      if (listTasks.length > 0) {
        groups.push({ list: { id: list.id, name: list.name, color: list.color || '#6B7280' }, tasks: listTasks });
      }
    });

    const noList = filteredTasks.filter((t) => !(t as typeof t & { listId?: string }).listId);
    if (noList.length > 0) {
      groups.push({ list: null, tasks: noList });
    }

    return groups;
  }, [groupMode, filteredTasks, taskLists]);

  // Group tasks by person → list (nested)
  const tasksByPersonThenList = useMemo(() => {
    if (groupMode !== 'person_then_list') return null;

    const buildSubGroups = (memberTasks: Task[]): SubGroupDef[] => {
      const subs: SubGroupDef[] = [];
      taskLists.forEach((list) => {
        const t = memberTasks.filter(task => (task as typeof task & { listId?: string }).listId === list.id);
        if (t.length > 0) subs.push({ key: list.id, label: list.name, color: list.color || '#6B7280', tasks: t });
      });
      const noList = memberTasks.filter(task => !(task as typeof task & { listId?: string }).listId);
      if (noList.length > 0) subs.push({ key: 'no-list', label: 'No List', color: '#6B7280', tasks: noList });
      return subs;
    };

    const result: { member: typeof familyMembers[0] | null; tasks: Task[]; subGroups: SubGroupDef[] }[] = [];

    allowedMembers.forEach((member) => {
      const memberTasks = filteredTasks.filter(t => t.assignedTo?.id === member.id);
      result.push({ member, tasks: memberTasks, subGroups: buildSubGroups(memberTasks) });
    });

    if (!personFilterActive) {
      const unassigned = filteredTasks.filter(t => !t.assignedTo);
      if (unassigned.length > 0) {
        result.push({ member: null, tasks: unassigned, subGroups: buildSubGroups(unassigned) });
      }
    }

    return result;
  }, [groupMode, filteredTasks, allowedMembers, taskLists, personFilterActive]);

  // Group tasks by list → person (nested)
  const tasksByListThenPerson = useMemo(() => {
    if (groupMode !== 'list_then_person') return null;

    const buildSubGroups = (listTasks: Task[]): SubGroupDef[] => {
      const subs: SubGroupDef[] = [];
      allowedMembers.forEach((member) => {
        const t = listTasks.filter(task => task.assignedTo?.id === member.id);
        if (t.length > 0) subs.push({ key: member.id, label: member.name, color: member.color, tasks: t });
      });
      if (!personFilterActive) {
        const unassigned = listTasks.filter(task => !task.assignedTo);
        if (unassigned.length > 0) subs.push({ key: 'unassigned', label: 'Unassigned', color: '#6B7280', tasks: unassigned });
      }
      return subs;
    };

    const result: { list: { id: string; name: string; color: string } | null; tasks: Task[]; subGroups: SubGroupDef[] }[] = [];

    taskLists.forEach((list) => {
      const listTasks = filteredTasks.filter(t => (t as typeof t & { listId?: string }).listId === list.id);
      if (listTasks.length > 0) {
        result.push({ list: { id: list.id, name: list.name, color: list.color || '#6B7280' }, tasks: listTasks, subGroups: buildSubGroups(listTasks) });
      }
    });

    const noList = filteredTasks.filter(t => !(t as typeof t & { listId?: string }).listId);
    if (noList.length > 0) {
      result.push({ list: null, tasks: noList, subGroups: buildSubGroups(noList) });
    }

    return result;
  }, [groupMode, filteredTasks, allowedMembers, taskLists, personFilterActive]);

  return {
    primaryGroup,
    setPrimaryGroup,
    secondaryGroup,
    setSecondaryGroup,
    groupMode,
    inlineTask,
    setInlineTask,
    inlineTaskByUser,
    setInlineTaskByUser,
    inlineTaskByList,
    setInlineTaskByList,
    handleInlineAdd,
    tasksByUser,
    tasksByList,
    tasksByPersonThenList,
    tasksByListThenPerson,
  };
}
