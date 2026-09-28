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
    localStorage.clear();
    sessionStorage.clear();
  });

  it('uses the cached household zone and display mode on the first render', () => {
    // Nothing resolves: whatever the first render shows is all there is to see.
    fetchMock.mockReturnValue(new Promise(() => {}));
    localStorage.setItem('prism:timezone', 'Asia/Tokyo');

    const renders: string[] = [];
    renderHook(() => {
      const value = useTimeFormat();
      renders.push(value.displayTimezone);
      return value;
    }, { wrapper });
    expect(renders[0]).toBe('Asia/Tokyo');

    localStorage.setItem('prism:display-timezone-mode', 'device');
    const device = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { result } = renderHook(() => useTimeFormat(), { wrapper });
    expect(result.current.displayTimezone).toBe(device);
    expect(result.current.householdTimezone).toBe('Asia/Tokyo');
  });

  it('loads the saved family-wide preference', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ settings: { timeFormat: '24h', timezone: 'Europe/Warsaw' } }),
    });

    const { result } = renderHook(() => useTimeFormat(), { wrapper });

    await waitFor(() => expect(result.current.timeFormat).toBe('24h'));
  });

  it('updates the context and persists the setting', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ settings: { timeFormat: '12h', timezone: 'Europe/Warsaw' } }),
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
        json: async () => ({ settings: { timeFormat: '12h', timezone: 'Europe/Warsaw' } }),
      })
      .mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => useTimeFormat(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await expect(act(async () => result.current.setTimeFormat('24h'))).rejects.toThrow(
      'Failed to save time format',
    );
    expect(result.current.timeFormat).toBe('12h');
  });

  it('defaults display times to the saved household timezone', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ settings: { timeFormat: '24h', timezone: 'Europe/Warsaw' } }),
    });

    const { result } = renderHook(() => useTimeFormat(), { wrapper });

    await waitFor(() => expect(result.current.householdTimezone).toBe('Europe/Warsaw'));
    expect(result.current.displayTimezoneMode).toBe('household');
    expect(result.current.displayTimezone).toBe('Europe/Warsaw');
  });

  it('stores the device-timezone override locally without changing family settings', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ settings: { timezone: 'Europe/Warsaw' } }),
    });

    const { result } = renderHook(() => useTimeFormat(), { wrapper });
    await waitFor(() => expect(result.current.householdTimezone).toBe('Europe/Warsaw'));

    act(() => result.current.setDisplayTimezoneMode('device'));

    expect(result.current.displayTimezoneMode).toBe('device');
    expect(result.current.displayTimezone).toBe(result.current.deviceTimezone);
    expect(localStorage.getItem('prism:display-timezone-mode')).toBe('device');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // The zone comes from the local cache in these tests, so they do not depend
  // on the zone the test process runs in.
  describe('household time zone backfill', () => {
    const noZone = { ok: true, json: async () => ({ settings: { timeFormat: '12h' } }) };
    const patchCalls = () => fetchMock.mock.calls.filter(([, init]) => init?.method === 'PATCH');

    it('saves the zone this device shows when the server has none', async () => {
      localStorage.setItem('prism:timezone', 'America/Chicago');
      fetchMock.mockResolvedValueOnce(noZone).mockResolvedValueOnce({ ok: true, status: 200 });

      renderHook(() => useTimeFormat(), { wrapper });

      await waitFor(() => expect(patchCalls()).toHaveLength(1));
      expect(patchCalls()[0]![1].body).toBe(JSON.stringify({ key: 'timezone', value: 'America/Chicago' }));
      await waitFor(() => expect(sessionStorage.getItem('prism:timezone-backfill-attempted')).toBe('1'));
    });

    it('does nothing when the server already has a zone', async () => {
      localStorage.setItem('prism:timezone', 'America/Chicago');
      fetchMock.mockResolvedValue({ ok: true, json: async () => ({ settings: { timezone: 'Asia/Tokyo' } }) });

      const { result } = renderHook(() => useTimeFormat(), { wrapper });

      await waitFor(() => expect(result.current.householdTimezone).toBe('Asia/Tokyo'));
      expect(patchCalls()).toHaveLength(0);
    });

    it.each(['UTC', 'Etc/GMT+5'])('never saves %s', async (zone) => {
      localStorage.setItem('prism:timezone', zone);
      fetchMock.mockResolvedValue(noZone);

      renderHook(() => useTimeFormat(), { wrapper });

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      await new Promise((r) => setTimeout(r, 0));
      expect(patchCalls()).toHaveLength(0);
    });

    it('tries again later when a logged-out display is refused', async () => {
      localStorage.setItem('prism:timezone', 'America/Chicago');
      fetchMock.mockResolvedValueOnce(noZone).mockResolvedValueOnce({ ok: false, status: 401 });

      renderHook(() => useTimeFormat(), { wrapper });

      await waitFor(() => expect(patchCalls()).toHaveLength(1));
      await new Promise((r) => setTimeout(r, 0));
      expect(sessionStorage.getItem('prism:timezone-backfill-attempted')).toBeNull();
    });

    it('does not try when the settings request itself failed', async () => {
      localStorage.setItem('prism:timezone', 'America/Chicago');
      fetchMock.mockResolvedValue({ ok: false, status: 401 });

      renderHook(() => useTimeFormat(), { wrapper });

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      await new Promise((r) => setTimeout(r, 0));
      expect(patchCalls()).toHaveLength(0);
    });
  });
});
