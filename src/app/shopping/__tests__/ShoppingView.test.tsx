/**
 * @jest-environment jsdom
 */

/**
 * Shopping mode is the list to shop from (#1312). The list used to render only
 * outside Manage and outside Shopping mode, so Shopping mode fell through to
 * Manage's category rows (rename, emoji, show, remove, Add category).
 */
import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { ShoppingItem, ShoppingList } from '@/types';

const mockToggle = jest.fn();
const mockEdit = jest.fn();

const items: ShoppingItem[] = [
  { id: 'i1', listId: 'l1', name: 'Pears', category: 'produce', checked: false, createdAt: '2026-01-01' },
  { id: 'i2', listId: 'l1', name: 'Oat milk', category: 'dairy', checked: false, createdAt: '2026-01-01' },
];
const list = { id: 'l1', name: 'Weekend groceries', sortOrder: 0, createdAt: '2026-01-01', items } as ShoppingList;
const categories = [
  { id: 'produce', name: 'Produce', emoji: '🥬', color: '#22C55E' },
  { id: 'dairy', name: 'Dairy', emoji: '🥛', color: '#3B82F6' },
];

jest.mock('../useShoppingViewData', () => ({
  useShoppingViewData: () => ({
    lists: [list], loading: false, error: null, refreshLists: jest.fn(), familyMembers: [],
    requireAuth: jest.fn(), apiAddItem: jest.fn(),
    activeListId: 'l1', setActiveListId: jest.fn(),
    showChecked: false, setShowChecked: jest.fn(),
    showAddItemModal: false, setShowAddItemModal: jest.fn(),
    editingItem: null, setEditingItem: jest.fn(),
    showListModal: false, setShowListModal: jest.fn(),
    editingList: null, setEditingList: jest.fn(),
    activeList: list, filteredItems: {},
    toggleItem: (id: string) => mockToggle(id), deleteItem: jest.fn(),
    totalItems: 2, checkedItems: 0, progress: 0,
  }),
}));
jest.mock('@/lib/hooks/useShoppingCategories', () => ({
  useShoppingCategories: () => ({
    categories,
    addCategory: jest.fn(), removeCategory: jest.fn(), reorderCategories: jest.fn(), updateCategory: jest.fn(),
    getCategoryEmoji: () => '🛒', getCategoryColor: () => '#888888',
  }),
}));
jest.mock('../useShoppingScanFlow', () => ({
  useShoppingScanFlow: () => ({ scan: null, clearScan: jest.fn(), handleCameraScan: jest.fn(), handleListChosen: jest.fn(), doAdd: jest.fn() }),
}));
jest.mock('../useShoppingDragReorder', () => ({
  useShoppingDragReorder: () => ({
    draggedCategory: null, handleDragStart: jest.fn(), handleDragOver: jest.fn(), handleDragEnd: jest.fn(),
    startTouchDrag: jest.fn(), moveTouchDrag: jest.fn(), endTouchDrag: jest.fn(),
  }),
}));
jest.mock('../useShoppingCelebration', () => ({ useShoppingCelebration: () => ({ showCelebration: false, setShowCelebration: jest.fn() }) }));
jest.mock('../useShoppingCrudHandlers', () => ({
  useShoppingCrudHandlers: () => ({
    handleAddItem: jest.fn(), handleNewList: jest.fn(), handleEditItem: (item: ShoppingItem) => mockEdit(item), handleDeleteItem: jest.fn(),
    handleSaveNewItem: jest.fn(), handleUpdateItem: jest.fn(), handleSaveList: jest.fn(), handleDeleteList: jest.fn(),
  }),
}));
// A phone: Shopping mode is in the page's menu, as in the report.
jest.mock('@/lib/hooks/useIsMobile', () => ({ useIsMobile: () => true }));
jest.mock('@/lib/hooks/useSwipeNavigation', () => ({ useSwipeNavigation: () => undefined }));
jest.mock('@/lib/hooks/usePageAdd', () => ({ usePageAdd: () => {} }));
jest.mock('@/lib/hooks/useConfirmDialog', () => ({ useConfirmDialog: () => ({ confirm: jest.fn(), dialogProps: {} }) }));
jest.mock('@/components/ui/confirm-dialog', () => ({ ConfirmDialog: () => null }));
jest.mock('@/components/ui/use-toast', () => ({ toast: jest.fn() }));
jest.mock('@/components/layout', () => ({
  PageWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  UndoButton: () => null,
  SubpageHeader: ({ actions, overflow }: { actions?: React.ReactNode; overflow?: Array<{ label: string; onClick: () => void }> }) => (
    <header>
      {actions}
      {overflow?.map((o) => <button key={o.label} type="button" onClick={o.onClick}>{o.label}</button>)}
    </header>
  ),
}));
jest.mock('next/dynamic', () => () => () => null);
jest.mock('@/app/shopping/ItemModal', () => ({ ItemModal: () => null }));
jest.mock('@/app/shopping/ListModal', () => ({ ListModal: () => null }));
jest.mock('@/app/shopping/ShoppingCelebration', () => ({ ShoppingCelebration: () => null }));
jest.mock('@/app/shopping/ScanFlowSheet', () => ({ ScanFlowSheet: () => null }));
jest.mock('@/app/shopping/KrogerCartModal', () => ({ KrogerCartModal: () => null }));

