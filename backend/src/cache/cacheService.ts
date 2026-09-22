import Redis from 'ioredis';

interface CacheEntry {
  value: any;
  expiresAt: number;
}

export class CacheService {
  private redis: Redis | null = null;
  private memoryCache: Map<string, CacheEntry> = new Map();
  private isRedisConnected = false;

  // Standard TTL policies (in seconds)
  public static readonly TTL_ROUTES = 86400; // 24 hours
  public static readonly TTL_STOPS = 86400; // 24 hours
  public static readonly TTL_TIMETABLES = 86400; // 24 hours
  public static readonly TTL_GEOMETRY = 604800; // 7 days
  public static readonly TTL_VEHICLES = 30; // 30 seconds
  public static readonly TTL_ETA = 30; // 30 seconds

  constructor() {
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl && redisUrl.trim() !== '') {
      try {
        this.redis = new Redis(redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          connectTimeout: 2000,
        });

        this.redis.on('connect', () => {
          this.isRedisConnected = true;
          console.log('[Cache] Connected to Redis successfully');
        });

        this.redis.on('error', (err) => {
          this.isRedisConnected = false;
          // Silent fallback to memory cache
        });

        this.redis.connect().catch(() => {
          this.isRedisConnected = false;
        });
      } catch (e) {
        this.isRedisConnected = false;
      }
    }

    // Periodic in-memory cache cleanup (every 60s)
    setInterval(() => {
      this.cleanupMemoryCache();
    }, 60000).unref();
  }

  private cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (this.isRedisConnected && this.redis) {
      try {
        const data = await this.redis.get(key);
        if (!data) return null;
        return JSON.parse(data) as T;
      } catch {
        // Fall back to memory cache
      }
    }

    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      this.memoryCache.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set(key: string, value: any, ttlSeconds: number = CacheService.TTL_VEHICLES): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
        return;
      } catch {
        // Fall back to memory
      }
    }

    this.memoryCache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    if (this.isRedisConnected && this.redis) {
      try {
        await this.redis.del(key);
      } catch {
        // Fall back
      }
    }
    this.memoryCache.delete(key);
  }

  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = CacheService.TTL_VEHICLES
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null && cached !== undefined) {
      return cached;
    }

    const fresh = await fetchFn();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  getStatus(): { type: 'redis' | 'memory'; connected: boolean; keysCount: number } {
    if (this.isRedisConnected) {
      return { type: 'redis', connected: true, keysCount: 0 };
    }
    return {
      type: 'memory',
      connected: true,
      keysCount: this.memoryCache.size,
    };
  }
}

export const cacheService = new CacheService();
export default cacheService;
