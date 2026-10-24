/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from '@testing-library/react';
import { useWifiConfig } from '../useWifiConfig';

const fetchMock = jest.fn(() =>
  Promise.resolve({ ok: true, json: async () => ({ config: { ssid: 'Home', password: 'pw', securityType: 'WPA', hidden: false } }) } as Response),
);
beforeEach(() => {
  fetchMock.mockClear();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe('useWifiConfig', () => {
  it('is not loading, and fetches nothing, while disabled', () => {
    const { result } = renderHook(() => useWifiConfig({ enabled: false }));
    expect(result.current.loading).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads the config once enabled', async () => {
    const { result, rerender } = renderHook(({ enabled }) => useWifiConfig({ enabled }), {
      initialProps: { enabled: false },
    });
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.hasConfig).toBe(true));
    expect(result.current.loading).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
