/**
 * @jest-environment jsdom
 */
/**
 * Subtasks under their parent (#1200): in the flat list, the grouped grid and
 * the nested grouped grid, a task's subtasks follow it, indented; one whose
 * parent is not on screen stands on its own.
 */
import { render } from '@testing-library/react';
import { TaskContentArea } from '../TaskContentArea';
import { withSubtasks } from '@/lib/tasks/subtasks';
import type { Task } from '@/types';

jest.mock('@/components/providers', () => ({
  useDisplayToday: () => ({ today: '2026-11-13', timeZone: 'America/Chicago' }),
}));

const emma = { id: 'u1', name: 'Emma', color: '#10b981' };
const t = (id: string, title: string, parentId?: string): Task =>
  ({ id, title, completed: false, priority: 'medium', parentId: parentId ?? null, assignedTo: emma, listId: 'l1' } as Task);

// The provider order: a subtask can arrive before its parent.
const tasks = [t('s1', 'Buy the frame', 'p1'), t('p1', 'Hang the photos'), t('x', 'Call the plumber'), t('s2', 'Find the drill', 'p1'), t('o', 'Orphan step', 'gone')];

describe('withSubtasks', () => {
  it('puts each subtask straight after its parent, and keeps an orphan on its own', () => {
    expect(withSubtasks(tasks).map(({ task, nested }) => `${nested ? '  ' : ''}${task.title}`)).toEqual([
      'Hang the photos', '  Buy the frame', '  Find the drill', 'Call the plumber', 'Orphan step',
    ]);
  });
});

const base = {
  loading: false, error: null, filteredTasks: tasks,
  tasksByUser: [{ user: emma, tasks }], tasksByList: [{ list: { id: 'l1', name: 'House', color: '#999' }, tasks }],
  tasksByPersonThenList: [{ member: emma, tasks, subGroups: [{ key: 'l1', label: 'House', color: '#999', tasks }] }],
  tasksByListThenPerson: null,
  inlineTask: '', setInlineTask: jest.fn(), inlineTaskByUser: {}, setInlineTaskByUser: jest.fn(),
  inlineTaskByList: {}, setInlineTaskByList: jest.fn(), handleInlineAdd: jest.fn(),
  toggleTask: jest.fn().mockResolvedValue(true), editTask: jest.fn(), deleteTask: jest.fn(), setCelebratingUser: jest.fn(),
  taskLists: [{ id: 'l1', name: 'House' }], isMobile: false, refreshTasks: jest.fn(), handleAddWithAuth: jest.fn(),
};

describe.each(['none', 'person', 'list', 'person_then_list'] as const)('the To-dos page grouped by %s', (groupMode) => {
  it('draws the subtasks indented under their parent', () => {
    render(<TaskContentArea {...base} groupMode={groupMode} />);
    const rows = [...document.querySelectorAll<HTMLElement>('div.cursor-pointer')].filter((r) => tasks.some((x) => r.textContent?.includes(x.title)));
    const order = rows.map((r) => `${r.dataset.subtask ? '  ' : ''}${tasks.find((x) => r.textContent?.includes(x.title))!.title}`);
    expect(order).toEqual(['Hang the photos', '  Buy the frame', '  Find the drill', 'Call the plumber', 'Orphan step']);
    for (const r of rows.filter((x) => x.dataset.subtask)) expect(r.className).toContain('ml-6');
  });
});

describe('the Tasks widget', () => {
  it('draws the subtasks indented under their parent', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TasksWidget } = require('@/components/widgets/TasksWidget') as typeof import('@/components/widgets/TasksWidget');
    render(<TasksWidget tasks={tasks} maxTasks={10} />);
    const rows = [...document.querySelectorAll<HTMLElement>('[role="button"][aria-pressed]')];
    expect(rows.map((r) => `${r.dataset.subtask ? '  ' : ''}${r.textContent?.match(/Hang the photos|Buy the frame|Find the drill|Call the plumber|Orphan step/)?.[0]}`)).toEqual([
      'Hang the photos', '  Buy the frame', '  Find the drill', 'Call the plumber', 'Orphan step',
    ]);
  });
});
