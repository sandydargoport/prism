/**
 * Tests for Redis cache utility functions.
 *
 * Mocks Redis client to test getCached, setCache, invalidateCache,
 * deleteCache, cacheExists, getCacheTTL, and graceful fallbacks
 * when Redis is unavailable.
 */

// --- Redis mock ---
const mockRedisClient = {
  get: jest.fn().mockResolvedValue(null),
  setEx: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  exists: jest.fn().mockResolvedValue(0),
  ttl: jest.fn().mockResolvedValue(300),
  scanIterator: jest.fn(),
};

const mockGetRedisClient = jest.fn().mockResolvedValue(mockRedisClient);

jest.mock('@/lib/cache/getRedisClient', () => ({
  getRedisClient: () => mockGetRedisClient(),
}));

import {
  getCached,
  setCache,
  invalidateCache,
  deleteCache,
  cacheExists,
  getCacheTTL,
} from '../redis';

describe('getCached logging', () => {
  it('names a bad cache entry on one line, as a %s argument', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
    mockRedisClient.get.mockResolvedValueOnce('{not json');
    await getCached('search:milk\nERROR forged', jest.fn().mockResolvedValue(1));
    const call = warn.mock.calls.find((c) => String(c[1]).includes('Invalid cached data'))!;
    expect(call[0]).toBe('%s');
    expect(call[1]).toBe('Invalid cached data for key: search:milk ERROR forged');
    warn.mockRestore();
  });
});

describe('getCached', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('returns cached data on cache hit', async () => {
    mockRedisClient.get.mockResolvedValueOnce(JSON.stringify({ name: 'Alice' }));
    const fetchFn = jest.fn();

    const result = await getCached('user:1', fetchFn);

    expect(result).toEqual({ name: 'Alice' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('calls fetchFn and caches result on cache miss', async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);
    const fetchFn = jest.fn().mockResolvedValue({ name: 'Bob' });

    const result = await getCached('user:2', fetchFn, 600);

    expect(result).toEqual({ name: 'Bob' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(mockRedisClient.setEx).toHaveBeenCalledWith('user:2', 600, JSON.stringify({ name: 'Bob' }));
  });

  it('uses default TTL of 300s', async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);
    const fetchFn = jest.fn().mockResolvedValue('data');

    await getCached('key', fetchFn);

    expect(mockRedisClient.setEx).toHaveBeenCalledWith('key', 300, '"data"');
  });

  it('falls back to fetchFn when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);
    const fetchFn = jest.fn().mockResolvedValue('fresh');

    const result = await getCached('key', fetchFn);

    expect(result).toBe('fresh');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('falls back to fetchFn when Redis get throws', async () => {
    mockRedisClient.get.mockRejectedValueOnce(new Error('connection lost'));
    const fetchFn = jest.fn().mockResolvedValue('fallback');

    const result = await getCached('key', fetchFn);

    expect(result).toBe('fallback');
  });

  it('falls back to fetchFn when cached data is invalid JSON', async () => {
    mockRedisClient.get.mockResolvedValueOnce('not-json{{{');
    const fetchFn = jest.fn().mockResolvedValue('parsed-fresh');

    const result = await getCached('key', fetchFn);

    expect(result).toBe('parsed-fresh');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not throw when setEx fails after fetch', async () => {
    mockRedisClient.get.mockResolvedValueOnce(null);
    mockRedisClient.setEx.mockRejectedValueOnce(new Error('write error'));
    const fetchFn = jest.fn().mockResolvedValue('data');

    const result = await getCached('key', fetchFn);

    expect(result).toBe('data');
  });
});

describe('setCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('stores value in Redis with TTL', async () => {
    await setCache('my-key', { items: [1, 2, 3] }, 120);

    expect(mockRedisClient.setEx).toHaveBeenCalledWith(
      'my-key', 120, JSON.stringify({ items: [1, 2, 3] })
    );
  });

  it('uses default TTL of 300s', async () => {
    await setCache('my-key', 'value');

    expect(mockRedisClient.setEx).toHaveBeenCalledWith('my-key', 300, '"value"');
  });

  it('does nothing when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    await setCache('key', 'value');

    expect(mockRedisClient.setEx).not.toHaveBeenCalled();
  });

  it('does not throw when setEx fails', async () => {
    mockRedisClient.setEx.mockRejectedValueOnce(new Error('disk full'));

    await expect(setCache('key', 'value')).resolves.toBeUndefined();
  });
});

