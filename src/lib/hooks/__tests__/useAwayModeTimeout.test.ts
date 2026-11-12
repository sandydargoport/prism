/**
 * @jest-environment jsdom
 */
/**
 * Settings' Away timer reads and writes the household's value (#1159), not
 * this browser's.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAwayModeTimeout } from '../useAwayModeTimeout';

let server: { autoAfterHours: number | null };
let patchStatus = 200;
let patches: unknown[] = [];

beforeEach(() => {
  localStorage.clear();
  server = { autoAfterHours: null };
  patchStatus = 200;
  patches = [];
  global.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      patches.push(body);
      if (patchStatus === 200) server.autoAfterHours = body.autoAfterHours;
      return { ok: patchStatus === 200, status: patchStatus, json: async () => ({ autoAfterHours: server.autoAfterHours }) } as Response;
    }
    return { ok: true, json: async () => ({ enabled: false, ...server }) } as Response;
  }) as unknown as typeof fetch;
});

describe('useAwayModeTimeout', () => {
  it('shows the household value once the server answers', async () => {
    server.autoAfterHours = 24;
    const { result } = renderHook(() => useAwayModeTimeout());
    expect(result.current.ready).toBe(false);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.timeout).toBe(24);
  });

  it('saves a change for the household, and keeps nothing in the browser', async () => {
    const { result } = renderHook(() => useAwayModeTimeout());
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.setTimeout(48); });
    expect(patches).toContainEqual({ autoAfterHours: 48 });
    expect(server.autoAfterHours).toBe(48);
    expect(result.current.timeout).toBe(48);
    expect(localStorage.getItem('prism-away-mode-timeout')).toBeNull();
  });

  it('carries a value this browser kept over to the household', async () => {
    localStorage.setItem('prism-away-mode-timeout', '72');
    const { result } = renderHook(() => useAwayModeTimeout());
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.timeout).toBe(72);
    expect(patches).toContainEqual({ autoAfterHours: 72, carryOver: true });
  });

  it('goes back and says so when the change is refused', async () => {
    server.autoAfterHours = 24;
    patchStatus = 403;
    const { result } = renderHook(() => useAwayModeTimeout());
    await waitFor(() => expect(result.current.ready).toBe(true));
    await act(async () => { await result.current.setTimeout(4); });
    expect(result.current.timeout).toBe(24);
    expect(result.current.error).toMatch(/parent/i);
  });
});
