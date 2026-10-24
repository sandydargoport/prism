/**
 * @jest-environment jsdom
 */
/**
 * Which list a new item goes on: the list given by the caller, otherwise the
 * first list once the lists have loaded.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { AddShoppingItemModal } from '../AddShoppingItemModal';

const lists = [{ id: 'list-a', name: 'Groceries' }, { id: 'list-b', name: 'Hardware' }];
const fetchMock = jest.fn((url: string) =>
  Promise.resolve({ ok: true, json: async () => (url === '/api/shopping-lists' ? { lists } : {}) } as Response),
);
beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

async function addItem(name: string) {
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/shopping-lists'));
  const field = document.getElementById('item-name') as HTMLInputElement;
  fireEvent.change(field, { target: { value: name } });
  fireEvent.submit(field.closest('form')!);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/shopping-items', expect.anything()));
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  const post = calls.find(([url]) => url === '/api/shopping-items')!;
  return JSON.parse(post[1].body as string);
}

describe('AddShoppingItemModal list', () => {
  it('puts a new item on the first list when no list was given', async () => {
    render(<AddShoppingItemModal open onOpenChange={jest.fn()} />);
    expect((await addItem('Milk')).listId).toBe('list-a');
  });

  it('keeps the list the caller gave', async () => {
    render(<AddShoppingItemModal open onOpenChange={jest.fn()} defaultListId="list-b" />);
    expect((await addItem('Nails')).listId).toBe('list-b');
  });

  it('does not fetch the lists while closed', () => {
    render(<AddShoppingItemModal open={false} onOpenChange={jest.fn()} />);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
