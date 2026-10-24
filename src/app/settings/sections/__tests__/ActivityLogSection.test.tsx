/**
 * @jest-environment jsdom
 */
/**
 * Changing a filter starts the list again from page 1, so "Load more" after a
 * filter change asks for page 2 of the filtered list.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';

jest.mock('@/components/providers', () => ({
  useFamily: () => ({ members: [] }),
}));

import { ActivityLogSection } from '../ActivityLogSection';

const entry = (id: string) => ({
  id, action: 'create', entityType: 'task', summary: `Entry ${id}`, createdAt: new Date().toISOString(), userId: null,
});
const fetchMock = jest.fn((_url: string) =>
  Promise.resolve({ ok: true, json: async () => ({ logs: [entry(String(Math.random()))], total: 5 }) } as Response),
);
beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

const pages = () => fetchMock.mock.calls.map(([url]) => new URL(url, 'http://x').searchParams.get('page'));

describe('ActivityLogSection paging', () => {
  it('asks for page 2 of the filtered list after a filter change', async () => {
    render(<ActivityLogSection />);
    const loadMore = await screen.findByRole('button', { name: /load more/i });
    fireEvent.click(loadMore);
    await waitFor(() => expect(pages()).toEqual(['1', '2']));

    fireEvent.change(screen.getByDisplayValue('All types'), { target: { value: 'chore' } });
    await waitFor(() => expect(pages()).toEqual(['1', '2', '1']));

    fireEvent.click(await screen.findByRole('button', { name: /load more/i }));
    await waitFor(() => expect(pages()).toEqual(['1', '2', '1', '2']));
  });
});
