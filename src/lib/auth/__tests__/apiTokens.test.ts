/**
 * API tokens: made random, kept only as a hash, and (#1246) good only while
 * the member who made one is still a parent.
 */
import { generateApiToken, hashToken, revokeApiTokensOf, validateApiToken } from '../apiTokens';

/** The token row the lookup finds, with its maker's role as it is now. */
const mockFound = jest.fn();
const mockDeleted = jest.fn();
jest.mock('@/lib/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: () => ({ limit: async () => mockFound() }) }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
    delete: () => ({ where: (w: unknown) => ({ returning: async () => mockDeleted(w) }) }),
  },
}));
jest.mock('drizzle-orm', () => ({ eq: (col: unknown, value: unknown) => ({ col, value }) }));
jest.mock('@/lib/db/schema', () => ({
  apiTokens: { id: 'api_tokens.id', tokenHash: 'api_tokens.token_hash', createdBy: 'api_tokens.created_by', scopes: 'api_tokens.scopes' },
  users: { id: 'users.id', role: 'users.role' },
}));

describe('generateApiToken', () => {
  it('returns a 64-char hex string', () => {
    const token = generateApiToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates unique tokens', () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateApiToken());
    }
    expect(tokens.size).toBe(100);
  });
});

describe('hashToken', () => {
  it('returns a 64-char hex string (SHA-256)', () => {
    const hash = hashToken('test-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic — same input produces same hash', () => {
    const input = 'my-secret-token';
    expect(hashToken(input)).toBe(hashToken(input));
  });

  it('produces different hashes for different inputs', () => {
    const hash1 = hashToken('token-a');
    const hash2 = hashToken('token-b');
    expect(hash1).not.toBe(hash2);
  });

  it('hash differs from the raw token', () => {
    const raw = generateApiToken();
    const hashed = hashToken(raw);
    expect(hashed).not.toBe(raw);
  });
});

describe('validateApiToken', () => {
  const row = (creatorRole: string) => [{ id: 't1', createdBy: 'parent-1', scopes: ['*'], creatorRole }];

  it('acts as a parent while the member who made it is one', async () => {
    mockFound.mockReturnValue(row('parent'));
    expect(await validateApiToken('raw')).toEqual({ userId: 'parent-1', role: 'parent', scopes: ['*'] });
  });

  it.each(['child', 'guest'])('stops working once its maker is a %s', async (role) => {
    mockFound.mockReturnValue(row(role));
    expect(await validateApiToken('raw')).toBeNull();
  });

  it('an unknown token is refused', async () => {
    mockFound.mockReturnValue([]);
    expect(await validateApiToken('raw')).toBeNull();
  });
});

describe('revokeApiTokensOf', () => {
  it("deletes every token the member made, and says how many", async () => {
    mockDeleted.mockReturnValue([{ id: 't1' }, { id: 't2' }]);
    expect(await revokeApiTokensOf('parent-1')).toBe(2);
    expect(mockDeleted).toHaveBeenCalledWith({ col: 'api_tokens.created_by', value: 'parent-1' });
  });
});
