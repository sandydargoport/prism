/**
 * @jest-environment jsdom
 */
/**
 * Who a message is posted as. The signed-in user when there is one, otherwise
 * the person picked, otherwise the first family member, including when the
 * family only finishes loading after the modal is already open.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';

let mockMembers: { id: string; name: string; color: string }[] = [];
jest.mock('@/components/providers', () => ({
  useFamily: () => ({ members: mockMembers, loading: false }),
}));

import { AddMessageModal } from '../AddMessageModal';

const fetchMock = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) } as Response));
beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
  mockMembers = [];
});

async function post(text: string) {
  const field = document.getElementById('message') as HTMLTextAreaElement;
  fireEvent.change(field, { target: { value: text } });
  fireEvent.submit(field.closest('form')!);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
  return JSON.parse(calls[0]![1].body as string);
}

describe('AddMessageModal author', () => {
  it('posts as the first member when the family loads after the modal opened', async () => {
    const { rerender } = render(<AddMessageModal open onOpenChange={jest.fn()} />);
    mockMembers = [{ id: 'm1', name: 'Alex', color: '#000' }, { id: 'm2', name: 'Sam', color: '#111' }];
    rerender(<AddMessageModal open onOpenChange={jest.fn()} />);
    expect((await post('Hello')).authorId).toBe('m1');
  });

  it('posts as the signed-in user when there is one', async () => {
    mockMembers = [{ id: 'm1', name: 'Alex', color: '#000' }];
    render(
      <AddMessageModal open onOpenChange={jest.fn()} currentUser={{ id: 'm9', name: 'Signed-in user', color: '#222' }} />,
    );
    expect((await post('Hi')).authorId).toBe('m9');
  });
});
