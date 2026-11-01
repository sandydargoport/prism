/**
 * Reading NOAA's OVATION grid for one place, and what the night sky says.
 */

import { auroraAt, auroraNotice, fetchAurora, type OvationGrid } from '../aurora';

/** A grid of zeros with the given cells set: [lon 0..359, lat, percent]. */
function grid(cells: [number, number, number][]): OvationGrid {
  const set = new Map(cells.map(([x, y, v]) => [`${x},${y}`, v]));
  const coordinates: [number, number, number][] = [];
  for (let x = 0; x < 360; x++) {
    for (let y = -90; y <= 90; y++) coordinates.push([x, y, set.get(`${x},${y}`) ?? 0]);
  }
  return { 'Forecast Time': '2026-11-01T06:00:00Z', coordinates };
}

describe('auroraAt', () => {
  // A place at 45 N, 100 W: longitude 260 on NOAA's 0..359 grid.
  const lat = 45;
  const lon = -100;

  it('is overhead when the chance here is 10% or more', () => {
    expect(auroraAt(grid([[260, 45, 12]]), lat, lon)).toBe('overhead');
  });

  it('is low on the horizon when the oval is within reach to the north', () => {
    expect(auroraAt(grid([[262, 52, 30]]), lat, lon)).toBe('horizon');
  });

  it('is nothing when the oval is too far north to see', () => {
    expect(auroraAt(grid([[260, 60, 80]]), lat, lon)).toBeNull();
  });

  it('is nothing on a quiet night with faint chances all round', () => {
    expect(auroraAt(grid([[260, 45, 5], [260, 50, 9]]), lat, lon)).toBeNull();
  });

  it('looks south, not north, in the southern hemisphere', () => {
    // Hobart, 43 S 147 E. The oval to the north of it is the wrong way.
    expect(auroraAt(grid([[147, -38, 50]]), -43, 147)).toBeNull();
    expect(auroraAt(grid([[147, -49, 50]]), -43, 147)).toBe('horizon');
  });

  it('wraps round the date line', () => {
    // 2 W is longitude 358; the oval at 3 E is five degrees east of it.
    expect(auroraAt(grid([[3, 60, 40]]), 55, -2)).toBe('horizon');
  });
});

describe('auroraNotice', () => {
  it('says where to look', () => {
    expect(auroraNotice('horizon', 45)).toBe('Aurora possible now, low in the northern sky');
    expect(auroraNotice('overhead', -43)).toBe('Aurora may be overhead now. Look up and to the south');
    expect(auroraNotice(null, 45)).toBeNull();
  });
});

describe('fetchAurora', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('reads the fetched grid for the place', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => grid([[260, 45, 20]]) });
    await expect(fetchAurora(45, -100)).resolves.toEqual({ chance: 'overhead', forecastAt: '2026-11-01T06:00:00Z' });
  });

  it('throws when NOAA answers with an error', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchAurora(45, -100)).rejects.toThrow('HTTP 503');
  });

  it('gives up on a slow answer after 10 seconds rather than waiting for it', async () => {
    // AbortSignal.timeout runs on Node's own timers, out of fake timers'
    // reach, so the signal it hands out is swapped for one fired by hand.
    const timeout = new AbortController();
    const spy = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal);
    global.fetch = jest.fn((_url: string, init?: RequestInit) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })) as unknown as typeof fetch;
    const pending = fetchAurora(45, -100);
    expect(spy).toHaveBeenCalledWith(10_000);
    timeout.abort();
    await expect(pending).rejects.toThrow('aborted');
    spy.mockRestore();
  });
});
