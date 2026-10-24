/**
 * @jest-environment jsdom
 */
/**
 * Picking a national park looks up where it is, so the location fills in
 * without typing a search.
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import { PinForm } from '../PinForm';

const fetchMock = jest.fn((_url: string) =>
  Promise.resolve({ ok: true, json: async () => ({ results: [] }) } as Response),
);
beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('PinForm national park', () => {
  it('searches for the park when one is picked', async () => {
    render(<PinForm pinType="national_park" onSave={jest.fn()} onCancel={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /^Acadia/ }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(`/api/travel/geocode?q=${encodeURIComponent('Acadia National Park')}`),
    );
  });
});
