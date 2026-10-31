/**
 * @jest-environment jsdom
 */

/**
 * Behavioral tests for ShoppingWidget.
 *
 * Covers interactions: tap-to-cross toggle (optimistic update), progress bar,
 * list switching, all-checked state, and empty state.
 *
 * Smoke tests (render-only) live in widgetRender.test.tsx — not duplicated here.
 */

import * as React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ShoppingList } from '@/types';

// ---- Mocks (same setup as widgetRender.test.tsx) ----
jest.mock('@/lib/utils', () => ({ cn: (...c: unknown[]) => c.filter(Boolean).join(' ') }));
jest.mock('@/components/ui', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...p
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button onClick={onClick} disabled={disabled} {...p}>
      {children}
    </button>
  ),
  Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Checkbox: ({
    checked,
    onCheckedChange,
  }: {
    checked?: boolean;
    onCheckedChange?: () => void;
  }) => <input type="checkbox" checked={checked} onChange={onCheckedChange} />,
  Progress: ({ value }: { value?: number }) => (
    <div role="progressbar" aria-valuenow={value} />
  ),
  UserAvatar: ({ name }: { name: string }) => <span>{name}</span>,
  DropdownMenu: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
  }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <div onClick={onClick}>{children}</div>
  ),
}));
jest.mock('@/components/widgets/WidgetContainer', () => ({
  WidgetContainer: ({
    children,
    title,
    actions,
  }: React.PropsWithChildren<{ title: string; actions?: React.ReactNode }>) => (
    <div data-testid="widget-container">
      <h2>{title}</h2>
      {actions}
      {children}
    </div>
  ),
  WidgetEmpty: ({ message }: { message: string }) => (
    <div data-testid="widget-empty">{message}</div>
  ),
  useWidgetBgOverride: () => null,
}));

import { ShoppingWidget } from '../ShoppingWidget';

// ---- Fixtures ----
const makeList = (overrides: Partial<ShoppingList> = {}): ShoppingList => ({
  id: 'l1',
  name: 'Grocery',
  sortOrder: 0,
  createdAt: '2026-01-01',
  items: [
    {
      id: 'i1',
      listId: 'l1',
      name: 'Apples',
      checked: false,
      category: 'produce',
      createdAt: '2026-01-01',
    },
    {
      id: 'i2',
      listId: 'l1',
      name: 'Milk',
      checked: true,
      category: 'dairy',
      createdAt: '2026-01-01',
    },
  ],
  ...overrides,
});

const secondList: ShoppingList = {
  id: 'l2',
  name: 'Target',
  sortOrder: 1,
  createdAt: '2026-01-01',
  items: [
    {
      id: 'i3',
      listId: 'l2',
      name: 'Paper towels',
      checked: false,
      createdAt: '2026-01-01',
    },
  ],
};

// Helper: the item rows in order. A row is the tap target (tap to cross
// out), and aria-pressed says whether it is crossed out.
function getRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[role="button"][aria-pressed]'));
}
const isCrossed = (row: HTMLElement) => row.getAttribute('aria-pressed') === 'true';

// ---- Tests ----
beforeEach(() => localStorage.clear());

