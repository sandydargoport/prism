/**
 * @jest-environment jsdom
 */
/**
 * A modal that fills its form from a record when it opens. The fill is keyed
 * by the record's id, not the object: the wish list refreshes in the
 * background, and a fresh copy of the same item used to refill the form over
 * whatever was being typed.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { WishItemModal } from '../WishItemModal';
import type { WishItem } from '@/types';

const wish = (over: Partial<WishItem> = {}): WishItem => ({
  id: 'w1', memberId: 'm1', name: 'Kite', url: null, notes: null,
  sortOrder: 0, claimed: false, ...over,
} as WishItem);

const props = { onOpenChange: jest.fn(), onSave: jest.fn(() => Promise.resolve()) };
const nameField = () => screen.getByLabelText('Name') as HTMLInputElement;

describe('WishItemModal', () => {
  it('keeps what is being typed when a refreshed copy of the same item arrives', () => {
    const { rerender } = render(<WishItemModal open editingItem={wish()} {...props} />);
    fireEvent.change(nameField(), { target: { value: 'Red kite' } });

    rerender(<WishItemModal open editingItem={wish()} {...props} />);
    expect(nameField().value).toBe('Red kite');
  });

  it('fills from the item it was opened for', () => {
    const { rerender } = render(<WishItemModal open={false} editingItem={null} {...props} />);
    rerender(<WishItemModal open editingItem={wish({ id: 'w2', name: 'Bike' })} {...props} />);
    expect(nameField().value).toBe('Bike');
  });

  it('starts blank when reopened to add, after an edit', () => {
    const { rerender } = render(<WishItemModal open editingItem={wish()} {...props} />);
    rerender(<WishItemModal open={false} editingItem={null} {...props} />);
    rerender(<WishItemModal open editingItem={null} {...props} />);
    expect(nameField().value).toBe('');
  });
});
