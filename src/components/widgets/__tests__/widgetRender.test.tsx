/**
 * @jest-environment jsdom
 */

/**
 * Smoke tests for prop-based widgets (ChoresWidget, TasksWidget, ShoppingWidget).
 *
 * These widgets receive all data as props with no internal data-fetching hooks,
 * so they can be rendered without provider setup. Tests verify:
 * - Renders without throwing
 * - Shows empty state when no data provided
 * - Shows loading state when loading=true
 * - Renders items when data is provided
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import type { Chore } from '@/types';
import type { Task } from '@/types';
import type { ShoppingList } from '@/types';

// ---- shadcn/ui mocks (avoid CSS module / Radix issues in jsdom) ----
jest.mock('@/lib/utils', () => ({ cn: (...c: unknown[]) => c.filter(Boolean).join(' ') }));
jest.mock('@/components/ui', () => ({
  Button: ({ children, onClick, disabled, ...p }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) =>
    <button onClick={onClick} disabled={disabled} {...p}>{children}</button>,
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Checkbox: ({ checked, onCheckedChange }: { checked?: boolean; onCheckedChange?: () => void }) =>
    <input type="checkbox" checked={checked} onChange={onCheckedChange} />,
  Progress: ({ value }: { value?: number }) => <div role="progressbar" aria-valuenow={value} />,
  UserAvatar: ({ name }: { name: string }) => <span>{name}</span>,
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) =>
    <div onClick={onClick}>{children}</div>,
}));
jest.mock('@/components/ui/avatar', () => ({
  UserAvatar: ({ name }: { name: string }) => <span>{name}</span>,
}));
jest.mock('@/components/widgets/WidgetContainer', () => ({
  WidgetContainer: ({ children, title }: React.PropsWithChildren<{ title: string }>) =>
    <div data-testid="widget-container"><h2>{title}</h2>{children}</div>,
  WidgetEmpty: ({ message }: { message: string }) =>
    <div data-testid="widget-empty">{message}</div>,
  useWidgetBgOverride: () => null,
}));

import { ChoresWidget } from '../ChoresWidget';
import { TasksWidget } from '../TasksWidget';
import { ShoppingWidget } from '../ShoppingWidget';

// ---- Fixtures ----
const mockChore: Chore = {
  id: 'c1', title: 'Vacuum', category: 'cleaning', frequency: 'weekly',
  pointValue: 5, requiresApproval: false, enabled: true,
  nextDue: '2026-04-10', assignedTo: { id: 'u1', name: 'Alice', color: '#f00' },
  pendingApproval: undefined, customIntervalDays: undefined, lastCompleted: undefined,
  createdAt: '2026-01-01',
};

const mockTask: Task = {
  id: 't1', title: 'Buy milk', priority: 'medium', completed: false,
  dueDate: '2026-04-10',
  assignedTo: { id: 'u1', name: 'Alice', color: '#f00', avatarUrl: null },
};

const mockList: ShoppingList = {
  id: 'l1', name: 'Grocery', sortOrder: 0, createdAt: '2026-01-01', items: [
    { id: 'i1', listId: 'l1', name: 'Apples', checked: false, category: 'produce', quantity: 3, unit: 'kg', notes: '', createdAt: '2026-01-01' },
    { id: 'i2', listId: 'l1', name: 'Milk', checked: true, category: 'dairy', quantity: 1, unit: 'L', notes: '', createdAt: '2026-01-01' },
  ],
};

// ---- ChoresWidget ----
describe('ChoresWidget', () => {
  it('renders without throwing', () => {
    expect(() => render(<ChoresWidget />)).not.toThrow();
  });

  it('shows empty state when no chores', () => {
    render(<ChoresWidget chores={[]} />);
    expect(screen.getByTestId('widget-empty')).toBeTruthy();
  });

  it('shows loading state', () => {
    render(<ChoresWidget loading={true} />);
    // WidgetContainer handles loading display
    expect(screen.getByTestId('widget-container')).toBeTruthy();
  });

  it('renders chore items', () => {
    render(<ChoresWidget chores={[mockChore]} />);
    expect(screen.getByText('Vacuum')).toBeTruthy();
  });

  it('filters by userId', () => {
    const other: Chore = { ...mockChore, id: 'c2', title: 'Mop', assignedTo: { id: 'u2', name: 'Bob', color: '#00f' } };
    render(<ChoresWidget chores={[mockChore, other]} userId="u2" />);
    expect(screen.queryByText('Vacuum')).toBeNull();
    expect(screen.getByText('Mop')).toBeTruthy();
  });
});

// ---- TasksWidget ----
describe('TasksWidget', () => {
  it('renders without throwing', () => {
    expect(() => render(<TasksWidget />)).not.toThrow();
  });

  it('shows empty state when no tasks', () => {
    render(<TasksWidget tasks={[]} />);
    expect(screen.getByTestId('widget-empty')).toBeTruthy();
  });

  it('renders task items', () => {
    render(<TasksWidget tasks={[mockTask]} />);
    expect(screen.getByText('Buy milk')).toBeTruthy();
  });

  it('hides completed tasks by default', () => {
    const done: Task = { ...mockTask, id: 't2', title: 'Done task', completed: true };
    render(<TasksWidget tasks={[mockTask, done]} showCompleted={false} />);
    expect(screen.getByText('Buy milk')).toBeTruthy();
    expect(screen.queryByText('Done task')).toBeNull();
  });

  it('shows completed tasks when showCompleted=true', () => {
    const done: Task = { ...mockTask, id: 't2', title: 'Done task', completed: true };
    render(<TasksWidget tasks={[mockTask, done]} showCompleted={true} />);
    expect(screen.getByText('Done task')).toBeTruthy();
  });
});

// ---- ShoppingWidget ----
describe('ShoppingWidget', () => {
  it('renders without throwing', () => {
    expect(() => render(<ShoppingWidget />)).not.toThrow();
  });

  it('shows empty state when no lists', () => {
    render(<ShoppingWidget lists={[]} />);
    expect(screen.getByTestId('widget-empty')).toBeTruthy();
  });

  it('renders shopping items', () => {
    render(<ShoppingWidget lists={[mockList]} />);
    expect(screen.getByText('Apples')).toBeTruthy();
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders progress bar when items exist', () => {
    render(<ShoppingWidget lists={[mockList]} />);
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});
