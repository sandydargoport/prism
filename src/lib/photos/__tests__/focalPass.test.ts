import { runFocalPass, FOCAL_PASS } from '../focalPass';

describe('the focal-point pass (#956)', () => {
  it('measures and stores a few photos per pass', async () => {
    const stored: string[] = [];
    const n = await runFocalPass({
      list: async () => ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id })),
      measure: async () => ({ x: 0.3, y: 0.6 }),
      store: async (id) => { stored.push(id); return true; },
    });
    expect(n).toBe(FOCAL_PASS.batch);
    expect(stored).toEqual(['a', 'b', 'c']);
  });

  it('skips a photo it cannot read and one the server refuses, and carries on', async () => {
    const n = await runFocalPass({
      list: async () => [{ id: 'unreadable' }, { id: 'refused' }, { id: 'fine' }],
      measure: async (id) => { if (id === 'unreadable') throw new Error('decode'); return { x: 0.5, y: 0.5 }; },
      store: async (id) => id !== 'refused',
    });
    expect(n).toBe(1);
  });

  it('does nothing when the list cannot be read', async () => {
    const measure = jest.fn();
    expect(await runFocalPass({ list: async () => { throw new Error('offline'); }, measure, store: jest.fn() })).toBe(0);
    expect(measure).not.toHaveBeenCalled();
  });
});