describe('invalidateCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('deletes all keys matching the pattern', async () => {
    // Mock scanIterator as async generator yielding string keys
    mockRedisClient.scanIterator.mockReturnValue((async function* () {
      yield 'cache:user:1';
      yield 'cache:user:2';
      yield 'cache:user:3';
    })());

    await invalidateCache('cache:user:*');

    expect(mockRedisClient.scanIterator).toHaveBeenCalledWith({ MATCH: 'cache:user:*' });
    expect(mockRedisClient.del).toHaveBeenCalledTimes(3);
    expect(mockRedisClient.del).toHaveBeenCalledWith('cache:user:1');
    expect(mockRedisClient.del).toHaveBeenCalledWith('cache:user:2');
    expect(mockRedisClient.del).toHaveBeenCalledWith('cache:user:3');
  });

  it('handles scanIterator returning arrays', async () => {
    mockRedisClient.scanIterator.mockReturnValue((async function* () {
      yield ['key:a', 'key:b'];
      yield 'key:c';
    })());

    await invalidateCache('key:*');

    expect(mockRedisClient.del).toHaveBeenCalledTimes(3);
    expect(mockRedisClient.del).toHaveBeenCalledWith('key:a');
    expect(mockRedisClient.del).toHaveBeenCalledWith('key:b');
    expect(mockRedisClient.del).toHaveBeenCalledWith('key:c');
  });

  it('does nothing when no keys match', async () => {
    mockRedisClient.scanIterator.mockReturnValue((async function* () {
      // empty generator
    })());

    await invalidateCache('nonexistent:*');

    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  it('does nothing when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    await invalidateCache('cache:*');

    expect(mockRedisClient.scanIterator).not.toHaveBeenCalled();
  });

  it('does not throw when scan throws', async () => {
    mockRedisClient.scanIterator.mockReturnValue((async function* () {
      throw new Error('scan failed');
    })());

    await expect(invalidateCache('key:*')).resolves.toBeUndefined();
  });
});

describe('deleteCache', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('deletes the specified key', async () => {
    await deleteCache('my-key');

    expect(mockRedisClient.del).toHaveBeenCalledWith('my-key');
  });

  it('does nothing when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    await deleteCache('my-key');

    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  it('does not throw when del fails', async () => {
    mockRedisClient.del.mockRejectedValueOnce(new Error('del error'));

    await expect(deleteCache('key')).resolves.toBeUndefined();
  });
});

describe('cacheExists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('returns true when key exists', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(1);

    const result = await cacheExists('my-key');

    expect(result).toBe(true);
    expect(mockRedisClient.exists).toHaveBeenCalledWith('my-key');
  });

  it('returns false when key does not exist', async () => {
    mockRedisClient.exists.mockResolvedValueOnce(0);

    const result = await cacheExists('missing-key');

    expect(result).toBe(false);
  });

  it('returns false when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    const result = await cacheExists('key');

    expect(result).toBe(false);
  });

  it('returns false when exists throws', async () => {
    mockRedisClient.exists.mockRejectedValueOnce(new Error('exists error'));

    const result = await cacheExists('key');

    expect(result).toBe(false);
  });
});

describe('getCacheTTL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(mockRedisClient);
  });

  it('returns TTL for existing key', async () => {
    mockRedisClient.ttl.mockResolvedValueOnce(245);

    const result = await getCacheTTL('my-key');

    expect(result).toBe(245);
    expect(mockRedisClient.ttl).toHaveBeenCalledWith('my-key');
  });

  it('returns -1 for key with no expiry', async () => {
    mockRedisClient.ttl.mockResolvedValueOnce(-1);

    const result = await getCacheTTL('persistent-key');

    expect(result).toBe(-1);
  });

  it('returns -2 when Redis is unavailable', async () => {
    mockGetRedisClient.mockResolvedValue(null);

    const result = await getCacheTTL('key');

    expect(result).toBe(-2);
  });

  it('returns -2 when ttl throws', async () => {
    mockRedisClient.ttl.mockRejectedValueOnce(new Error('ttl error'));

    const result = await getCacheTTL('key');

    expect(result).toBe(-2);
  });
});
