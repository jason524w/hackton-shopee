/**
 * Per-key token-bucket rate limiter.
 *
 * Marketplace anti-bot systems flag bursty, regular traffic. Throttling captures per
 * platform (and per account / per proxy) to a steady, sub-suspicious rate is the cheapest
 * way to stay under the radar. Each key (e.g. "1688", "taobao:acct3", "proxy:7") gets its
 * own bucket so limits compose across dimensions.
 *
 * Clock + sleep are injectable for deterministic tests.
 */

export interface RateLimiter {
  /** Take a token for `key`, waiting (async) until one is available. */
  acquire(key: string): Promise<void>;
  /** Take a token if one is immediately available; returns false otherwise (no wait). */
  tryAcquire(key: string): boolean;
  /** Current whole-token count for a key (after refill). */
  available(key: string): number;
}

export interface TokenBucketOptions {
  /** Max tokens a bucket holds (burst size). */
  capacity: number;
  /** Tokens added per second. */
  refillPerSec: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export function createTokenBucketRateLimiter(options: TokenBucketOptions): RateLimiter {
  const capacity = Math.max(1, options.capacity);
  const refillPerSec = Math.max(0, options.refillPerSec);
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const buckets = new Map<string, Bucket>();

  function refill(key: string): Bucket {
    const bucket = buckets.get(key) ?? { tokens: capacity, lastRefillMs: now() };
    const elapsedSec = (now() - bucket.lastRefillMs) / 1000;
    if (elapsedSec > 0 && refillPerSec > 0) {
      bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillPerSec);
      bucket.lastRefillMs = now();
    } else if (refillPerSec === 0) {
      bucket.lastRefillMs = now();
    }
    buckets.set(key, bucket);
    return bucket;
  }

  return {
    tryAcquire(key: string): boolean {
      const bucket = refill(key);
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        return true;
      }
      return false;
    },

    available(key: string): number {
      return Math.floor(refill(key).tokens);
    },

    async acquire(key: string): Promise<void> {
      // Refill-then-take, sleeping for the time to the next whole token when empty.
      // Bounded loop guard avoids a pathological spin if refillPerSec is 0.
      for (let guard = 0; guard < 100_000; guard += 1) {
        const bucket = refill(key);
        if (bucket.tokens >= 1) {
          bucket.tokens -= 1;
          return;
        }
        if (refillPerSec === 0) {
          throw new Error(`Rate limiter for "${key}" has no refill and is empty.`);
        }
        const needed = 1 - bucket.tokens;
        const waitMs = Math.ceil((needed / refillPerSec) * 1000);
        await sleep(Math.max(1, waitMs));
      }
      throw new Error(`Rate limiter acquire for "${key}" exceeded its retry budget.`);
    },
  };
}
