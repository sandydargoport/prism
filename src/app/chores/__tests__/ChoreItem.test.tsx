/**
 * @jest-environment jsdom
 */
/**
 * The Chores page list row: a tap on the row completes the chore, as the grid
 * card and the recipe ingredients work; the switch, pencil and bin do only
 * their own thing; a disabled chore's row does nothing.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import type { Chore } from '@/types';
import { ChoreItem } from '../ChoreItem';

const chore = {
  id: 'c1', title: 'Water the plants', category: 'cleaning', frequency: 'weekly',
  pointValue: 1, requiresApproval: false, enabled: true, nextDue: '2026-09-28',
  createdAt: '2026-01-01',
} as unknown as Chore;

function renderItem(over: Partial<Chore> = {}) {
  const handlers = { onComplete: jest.fn(), onToggleEnabled: jest.fn(), onEdit: jest.fn(), onDelete: jest.fn() };
  render(<ChoreItem chore={{ ...chore, ...over }} {...handlers} />);
  return handlers;
}

describe('Chores page list row', () => {
  it('completes the chore with a tap on the row, with no separate complete button', () => {
    const h = renderItem();
    expect(screen.queryByTitle('Mark as complete')).toBeNull();
    fireEvent.click(screen.getByText('Water the plants'));
    expect(h.onComplete).toHaveBeenCalledTimes(1);
  });

  it('edit, delete and the enabled switch do not also complete it', () => {
    const h = renderItem();
    fireEvent.click(screen.getByRole('button', { name: 'Edit chore' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete chore' }));
    fireEvent.click(screen.getByRole('switch'));
    expect(h.onEdit).toHaveBeenCalledTimes(1);
    expect(h.onDelete).toHaveBeenCalledTimes(1);
    expect(h.onToggleEnabled).toHaveBeenCalledTimes(1);
    expect(h.onComplete).not.toHaveBeenCalled();
  });

  it('does nothing on a disabled chore', () => {
    const h = renderItem({ enabled: false });
    fireEvent.click(screen.getByText('Water the plants'));
    expect(h.onComplete).not.toHaveBeenCalled();
  });

  // #891: a status word sits on its own solid fill. Coloured text alone was
  // unreadable over glass, where the photo behind decides the contrast.
  it('shows an overdue chore as a red status pill, title in the normal colour', () => {
    renderItem({ nextDue: '2020-01-01' });
    const pill = document.querySelector('[data-status-pill="danger"]');
    expect(pill).not.toBeNull();
    expect(pill!.className).toContain('bg-destructive');
    expect(screen.getByText('Water the plants').className).not.toMatch(/text-(destructive|warning)/);
  });

  it('shows who completed a chore awaiting approval as an amber status pill', () => {
    renderItem({ pendingApproval: { id: 'p1', completedBy: { id: 'u1', name: 'Robin', color: '#3B82F6' }, completedAt: '2026-09-28' } } as unknown as Partial<Chore>);
    const pill = document.querySelector('[data-status-pill="warning"]');
    expect(pill?.textContent).toContain('Completed by Robin');
    expect(screen.getByText('Water the plants').className).not.toMatch(/text-(destructive|warning)/);
  });
});
