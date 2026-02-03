import { createClient, RedisClientType } from 'redis';

let redisClient: RedisClientType | null = null;
let isConnecting = false;
let connectionFailed = false;

/**
 * Shared Redis connection factory. Used by both cache and session modules
 * to avoid maintaining independent connection pools.
 */
export async function getRedisClient(): Promise<RedisClientType | null> {
  if (connectionFailed) {
    return null;
  }

  if (redisClient?.isOpen) {
    return redisClient;
  }

  if (isConnecting) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return redisClient?.isOpen ? redisClient : null;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL not configured');
    connectionFailed = true;
    return null;
  }

  try {
    isConnecting = true;

    redisClient = createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries: number) => {
          if (retries > 3) {
            console.warn('Redis connection failed after 3 retries');
            connectionFailed = true;
            return new Error('Redis connection failed');
          }
          return Math.min(retries * 100, 1000);
        },
      },
    });

    redisClient.on('error', (err: Error) => {
      console.error('Redis error:', err.message);
    });

    await redisClient.connect();
    isConnecting = false;

    return redisClient;
  } catch (error) {
    console.warn('Failed to connect to Redis:', error instanceof Error ? error.message : 'Unknown error');
    isConnecting = false;
    connectionFailed = true;
    return null;
  }
}
