/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { TimeFormatProvider, useTimeFormat } from '../TimeFormatProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <TimeFormatProvider>{children}</TimeFormatProvider>
);

describe('TimeFormatProvider', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('loads the saved family-wide preference', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ settings: { timeFormat: '24h' } }),
    });

    const { result } = renderHook(() => useTimeFormat(), { wrapper });

    await waitFor(() => expect(result.current.timeFormat).toBe('24h'));
  });

  it('updates the context and persists the setting', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: { timeFormat: '12h' } }),
      })
      .mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useTimeFormat(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await act(async () => result.current.setTimeFormat('24h'));

    expect(result.current.timeFormat).toBe('24h');
    expect(fetchMock).toHaveBeenLastCalledWith('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'timeFormat', value: '24h' }),
    });
  });

  it('rolls back an optimistic change when saving fails', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: { timeFormat: '12h' } }),
      })
      .mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useTimeFormat(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await expect(act(async () => result.current.setTimeFormat('24h'))).rejects.toThrow(
      'Failed to save time format',
    );
    expect(result.current.timeFormat).toBe('12h');
  });
});