import { ShoppingView } from '../ShoppingView';

beforeEach(() => jest.clearAllMocks());

function expectTheListToShopFrom(container: HTMLElement) {
  const calm = container.querySelector<HTMLElement>('[data-shopping-calm]');
  expect(calm).not.toBeNull();
  expect(within(calm!).getByText('Pears')).toBeTruthy();
  expect(within(calm!).getByText('Oat milk')).toBeTruthy();
  // None of Manage: no category rows, no Add category, no Reset.
  expect(container.querySelector('[data-shopping-manage-view]')).toBeNull();
  expect(container.querySelectorAll('[data-shopping-manage-row]')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: /Add category/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Rename Produce/ })).toBeNull();
  // Tick-only rows: no pencil; the add field stays for something remembered in the aisle.
  expect(calm!.querySelectorAll('[data-shopping-edit]')).toHaveLength(0);
  expect(calm!.querySelector('[data-shopping-add]')).not.toBeNull();
}

describe('Shopping mode', () => {
  it('shows the items to tick and none of the Manage rows', async () => {
    const { container } = render(<ShoppingView />);
    fireEvent.click(screen.getByRole('button', { name: 'Shopping mode' }));
    expect(screen.getByTitle('Exit shopping mode')).toBeTruthy();
    expectTheListToShopFrom(container);

    // A tap on the row ticks the item.
    fireEvent.click(screen.getByText('Pears'));
    await waitFor(() => expect(mockToggle).toHaveBeenCalledWith('i1'));
    expect(mockEdit).not.toHaveBeenCalled();
  });

  it('entered from Manage, still shows the list, and leaving goes back to Manage', () => {
    const { container } = render(<ShoppingView />);
    fireEvent.click(container.querySelector<HTMLElement>('[data-shopping-manage]')!);
    expect(container.querySelector('[data-shopping-manage-view]')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Shopping mode' }));
    expectTheListToShopFrom(container);

    fireEvent.click(screen.getByTitle('Exit shopping mode'));
    expect(container.querySelector('[data-shopping-manage-view]')).not.toBeNull();
  });

  it('outside Shopping mode the list keeps its pencils', () => {
    const { container } = render(<ShoppingView />);
    const calm = container.querySelector<HTMLElement>('[data-shopping-calm]')!;
    expect(calm.querySelectorAll('[data-shopping-edit]')).toHaveLength(2);
    fireEvent.click(within(calm).getByRole('button', { name: 'Edit Pears' }));
    expect(mockEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }));
  });
});
