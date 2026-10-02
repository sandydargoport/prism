import { parentCanResetPin } from '../pinReset';

const parent = { id: 'p1', role: 'parent' };

describe('parentCanResetPin', () => {
  it.each([
    ['a parent, for a child', parent, { id: 'c1', role: 'child' }, true],
    ['a parent, for a guest', parent, { id: 'g1', role: 'guest' }, true],
    ['a parent, for another parent', parent, { id: 'p2', role: 'parent' }, false],
    ['a parent, for themselves', parent, { id: 'p1', role: 'parent' }, false],
    ['a parent, for a member with no role', parent, { id: 'x1' }, false],
    ['a child, for another child', { id: 'c2', role: 'child' }, { id: 'c1', role: 'child' }, false],
    ['an API token with a parent role', { ...parent, viaApiToken: true }, { id: 'c1', role: 'child' }, false],
  ])('%s -> %s', (_label, actor, target, expected) => {
    expect(parentCanResetPin(actor, target)).toBe(expected);
  });
});