describe('ShoppingWidget — behavioral', () => {
  describe('Check off item', () => {
    it('calls onItemToggle with correct itemId and true when checking an unchecked item', () => {
      const onItemToggle = jest.fn();
      render(<ShoppingWidget lists={[makeList()]} onItemToggle={onItemToggle} />);

      // Apples (i1) is unchecked — it's the first checkbox
      const checkboxes = getRows();
      const applesCheckbox = checkboxes[0]!; // i1 — unchecked
      expect(isCrossed(applesCheckbox)).toBe(false);

      fireEvent.click(applesCheckbox);

      expect(onItemToggle).toHaveBeenCalledTimes(1);
      expect(onItemToggle).toHaveBeenCalledWith('i1', true);
    });
  });

  describe('Tap to cross out', () => {
    it('has no checkbox: tapping the item itself crosses it out', () => {
      const onItemToggle = jest.fn();
      render(<ShoppingWidget lists={[makeList()]} onItemToggle={onItemToggle} />);
      expect(screen.queryAllByRole('checkbox')).toHaveLength(0);

      fireEvent.click(screen.getByText('Apples'));
      expect(onItemToggle).toHaveBeenCalledWith('i1', true);
      expect(screen.getByText('Apples').className).toContain('line-through');
    });
  });

  describe('Uncheck item', () => {
    it('calls onItemToggle with correct itemId and false when unchecking a checked item', () => {
      const onItemToggle = jest.fn();
      render(<ShoppingWidget lists={[makeList()]} onItemToggle={onItemToggle} showChecked />);

      // Milk (i2) is checked — it's the second checkbox
      const checkboxes = getRows();
      const milkCheckbox = checkboxes[1]!; // i2 — checked
      expect(isCrossed(milkCheckbox)).toBe(true);

      fireEvent.click(milkCheckbox);

      expect(onItemToggle).toHaveBeenCalledTimes(1);
      expect(onItemToggle).toHaveBeenCalledWith('i2', false);
    });
  });

  describe('Checked items', () => {
    afterEach(() => jest.useRealTimers());

    it('hides items that are already checked by default', () => {
      render(<ShoppingWidget lists={[makeList()]} />);
      expect(screen.getByText('Apples')).toBeTruthy();
      expect(screen.queryByText('Milk')).toBeNull();
    });

    it('still counts hidden checked items in the progress line', () => {
      render(<ShoppingWidget lists={[makeList()]} />);
      expect(screen.getByText('1 of 2 checked')).toBeTruthy();
    });

    it('shows checked items when showChecked is set', () => {
      render(<ShoppingWidget lists={[makeList()]} showChecked />);
      expect(screen.getByText('Milk')).toBeTruthy();
    });

    it('keeps an item ticked here on screen briefly, then hides it', () => {
      jest.useFakeTimers();
      render(<ShoppingWidget lists={[makeList()]} onItemToggle={jest.fn()} />);

      fireEvent.click(getRows()[0]!); // Apples
      expect(screen.getByText('Apples')).toBeTruthy();
      expect(isCrossed(getRows()[0]!)).toBe(true);

      React.act(() => { jest.advanceTimersByTime(5000); });
      expect(screen.queryByText('Apples')).toBeNull();
    });

    it('lets a mis-tap be undone during the grace period', () => {
      jest.useFakeTimers();
      const onItemToggle = jest.fn();
      render(<ShoppingWidget lists={[makeList()]} onItemToggle={onItemToggle} />);

      fireEvent.click(getRows()[0]!);
      React.act(() => { jest.advanceTimersByTime(2000); });
      fireEvent.click(getRows()[0]!);
      React.act(() => { jest.advanceTimersByTime(5000); });

      expect(onItemToggle).toHaveBeenLastCalledWith('i1', false);
      expect(screen.getByText('Apples')).toBeTruthy();
    });

    it('is empty when every item is checked off, so Hide when empty can hide it', () => {
      const allChecked = makeList({
        items: makeList().items.map((i) => ({ ...i, checked: true })),
      });
      render(<ShoppingWidget lists={[allChecked]} />);
      // WidgetEmpty is what tells the grid the widget is empty (#738).
      expect(screen.getByTestId('widget-empty').textContent).toBe('Everything is checked off');
    });

    it('is empty when the picked list is all checked off, even if another list has items', () => {
      const allChecked = makeList({
        items: makeList().items.map((i) => ({ ...i, checked: true })),
      });
      render(<ShoppingWidget lists={[allChecked, secondList]} />);
      expect(screen.getByTestId('widget-empty').textContent).toBe('Everything is checked off');
      expect(screen.queryByText('Paper towels')).toBeNull();
    });
  });

  describe('Optimistic update', () => {
    it('immediately updates checkbox appearance before any callback resolves', () => {
      // onItemToggle intentionally does nothing (simulates a slow network call)
      const slowToggle = jest.fn();
      render(<ShoppingWidget lists={[makeList()]} onItemToggle={slowToggle} />);

      const checkboxes = getRows();
      const applesCheckbox = checkboxes[0]!; // i1 starts unchecked
      expect(isCrossed(applesCheckbox)).toBe(false);

      fireEvent.click(applesCheckbox);

      // The UI should reflect the new checked state immediately (optimistic)
      const updatedCheckboxes = getRows();
      expect(isCrossed(updatedCheckboxes[0]!)).toBe(true);
    });
  });

  describe('Progress bar', () => {
    it('reflects checked/total ratio (1 of 2 checked → ~50)', () => {
      // makeList has i1=unchecked, i2=checked → 1/2 = 50%
      render(<ShoppingWidget lists={[makeList()]} />);

      const progressbar = screen.getByRole('progressbar');
      const value = Number(progressbar.getAttribute('aria-valuenow'));
      expect(value).toBeCloseTo(50, 0);
    });

    it('updates progress value after a checkbox is toggled (optimistic)', () => {
      // Both items start unchecked → 0%
      const listAllUnchecked = makeList({
        items: [
          { id: 'i1', listId: 'l1', name: 'Apples', checked: false, createdAt: '2026-01-01' },
          { id: 'i2', listId: 'l1', name: 'Milk', checked: false, createdAt: '2026-01-01' },
        ],
      });
      render(<ShoppingWidget lists={[listAllUnchecked]} />);

      const progressBefore = Number(
        screen.getByRole('progressbar').getAttribute('aria-valuenow')
      );
      expect(progressBefore).toBeCloseTo(0, 0);

      // Check the first item → 1/2 = 50%
      fireEvent.click(getRows()[0]!);

      const progressAfter = Number(
        screen.getByRole('progressbar').getAttribute('aria-valuenow')
      );
      expect(progressAfter).toBeCloseTo(50, 0);
    });
  });

  describe('List switching', () => {
    it('calls onListChange with the new list ID when switching via dropdown', () => {
      const onListChange = jest.fn();
      render(
        <ShoppingWidget
          lists={[makeList(), secondList]}
          onListChange={onListChange}
        />
      );

      // The dropdown items for each list name should be present because the
      // DropdownMenuContent is always rendered in the mock
      const targetOption = screen.getByText('Target');
      fireEvent.click(targetOption);

      expect(onListChange).toHaveBeenCalledTimes(1);
      expect(onListChange).toHaveBeenCalledWith('l2');
    });

    it('switches active list content after clicking a dropdown item', () => {
      const onListChange = jest.fn();
      render(
        <ShoppingWidget
          lists={[makeList(), secondList]}
          onListChange={onListChange}
        />
      );

      // Initially Grocery list items are shown
      expect(screen.getByText('Apples')).toBeTruthy();

      // Switch to Target list
      fireEvent.click(screen.getByText('Target'));

      // Now the Target list item should be visible
      expect(screen.getByText('Paper towels')).toBeTruthy();
    });

    it('remembers the picked list on this display, so the screensaver copy shows it too', () => {
      const dashboard = render(<ShoppingWidget lists={[makeList(), secondList]} />);
      fireEvent.click(screen.getByText('Target'));
      dashboard.unmount();

      // A second copy of the widget, as the screensaver draws.
      render(<ShoppingWidget lists={[makeList(), secondList]} />);
      expect(screen.getByText('Paper towels')).toBeTruthy();
      expect(screen.queryByText('Apples')).toBeNull();
    });

    it('falls back to the first list when the remembered one is gone', () => {
      localStorage.setItem('prism-shopping-widget-list', 'deleted-list');
      render(<ShoppingWidget lists={[makeList(), secondList]} />);
      expect(screen.getByText('Apples')).toBeTruthy();
    });
  });

  describe('All checked', () => {
    it('shows progress bar at 100 when all items are checked', () => {
      const allCheckedList = makeList({
        items: [
          { id: 'i1', listId: 'l1', name: 'Apples', checked: true, createdAt: '2026-01-01' },
          { id: 'i2', listId: 'l1', name: 'Milk', checked: true, createdAt: '2026-01-01' },
        ],
      });
      render(<ShoppingWidget lists={[allCheckedList]} showChecked />);

      const progressbar = screen.getByRole('progressbar');
      expect(Number(progressbar.getAttribute('aria-valuenow'))).toBeCloseTo(100, 0);
    });
  });

  describe('Empty list', () => {
    it('shows empty state message when lists prop is empty', () => {
      render(<ShoppingWidget lists={[]} />);
      const emptyEl = screen.getByTestId('widget-empty');
      expect(emptyEl).toBeTruthy();
      expect(emptyEl.textContent).toMatch(/no items/i);
    });

    it('shows empty state message when list has no items', () => {
      const emptyList = makeList({ items: [] });
      render(<ShoppingWidget lists={[emptyList]} />);
      const emptyEl = screen.getByTestId('widget-empty');
      expect(emptyEl).toBeTruthy();
      expect(emptyEl.textContent).toMatch(/no items/i);
    });
  });
});
