import { getRedisClient } from './getRedisClient';

export async function getCached<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<T> {
  const client = await getRedisClient();

  if (!client) {
    return fetchFn();
  }

  try {
    const cached = await client.get(key);

    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch {
        console.warn(`Invalid cached data for key: ${key}`);
      }
    }

    const freshData = await fetchFn();

    client
      .setEx(key, ttlSeconds, JSON.stringify(freshData))
      .catch((err: Error) => console.error('Failed to set cache:', err.message));

    return freshData;
  } catch (error) {
    console.error('Cache error, fetching fresh:', error instanceof Error ? error.message : 'Unknown error');
    return fetchFn();
  }
}

export async function setCache<T>(
  key: string,
  value: T,
  ttlSeconds: number = 300
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.setEx(key, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to set cache:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const keys: string[] = [];
    for await (const key of client.scanIterator({ MATCH: pattern })) {
      if (Array.isArray(key)) {
        keys.push(...key);
      } else {
        keys.push(key);
      }
    }

    if (keys.length > 0) {
      for (const k of keys) {
        await client.del(k);
      }
    }
  } catch (error) {
    console.error('Failed to invalidate cache:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function deleteCache(key: string): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    await client.del(key);
  } catch (error) {
    console.error('Failed to delete cache:', error instanceof Error ? error.message : 'Unknown error');
  }
}

export async function cacheExists(key: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    const exists = await client.exists(key);
    return exists === 1;
  } catch (error) {
    console.error('Failed to check cache:', error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

export async function getCacheTTL(key: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) return -2;

  try {
    return await client.ttl(key);
  } catch (error) {
    console.error('Failed to get cache TTL:', error instanceof Error ? error.message : 'Unknown error');
    return -2;
  }
}
